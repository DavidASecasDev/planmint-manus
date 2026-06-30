/**
 * Scheduled handler: Geofence Check
 * 
 * Runs every 2 minutes. For each organization with GPS devices:
 * 1. Fetches all active geofences
 * 2. Reads current positions from local device_positions table (populated by Xexun webhook)
 * 3. Determines if each vehicle is inside/outside each geofence
 * 4. Detects transitions (enter/exit) by comparing with previous state
 * 5. Creates alerts and sends notifications for transitions
 * 
 * Path: POST /api/scheduled/geofence-check
 * Auth: Manus Heartbeat cron identity (validated via x-manus-cron-task-uid header)
 */
import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import { notifyOwner } from "./_core/notification";

// ─── Geometry helpers ───────────────────────────────────────────────────────

interface Point {
  lat: number;
  lng: number;
}

interface GeofenceRecord {
  id: string;
  organization_id: string;
  name: string;
  type: "circle" | "polygon";
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  coordinates: Point[] | null;
  is_active: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
}

/**
 * Check if a point is inside a circle geofence.
 * Uses the Haversine formula to calculate distance.
 */
function isPointInCircle(point: Point, center: Point, radiusMeters: number): boolean {
  const R = 6371000; // Earth's radius in meters
  const dLat = (point.lat - center.lat) * Math.PI / 180;
  const dLng = (point.lng - center.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(center.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= radiusMeters;
}

/**
 * Check if a point is inside a polygon geofence.
 * Uses the ray-casting algorithm.
 */
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
      (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is inside a geofence (dispatches to circle or polygon check)
 */
function isPointInGeofence(point: Point, geofence: GeofenceRecord): boolean {
  if (geofence.type === "circle") {
    if (geofence.center_lat == null || geofence.center_lng == null || geofence.radius_meters == null) {
      return false;
    }
    return isPointInCircle(point, { lat: geofence.center_lat, lng: geofence.center_lng }, geofence.radius_meters);
  } else if (geofence.type === "polygon") {
    if (!geofence.coordinates || geofence.coordinates.length < 3) {
      return false;
    }
    return isPointInPolygon(point, geofence.coordinates);
  }
  return false;
}

// ─── Main scheduled handler ─────────────────────────────────────────────────

export async function handleScheduledGeofenceCheck(req: Request, res: Response) {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;

  try {
    // Validate this is a cron call (header or cookie-based cron identity)
    if (!taskUid) {
      try {
        const { sdk } = await import("./_core/sdk");
        const user = await sdk.authenticateRequest(req) as any;
        if (!user.isCron) {
          return res.status(403).json({ error: "cron-only" });
        }
      } catch {
        return res.status(403).json({ error: "cron-only" });
      }
    }

    const serviceClient = getServiceClient();

    // 1. Get all organizations with active geofences
    const { data: orgsWithGeofences, error: orgsError } = await serviceClient
      .from("geofences")
      .select("organization_id")
      .eq("is_active", true);

    if (orgsError || !orgsWithGeofences || orgsWithGeofences.length === 0) {
      return res.json({
        ok: true,
        message: "No active geofences found",
        checked: 0,
        alerts: 0,
      });
    }

    // Deduplicate organization IDs
    const orgIds = Array.from(new Set(orgsWithGeofences.map(g => g.organization_id)));

    let totalChecked = 0;
    let totalAlerts = 0;
    const orgResults: Array<{ orgId: string; checked: number; alerts: number; errors: string[] }> = [];

    // 2. Process each organization
    for (const orgId of orgIds) {
      const orgErrors: string[] = [];
      let orgChecked = 0;
      let orgAlerts = 0;

      try {
        // Check if Xexun GPS is enabled for this org
        const { data: settings } = await serviceClient
          .from("integration_settings")
          .select("xexun_enabled")
          .eq("organization_id", orgId)
          .maybeSingle();

        if (!settings?.xexun_enabled) {
          orgErrors.push("GPS integration not enabled");
          orgResults.push({ orgId, checked: 0, alerts: 0, errors: orgErrors });
          continue;
        }

        // Get all active geofences for this org
        const { data: geofences, error: gfError } = await serviceClient
          .from("geofences")
          .select("*")
          .eq("organization_id", orgId)
          .eq("is_active", true);

        if (gfError || !geofences || geofences.length === 0) {
          orgResults.push({ orgId, checked: 0, alerts: 0, errors: gfError ? [gfError.message] : [] });
          continue;
        }

        // Get all fleet vehicles with xexun_imei for this org
        const { data: vehicles, error: vError } = await serviceClient
          .from("fleet_vehicles")
          .select("id, xexun_imei, matricula")
          .eq("organization_id", orgId)
          .not("xexun_imei", "is", null);

        if (vError || !vehicles || vehicles.length === 0) {
          orgResults.push({ orgId, checked: 0, alerts: 0, errors: vError ? [vError.message] : [] });
          continue;
        }

        // Read all current positions from local device_positions table
        const imeis = vehicles.map(v => v.xexun_imei).filter(Boolean);
        const { data: positions, error: posError } = await serviceClient
          .from("device_positions")
          .select("imei, latitude, longitude, speed, battery_level")
          .eq("organization_id", orgId)
          .in("imei", imeis);

        if (posError || !positions || positions.length === 0) {
          orgErrors.push("No device positions available");
          orgResults.push({ orgId, checked: 0, alerts: 0, errors: orgErrors });
          continue;
        }

        // Build imei → position map
        const positionMap = new Map<string, { latitude: number; longitude: number; speed: number; batteryLevel: number | null }>();
        for (const pos of positions) {
          positionMap.set(pos.imei, {
            latitude: pos.latitude,
            longitude: pos.longitude,
            speed: pos.speed || 0,
            batteryLevel: pos.battery_level ?? null,
          });
        }

        // Get existing vehicle states for this org
        const { data: existingStates } = await serviceClient
          .from("geofence_vehicle_state")
          .select("*")
          .eq("organization_id", orgId);

        const stateMap = new Map<string, { id: string; is_inside: boolean }>();
        for (const state of (existingStates || [])) {
          const key = `${state.geofence_id}:${state.device_id}`;
          stateMap.set(key, { id: state.id, is_inside: state.is_inside });
        }

        // 3. Check each vehicle against each geofence
        for (const vehicle of vehicles) {
          const deviceId = vehicle.xexun_imei!;
          const position = positionMap.get(deviceId);

          if (!position || position.latitude === 0 || position.longitude === 0) {
            continue; // Skip vehicles without valid position
          }

          const point: Point = { lat: position.latitude, lng: position.longitude };

          for (const geofence of geofences) {
            orgChecked++;
            const stateKey = `${geofence.id}:${deviceId}`;
            const currentState = stateMap.get(stateKey);
            const isNowInside = isPointInGeofence(point, geofence);
            const wasInside = currentState?.is_inside ?? false;

            // Detect transition
            const hasTransition = isNowInside !== wasInside;

            if (hasTransition) {
              const eventType = isNowInside ? "enter" : "exit";
              const shouldAlert =
                (eventType === "enter" && geofence.alert_on_enter) ||
                (eventType === "exit" && geofence.alert_on_exit);

              if (shouldAlert) {
                orgAlerts++;

                // Insert alert record
                await serviceClient.from("geofence_alerts").insert({
                  organization_id: orgId,
                  geofence_id: geofence.id,
                  vehicle_id: vehicle.id,
                  vehicle_plate: vehicle.matricula,
                  device_id: deviceId,
                  event_type: eventType,
                  latitude: position.latitude,
                  longitude: position.longitude,
                  speed: position.speed,
                  triggered_at: new Date().toISOString(),
                  notified: true,
                });

                // Send push notification to owner
                const actionLabel = eventType === "enter" ? "ha ENTRADO en" : "ha SALIDO de";
                const emoji = eventType === "enter" ? "🟢" : "🔴";
                notifyOwner({
                  title: `${emoji} Geocerca: ${vehicle.matricula} ${actionLabel} "${geofence.name}"`,
                  content: `El vehículo ${vehicle.matricula} ${actionLabel} la geocerca "${geofence.name}" a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}. Velocidad: ${Math.round(position.speed)} km/h.`,
                }).catch(err => console.warn("[geofence-check] Notification error:", err));

                // Create in-app notifications for all team members
                try {
                  const { data: members } = await serviceClient
                    .from("organization_members")
                    .select("user_id")
                    .eq("organization_id", orgId)
                    .eq("status", "active");

                  if (members && members.length > 0) {
                    const notifTitle = `${emoji} Geocerca: ${vehicle.matricula} ${actionLabel} "${geofence.name}"`;
                    const notifBody = `Velocidad: ${Math.round(position.speed)} km/h. Hora: ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

                    const notifications = members.map((m: { user_id: string }) => ({
                      organization_id: orgId,
                      user_id: m.user_id,
                      type: "geofence_alert",
                      title: notifTitle,
                      body: notifBody.substring(0, 500),
                      entity_type: "geofence",
                      entity_id: geofence.id,
                    }));

                    await serviceClient.from("notifications").insert(notifications);
                  }
                } catch (notifErr) {
                  console.warn("[geofence-check] In-app notification error:", notifErr);
                }
              }
            }

            // Upsert vehicle state
            if (currentState) {
              await serviceClient
                .from("geofence_vehicle_state")
                .update({
                  is_inside: isNowInside,
                  last_checked_at: new Date().toISOString(),
                  ...(hasTransition ? { last_transition_at: new Date().toISOString() } : {}),
                })
                .eq("id", currentState.id);
            } else {
              await serviceClient
                .from("geofence_vehicle_state")
                .insert({
                  organization_id: orgId,
                  geofence_id: geofence.id,
                  device_id: deviceId,
                  vehicle_id: vehicle.id,
                  is_inside: isNowInside,
                  last_checked_at: new Date().toISOString(),
                  last_transition_at: hasTransition ? new Date().toISOString() : null,
                });
            }
          }
        }

        // ── Low Battery Check ──
        // Check all vehicles for battery < 15% with 4-hour cooldown to avoid spam
        const LOW_BATTERY_THRESHOLD = 15;
        const BATTERY_ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

        for (const vehicle of vehicles) {
          const deviceId = vehicle.xexun_imei!;
          const position = positionMap.get(deviceId);

          if (!position || position.batteryLevel === null || position.batteryLevel >= LOW_BATTERY_THRESHOLD) {
            continue;
          }

          // Check cooldown: don't alert again within 4 hours for the same device
          const cooldownCutoff = new Date(Date.now() - BATTERY_ALERT_COOLDOWN_MS).toISOString();
          const { data: recentBatteryAlert } = await serviceClient
            .from("notifications")
            .select("id")
            .eq("organization_id", orgId)
            .eq("type", "low_battery_alert")
            .eq("entity_id", vehicle.id)
            .gte("created_at", cooldownCutoff)
            .limit(1);

          if (recentBatteryAlert && recentBatteryAlert.length > 0) {
            continue; // Already alerted recently
          }

          // Send push notification to owner
          const batteryPct = Math.round(position.batteryLevel);
          notifyOwner({
            title: `⚠️ Batería baja: ${vehicle.matricula} (${batteryPct}%)`,
            content: `El dispositivo GPS del vehículo ${vehicle.matricula} tiene solo ${batteryPct}% de batería. Se recomienda cargarlo pronto para evitar pérdida de seguimiento.`,
          }).catch(err => console.warn("[geofence-check] Battery notification error:", err));

          // Create in-app notifications for all team members
          try {
            const { data: members } = await serviceClient
              .from("organization_members")
              .select("user_id")
              .eq("organization_id", orgId)
              .eq("status", "active");

            if (members && members.length > 0) {
              const notifications = members.map((m: { user_id: string }) => ({
                organization_id: orgId,
                user_id: m.user_id,
                type: "low_battery_alert",
                title: `⚠️ Batería baja: ${vehicle.matricula} (${batteryPct}%)`,
                body: `El GPS del vehículo ${vehicle.matricula} tiene ${batteryPct}% de batería. Cargar pronto.`,
                entity_type: "fleet_vehicle",
                entity_id: vehicle.id,
              }));

              await serviceClient.from("notifications").insert(notifications);
              orgAlerts++;
            }
          } catch (batteryNotifErr) {
            console.warn("[geofence-check] Battery in-app notification error:", batteryNotifErr);
          }
        }
      } catch (err: any) {
        orgErrors.push(err?.message || "Unknown error");
        console.error(`[geofence-check] Error processing org ${orgId}:`, err?.message);
      }

      totalChecked += orgChecked;
      totalAlerts += orgAlerts;
      orgResults.push({ orgId, checked: orgChecked, alerts: orgAlerts, errors: orgErrors });
    }

    return res.json({
      ok: true,
      checked: totalChecked,
      alerts: totalAlerts,
      organizations: orgResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[geofence-check] Fatal error:", error);
    return res.status(500).json({
      error: error?.message || "Unknown error",
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
