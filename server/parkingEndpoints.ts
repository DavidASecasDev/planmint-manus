import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

// ─── GET /api/parking/zones ─────────────────────────────────────────────────
export async function handleGetParkingZones(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("parking_zones")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[parking/zones] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/zones] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── POST /api/parking/zones ────────────────────────────────────────────────
export async function handleCreateParkingZone(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();
    const { allowed } = await checkUserPermission(sb, organizationId, userId, "vehicles.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { name, description, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Missing name" });

    const { data, error } = await sb
      .from("parking_zones")
      .insert({
        organization_id: organizationId,
        name,
        description: description || null,
        color: color || "#3B82F6",
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error("[parking/zones] Create error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/zones] Create error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── DELETE /api/parking/zones/:id ──────────────────────────────────────────
export async function handleDeleteParkingZone(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();
    const { allowed } = await checkUserPermission(sb, organizationId, userId, "vehicles.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id } = req.params;
    const { error } = await sb
      .from("parking_zones")
      .update({ is_active: false })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[parking/zones] Delete error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/zones] Delete error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── GET /api/parking/spots ─────────────────────────────────────────────────
export async function handleGetParkingSpots(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const zoneId = req.query.zone_id as string | undefined;

    let query = sb
      .from("parking_spots")
      .select("*, parking_zones!inner(name, color)")
      .eq("organization_id", organizationId)
      .order("spot_number", { ascending: true });

    if (zoneId) {
      query = query.eq("zone_id", zoneId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[parking/spots] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/spots] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── POST /api/parking/spots/bulk ───────────────────────────────────────────
// Create multiple spots for a zone at once
export async function handleCreateParkingSpotsBulk(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();
    const { allowed } = await checkUserPermission(sb, organizationId, userId, "vehicles.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { zone_id, spots } = req.body;
    if (!zone_id || !spots || !Array.isArray(spots)) {
      return res.status(400).json({ ok: false, error: "Missing zone_id or spots array" });
    }

    const records = spots.map((s: { spot_number: number; label?: string; grid_row?: number; grid_col?: number }) => ({
      organization_id: organizationId,
      zone_id,
      spot_number: s.spot_number,
      label: s.label || null,
      grid_row: s.grid_row ?? null,
      grid_col: s.grid_col ?? null,
      status: "free",
    }));

    const { data, error } = await sb
      .from("parking_spots")
      .upsert(records, { onConflict: "zone_id,spot_number" })
      .select();

    if (error) {
      console.error("[parking/spots/bulk] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data || [], count: records.length });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/spots/bulk] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── POST /api/parking/assign ───────────────────────────────────────────────
// Assign a vehicle to a parking spot
export async function handleAssignParkingSpot(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { spot_id, vehicle_id, vehicle_matricula } = req.body;
    if (!spot_id || !vehicle_matricula) {
      return res.status(400).json({ ok: false, error: "Missing spot_id or vehicle_matricula" });
    }

    // Check spot is free
    const { data: spot, error: spotErr } = await sb
      .from("parking_spots")
      .select("id, status, zone_id, spot_number")
      .eq("id", spot_id)
      .eq("organization_id", organizationId)
      .single();

    if (spotErr || !spot) {
      return res.status(404).json({ ok: false, error: "Spot not found" });
    }

    if (spot.status !== "free") {
      return res.status(409).json({ ok: false, error: "La plaza ya está ocupada" });
    }

    // Release any other spot this vehicle might occupy
    await sb
      .from("parking_spots")
      .update({
        status: "free",
        vehicle_id: null,
        vehicle_matricula: null,
        occupied_at: null,
        occupied_by: null,
      })
      .eq("organization_id", organizationId)
      .eq("vehicle_matricula", vehicle_matricula);

    // Assign the spot
    const { error: updateErr } = await sb
      .from("parking_spots")
      .update({
        status: "occupied",
        vehicle_id: vehicle_id || null,
        vehicle_matricula,
        occupied_at: new Date().toISOString(),
        occupied_by: userId,
      })
      .eq("id", spot_id);

    if (updateErr) {
      console.error("[parking/assign] Error:", updateErr.message);
      return res.status(500).json({ ok: false, error: updateErr.message });
    }

    // Record history
    await sb.from("parking_history").insert({
      organization_id: organizationId,
      spot_id: spot.id,
      zone_id: spot.zone_id,
      spot_number: spot.spot_number,
      vehicle_id: vehicle_id || null,
      vehicle_matricula,
      action: "occupy",
      performed_by: userId,
    });

    // Check zone occupancy and notify if >= 90%
    try {
      const { data: zoneSpots } = await sb
        .from("parking_spots")
        .select("id, status")
        .eq("zone_id", spot.zone_id)
        .eq("organization_id", organizationId);

      if (zoneSpots && zoneSpots.length > 0) {
        const totalSpots = zoneSpots.length;
        const occupiedSpots = zoneSpots.filter((s: any) => s.status === "occupied").length;
        const occupancyRate = occupiedSpots / totalSpots;

        if (occupancyRate >= 0.9) {
          // Get zone name
          const { data: zone } = await sb
            .from("parking_zones")
            .select("name")
            .eq("id", spot.zone_id)
            .single();

          const zoneName = zone?.name || "Zona desconocida";
          const pct = Math.round(occupancyRate * 100);

          // Notify owner
          const { notifyOwner } = await import("./_core/notification");
          notifyOwner({
            title: `\u26a0\ufe0f Parking: ${zoneName} al ${pct}% de capacidad`,
            content: `La zona "${zoneName}" tiene ${occupiedSpots}/${totalSpots} plazas ocupadas. Considera redirigir veh\u00edculos a otra zona.`,
          });

          // In-app notifications for all members
          const { data: members } = await sb
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", organizationId)
            .eq("status", "active");

          if (members && members.length > 0) {
            const notifications = members.map((m: { user_id: string }) => ({
              organization_id: organizationId,
              user_id: m.user_id,
              type: "parking_full" as const,
              title: `\u26a0\ufe0f ${zoneName} al ${pct}% de capacidad`,
              body: `${occupiedSpots}/${totalSpots} plazas ocupadas. Considera redirigir veh\u00edculos a otra zona.`,
              entity_type: "parking_zone",
              entity_id: spot.zone_id,
            }));
            await sb.from("notifications").insert(notifications);
          }
        }
      }
    } catch (notifErr) {
      // Non-blocking: don't fail the assignment if notification fails
      console.warn("[parking/assign] Occupancy notification error:", notifErr);
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/assign] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── POST /api/parking/release ──────────────────────────────────────────────
// Release a parking spot (manual or automatic)
export async function handleReleaseParkingSpot(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { spot_id } = req.body;
    if (!spot_id) return res.status(400).json({ ok: false, error: "Missing spot_id" });

    // Get current spot info for history
    const { data: spot } = await sb
      .from("parking_spots")
      .select("id, zone_id, spot_number, vehicle_id, vehicle_matricula")
      .eq("id", spot_id)
      .eq("organization_id", organizationId)
      .single();

    if (!spot) return res.status(404).json({ ok: false, error: "Spot not found" });

    // Release it
    const { error } = await sb
      .from("parking_spots")
      .update({
        status: "free",
        vehicle_id: null,
        vehicle_matricula: null,
        occupied_at: null,
        occupied_by: null,
      })
      .eq("id", spot_id);

    if (error) {
      console.error("[parking/release] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Record history
    await sb.from("parking_history").insert({
      organization_id: organizationId,
      spot_id: spot.id,
      zone_id: spot.zone_id,
      spot_number: spot.spot_number,
      vehicle_id: spot.vehicle_id,
      vehicle_matricula: spot.vehicle_matricula,
      action: "release",
      performed_by: userId,
    });

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/release] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── POST /api/parking/release-by-vehicle ───────────────────────────────────
// Release all spots occupied by a specific vehicle (called by syncRently)
export async function releaseParkingSpotByVehicle(
  organizationId: string,
  vehicleMatricula: string,
  performedBy?: string
): Promise<void> {
  const sb = getServiceClient();

  // Find spots occupied by this vehicle
  const { data: spots } = await sb
    .from("parking_spots")
    .select("id, zone_id, spot_number, vehicle_id")
    .eq("organization_id", organizationId)
    .eq("vehicle_matricula", vehicleMatricula)
    .eq("status", "occupied");

  if (!spots || spots.length === 0) return;

  // Release all
  await sb
    .from("parking_spots")
    .update({
      status: "free",
      vehicle_id: null,
      vehicle_matricula: null,
      occupied_at: null,
      occupied_by: null,
    })
    .eq("organization_id", organizationId)
    .eq("vehicle_matricula", vehicleMatricula)
    .eq("status", "occupied");

  // Record history for each
  const historyRecords = spots.map((spot) => ({
    organization_id: organizationId,
    spot_id: spot.id,
    zone_id: spot.zone_id,
    spot_number: spot.spot_number,
    vehicle_id: spot.vehicle_id,
    vehicle_matricula: vehicleMatricula,
    action: "release" as const,
    performed_by: performedBy || "system_auto_release",
  }));

  await sb.from("parking_history").insert(historyRecords);
  console.log(`[parking] Auto-released ${spots.length} spot(s) for ${vehicleMatricula}`);
}

// ─── GET /api/parking/history ───────────────────────────────────────────────
export async function handleGetParkingHistory(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const limit = parseInt(req.query.limit as string) || 50;

    const { data, error } = await sb
      .from("parking_history")
      .select("*")
      .eq("organization_id", organizationId)
      .order("performed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[parking/history] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/history] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── GET /api/parking/overview ──────────────────────────────────────────────
// Returns zones with their spots for the visual map
export async function handleGetParkingOverview(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Get all zones
    const { data: zones, error: zonesErr } = await sb
      .from("parking_zones")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (zonesErr) {
      console.error("[parking/overview] Zones error:", zonesErr.message);
      return res.status(500).json({ ok: false, error: zonesErr.message });
    }

    // Get all spots
    const { data: spots, error: spotsErr } = await sb
      .from("parking_spots")
      .select("*")
      .eq("organization_id", organizationId)
      .order("spot_number", { ascending: true });

    if (spotsErr) {
      console.error("[parking/overview] Spots error:", spotsErr.message);
      return res.status(500).json({ ok: false, error: spotsErr.message });
    }

    // Group spots by zone
    const zonesWithSpots = (zones || []).map((zone) => ({
      ...zone,
      spots: (spots || []).filter((s) => s.zone_id === zone.id),
    }));

    // Summary stats
    const totalSpots = spots?.length || 0;
    const occupiedSpots = spots?.filter((s) => s.status === "occupied").length || 0;
    const freeSpots = spots?.filter((s) => s.status === "free").length || 0;
    const blockedSpots = spots?.filter((s) => s.status === "blocked").length || 0;

    return res.json({
      ok: true,
      data: {
        zones: zonesWithSpots,
        summary: { total: totalSpots, occupied: occupiedSpots, free: freeSpots, blocked: blockedSpots },
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/overview] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── POST /api/parking/seed-layout ──────────────────────────────────────────
// Seeds the initial parking layout based on the Azul Cars campa plan
export async function handleSeedParkingLayout(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();
    const { allowed } = await checkUserPermission(sb, organizationId, userId, "vehicles.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    // Check if zones already exist
    const { data: existing } = await sb
      .from("parking_zones")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ ok: false, error: "El parking ya está configurado" });
    }

    // Create zones
    const zoneDefinitions = [
      { name: "Zona Principal", description: "Plazas 1-43 (área derecha)", color: "#10B981", sort_order: 1 },
      { name: "Zona Central", description: "Plazas 44-69 (columnas centrales)", color: "#3B82F6", sort_order: 2 },
      { name: "Zona Lateral", description: "Plazas 70-95 (pares de columnas)", color: "#8B5CF6", sort_order: 3 },
      { name: "Zona Exterior", description: "Plazas 96-110 (columna izquierda)", color: "#F59E0B", sort_order: 4 },
      { name: "Sucios", description: "Vehículos pendientes de limpieza", color: "#EF4444", sort_order: 5 },
    ];

    const { data: createdZones, error: zoneErr } = await sb
      .from("parking_zones")
      .insert(zoneDefinitions.map((z) => ({ ...z, organization_id: organizationId })))
      .select();

    if (zoneErr || !createdZones) {
      console.error("[parking/seed] Zone creation error:", zoneErr?.message);
      return res.status(500).json({ ok: false, error: zoneErr?.message || "Failed to create zones" });
    }

    // Map zone names to IDs
    const zoneMap = new Map(createdZones.map((z) => [z.name, z.id]));

    // Define spots for each zone based on the real layout
    const spotDefinitions: { zone: string; spots: { number: number; row: number; col: number }[] }[] = [
      {
        zone: "Zona Principal",
        spots: [
          // Row 1: 1-11
          ...Array.from({ length: 11 }, (_, i) => ({ number: i + 1, row: 0, col: i })),
          // Row 2: 12-19
          ...Array.from({ length: 8 }, (_, i) => ({ number: i + 12, row: 1, col: i })),
          // Row 3: 20-27
          ...Array.from({ length: 8 }, (_, i) => ({ number: i + 20, row: 2, col: i })),
          // Row 4: 28-35
          ...Array.from({ length: 8 }, (_, i) => ({ number: i + 28, row: 3, col: i })),
          // Row 5: 36-43
          ...Array.from({ length: 8 }, (_, i) => ({ number: i + 36, row: 4, col: i })),
        ],
      },
      {
        zone: "Zona Central",
        spots: [
          // Left column: 44,46,48,50,52,54,56,58,60,62,64,66,68
          ...([44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68].map((n, i) => ({ number: n, row: i, col: 0 }))),
          // Right column: 45,47,49,51,53,55,57,59,61,63,65,67,69
          ...([45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69].map((n, i) => ({ number: n, row: i, col: 1 }))),
        ],
      },
      {
        zone: "Zona Lateral",
        spots: [
          // Left column: 70,72,74,76,78,80,82,84,86,88,90,92,94
          ...([70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94].map((n, i) => ({ number: n, row: i, col: 0 }))),
          // Right column: 71,73,75,77,79,81,83,85,87,89,91,93,95
          ...([71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95].map((n, i) => ({ number: n, row: i, col: 1 }))),
        ],
      },
      {
        zone: "Zona Exterior",
        spots: Array.from({ length: 15 }, (_, i) => ({ number: 96 + i, row: i, col: 0 })),
      },
    ];

    // Insert all spots
    const allSpots: any[] = [];
    for (const def of spotDefinitions) {
      const zoneId = zoneMap.get(def.zone);
      if (!zoneId) continue;
      for (const s of def.spots) {
        allSpots.push({
          organization_id: organizationId,
          zone_id: zoneId,
          spot_number: s.number,
          label: `${s.number}`,
          grid_row: s.row,
          grid_col: s.col,
          status: "free",
        });
      }
    }

    const { error: spotsErr } = await sb.from("parking_spots").insert(allSpots);
    if (spotsErr) {
      console.error("[parking/seed] Spots creation error:", spotsErr.message);
      return res.status(500).json({ ok: false, error: spotsErr.message });
    }

    return res.json({
      ok: true,
      message: `Parking configurado: ${createdZones.length} zonas, ${allSpots.length} plazas`,
      zones: createdZones.length,
      spots: allSpots.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[parking/seed] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
