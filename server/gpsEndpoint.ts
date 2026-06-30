/**
 * GPS Tracking Integration Endpoint
 * Reads device positions from local Supabase tables (populated by Xexun webhook).
 * Replaces the old Traccar proxy approach.
 * 
 * Endpoints:
 * - POST /api/gps/devices           → List all linked GPS devices
 * - POST /api/gps/positions         → Get last known positions (all or single device)
 * - POST /api/gps/device-position   → Get position for a specific vehicle (by fleet_vehicle_id)
 * - POST /api/gps/settings          → Get/update GPS integration settings
 * - POST /api/gps/link-device       → Link a GPS device (by IMEI) to a fleet vehicle
 * - POST /api/gps/unlink-device     → Unlink a GPS device from a fleet vehicle
 * - POST /api/gps/test-connection   → Test GPS integration status
 * - POST /api/gps/vehicle-by-plate  → Get device info by vehicle plate
 * - POST /api/gps/route-history     → Get route history for a device
 * - POST /api/gps/fleet-status      → Get comprehensive fleet GPS status
 * - POST /api/gps/fleet-daily-km    → Get daily km traveled
 */
import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const getServiceClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * POST /api/gps/test-connection
 * Test GPS integration status - checks if Xexun is enabled and devices are reporting
 */
export async function handleGpsTestConnection(req: Request, res: Response) {
  try {
    const { organization_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    // Check if Xexun is enabled
    const { data: settings } = await sb
      .from('integration_settings')
      .select('xexun_enabled, xexun_push_secret')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (!settings?.xexun_enabled) {
      return res.json({ ok: true, connected: false, message: 'GPS integration not enabled' });
    }

    // Check how many devices are reporting
    const { count } = await sb
      .from('device_positions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    return res.json({
      ok: true,
      connected: true,
      message: `GPS integration active. ${count || 0} devices registered.`,
      deviceCount: count || 0,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/devices
 * List all GPS devices (from device_positions table)
 */
export async function handleGpsDevices(req: Request, res: Response) {
  try {
    const { organization_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    const { data: devices, error } = await sb
      .from('device_positions')
      .select('id, imei, fleet_vehicle_id, device_status, last_update, latitude, longitude, battery_level')
      .eq('organization_id', organization_id)
      .order('last_update', { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, error: 'Error al obtener dispositivos' });
    }

    // Enrich with vehicle info
    const vehicleIds = (devices || []).filter(d => d.fleet_vehicle_id).map(d => d.fleet_vehicle_id);
    let vehicleMap = new Map<string, { matricula: string; marca: string; modelo: string }>();

    if (vehicleIds.length > 0) {
      const { data: vehicles } = await sb
        .from('fleet_vehicles')
        .select('id, matricula, marca, modelo')
        .in('id', vehicleIds);

      if (vehicles) {
        vehicleMap = new Map(vehicles.map(v => [v.id, v]));
      }
    }

    const enrichedDevices = (devices || []).map(d => {
      const vehicle = d.fleet_vehicle_id ? vehicleMap.get(d.fleet_vehicle_id) : null;
      return {
        id: d.imei, // Use IMEI as device ID for compatibility
        uniqueId: d.imei,
        name: vehicle ? `${vehicle.matricula} - ${vehicle.marca} ${vehicle.modelo}` : `Device ${d.imei}`,
        status: d.device_status || 'unknown',
        lastUpdate: d.last_update,
        positionId: d.id,
        linkedVehicleId: d.fleet_vehicle_id,
        linkedVehicle: vehicle || null,
      };
    });

    return res.json({ ok: true, devices: enrichedDevices });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/positions
 * Get last known positions for all devices or a specific device
 */
export async function handleGpsPositions(req: Request, res: Response) {
  try {
    const { organization_id, device_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    let query = sb
      .from('device_positions')
      .select('*')
      .eq('organization_id', organization_id);

    if (device_id) {
      query = query.eq('imei', device_id);
    }

    const { data: positions, error } = await query.order('last_update', { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, error: 'Error al obtener posiciones' });
    }

    const formattedPositions = (positions || []).map(p => ({
      deviceId: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed,
      course: p.course,
      altitude: p.altitude,
      address: p.address,
      deviceTime: p.last_update,
      fixTime: p.last_update,
      valid: p.latitude !== 0 && p.longitude !== 0,
      attributes: p.attributes || {},
      batteryLevel: p.battery_level,
    }));

    return res.json({ ok: true, positions: formattedPositions });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/device-position
 * Get position for a specific fleet vehicle
 */
export async function handleGpsDevicePosition(req: Request, res: Response) {
  try {
    const { organization_id, fleet_vehicle_id } = req.body;
    if (!organization_id || !fleet_vehicle_id) {
      return res.status(400).json({ ok: false, error: 'organization_id and fleet_vehicle_id required' });
    }

    const sb = getServiceClient();

    // Get vehicle info
    const { data: vehicle } = await sb
      .from('fleet_vehicles')
      .select('id, matricula, marca, modelo, xexun_imei')
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (!vehicle || !vehicle.xexun_imei) {
      return res.json({ ok: true, vehicle: vehicle || null, device: null, position: null });
    }

    // Get position
    const { data: position } = await sb
      .from('device_positions')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('imei', vehicle.xexun_imei)
      .maybeSingle();

    return res.json({
      ok: true,
      vehicle: {
        fleet_vehicle_id: vehicle.id,
        matricula: vehicle.matricula,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
      },
      device: position ? {
        name: `${vehicle.matricula} - Xexun X24`,
        status: position.device_status,
        lastUpdate: position.last_update,
      } : null,
      position: position ? {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        address: position.address,
        deviceTime: position.last_update,
        valid: position.latitude !== 0 && position.longitude !== 0,
        altitude: position.altitude,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/settings
 * Get or update GPS integration settings
 */
export async function handleGpsSettings(req: Request, res: Response) {
  try {
    const { organization_id, action, xexun_push_secret, xexun_enabled } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    if (action === 'update') {
      const updateData: Record<string, unknown> = {};
      if (xexun_push_secret !== undefined) updateData.xexun_push_secret = xexun_push_secret;
      if (xexun_enabled !== undefined) updateData.xexun_enabled = xexun_enabled;

      const { error } = await sb
        .from('integration_settings')
        .update(updateData)
        .eq('organization_id', organization_id);

      if (error) {
        return res.status(500).json({ ok: false, error: 'Error al actualizar configuración' });
      }

      return res.json({ ok: true, message: 'Settings updated' });
    }

    // Default: get settings
    const { data: settings } = await sb
      .from('integration_settings')
      .select('xexun_enabled, xexun_push_secret')
      .eq('organization_id', organization_id)
      .maybeSingle();

    return res.json({
      ok: true,
      settings: {
        xexun_enabled: settings?.xexun_enabled || false,
        xexun_push_secret: settings?.xexun_push_secret || null,
        webhook_url: `/api/xexun/push`,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/link-device
 * Link a GPS device (by IMEI) to a fleet vehicle
 */
export async function handleGpsLinkDevice(req: Request, res: Response) {
  try {
    const { organization_id, fleet_vehicle_id, imei } = req.body;
    if (!organization_id || !fleet_vehicle_id || !imei) {
      return res.status(400).json({ ok: false, error: 'organization_id, fleet_vehicle_id, and imei required' });
    }

    const sb = getServiceClient();

    // Check if IMEI is already linked to another vehicle
    const { data: existing } = await sb
      .from('fleet_vehicles')
      .select('id, matricula')
      .eq('organization_id', organization_id)
      .eq('xexun_imei', imei)
      .neq('id', fleet_vehicle_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        ok: false,
        error: `Este IMEI ya está vinculado al vehículo ${existing.matricula}`,
      });
    }

    // Link the device
    const { error } = await sb
      .from('fleet_vehicles')
      .update({ xexun_imei: imei })
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id);

    if (error) {
      return res.status(500).json({ ok: false, error: 'Error al vincular dispositivo' });
    }

    // Also update the device_positions record if it exists
    await sb
      .from('device_positions')
      .update({ fleet_vehicle_id })
      .eq('organization_id', organization_id)
      .eq('imei', imei);

    // Update history records too
    await sb
      .from('device_position_history')
      .update({ fleet_vehicle_id })
      .eq('organization_id', organization_id)
      .eq('imei', imei)
      .is('fleet_vehicle_id', null);

    return res.json({ ok: true, message: 'Dispositivo vinculado correctamente' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/unlink-device
 * Unlink a GPS device from a fleet vehicle
 */
export async function handleGpsUnlinkDevice(req: Request, res: Response) {
  try {
    const { organization_id, fleet_vehicle_id } = req.body;
    if (!organization_id || !fleet_vehicle_id) {
      return res.status(400).json({ ok: false, error: 'organization_id and fleet_vehicle_id required' });
    }

    const sb = getServiceClient();

    // Get current IMEI before unlinking
    const { data: vehicle } = await sb
      .from('fleet_vehicles')
      .select('xexun_imei')
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    // Clear the IMEI from fleet_vehicles
    const { error } = await sb
      .from('fleet_vehicles')
      .update({ xexun_imei: null })
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id);

    if (error) {
      return res.status(500).json({ ok: false, error: 'Error al desvincular dispositivo' });
    }

    // Clear fleet_vehicle_id from device_positions
    if (vehicle?.xexun_imei) {
      await sb
        .from('device_positions')
        .update({ fleet_vehicle_id: null })
        .eq('organization_id', organization_id)
        .eq('imei', vehicle.xexun_imei);
    }

    return res.json({ ok: true, message: 'Dispositivo desvinculado correctamente' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/vehicle-by-plate
 * Get GPS device info by vehicle plate number
 */
export async function handleGpsVehicleByPlate(req: Request, res: Response) {
  try {
    const { organization_id, matricula } = req.body;
    if (!organization_id || !matricula) {
      return res.status(400).json({ ok: false, error: 'organization_id and matricula required' });
    }

    const sb = getServiceClient();

    const { data: vehicle } = await sb
      .from('fleet_vehicles')
      .select('id, matricula, marca, modelo, xexun_imei')
      .eq('organization_id', organization_id)
      .ilike('matricula', matricula)
      .maybeSingle();

    if (!vehicle) {
      return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' });
    }

    if (!vehicle.xexun_imei) {
      return res.json({ ok: true, vehicle, device: null, position: null });
    }

    const { data: position } = await sb
      .from('device_positions')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('imei', vehicle.xexun_imei)
      .maybeSingle();

    return res.json({
      ok: true,
      vehicle: {
        fleet_vehicle_id: vehicle.id,
        matricula: vehicle.matricula,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
      },
      device: position ? {
        name: `${vehicle.matricula} - Xexun X24`,
        status: position.device_status,
        lastUpdate: position.last_update,
      } : null,
      position: position ? {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        address: position.address,
        deviceTime: position.last_update,
        valid: position.latitude !== 0 && position.longitude !== 0,
        altitude: position.altitude,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/route-history
 * Get route history for a device within a date range.
 * Body: { organization_id, device_id (IMEI), from, to }
 */
export async function handleGpsRouteHistory(req: Request, res: Response) {
  try {
    const { organization_id, device_id, from, to } = req.body;
    if (!organization_id || !device_id) {
      return res.status(400).json({ ok: false, error: 'organization_id and device_id required' });
    }

    const sb = getServiceClient();

    // Default: today from 00:00 to now
    const now = new Date();
    const fromDate = from || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const toDate = to || now.toISOString();

    const { data: rawPositions, error } = await sb
      .from('device_position_history')
      .select('latitude, longitude, speed, course, altitude, address, device_time, valid, attributes')
      .eq('organization_id', organization_id)
      .eq('imei', device_id)
      .gte('device_time', fromDate)
      .lte('device_time', toDate)
      .eq('valid', true)
      .neq('latitude', 0)
      .neq('longitude', 0)
      .order('device_time', { ascending: true })
      .limit(10000);

    if (error) {
      return res.status(500).json({ ok: false, error: 'Error al obtener historial' });
    }

    const positions = (rawPositions || []).map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed,
      course: p.course,
      address: p.address || null,
      time: p.device_time,
      altitude: p.altitude,
      attributes: p.attributes || {},
    }));

    // Calculate summary stats
    let totalDistanceKm = 0;
    let maxSpeedKmh = 0;
    let movingTimeMs = 0;
    const MOVING_THRESHOLD_KMH = 2;

    for (let i = 0; i < positions.length; i++) {
      if (positions[i].speed > maxSpeedKmh) {
        maxSpeedKmh = positions[i].speed;
      }
      if (i > 0) {
        const prev = positions[i - 1];
        const curr = positions[i];
        // Haversine distance
        const R = 6371;
        const dLat = (curr.lat - prev.lat) * Math.PI / 180;
        const dLon = (curr.lng - prev.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistanceKm += R * c;

        // Moving time
        if (curr.speed > MOVING_THRESHOLD_KMH) {
          const timeDiff = new Date(curr.time).getTime() - new Date(prev.time).getTime();
          if (timeDiff > 0 && timeDiff < 600000) {
            movingTimeMs += timeDiff;
          }
        }
      }
    }

    const summary = {
      totalPoints: positions.length,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      maxSpeedKmh: Math.round(maxSpeedKmh),
      movingTimeMinutes: Math.round(movingTimeMs / 60000),
      startTime: positions.length > 0 ? positions[0].time : null,
      endTime: positions.length > 0 ? positions[positions.length - 1].time : null,
    };

    return res.json({ ok: true, positions, summary });
  } catch (err) {
    console.error('[gps/route-history] Error:', err);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/fleet-status
 * Get comprehensive fleet GPS status summary.
 */
export async function handleGpsFleetStatus(req: Request, res: Response) {
  try {
    const { organization_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    // Get all fleet vehicles with xexun_imei linked
    const { data: fleetVehicles, error: fvError } = await sb
      .from('fleet_vehicles')
      .select('id, matricula, marca, modelo, categoria, xexun_imei')
      .eq('organization_id', organization_id)
      .not('xexun_imei', 'is', null)
      .order('matricula');

    if (fvError) {
      return res.status(500).json({ ok: false, error: 'Error al obtener vehículos' });
    }

    if (!fleetVehicles || fleetVehicles.length === 0) {
      return res.json({ ok: true, vehicles: [], summary: { total: 0, online: 0, offline: 0, lowBattery: 0, noReport24h: 0 } });
    }

    // Get all device positions for this org
    const imeis = fleetVehicles.map(fv => fv.xexun_imei).filter(Boolean);
    const { data: positions } = await sb
      .from('device_positions')
      .select('*')
      .eq('organization_id', organization_id)
      .in('imei', imeis);

    const positionMap = new Map((positions || []).map(p => [p.imei, p]));

    // Build fleet status
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let onlineCount = 0;
    let offlineCount = 0;
    let lowBatteryCount = 0;
    let noReport24hCount = 0;

    const vehicleStatuses = fleetVehicles.map(fv => {
      const position = positionMap.get(fv.xexun_imei!);

      const status = position?.device_status || 'unknown';
      const lastUpdate = position?.last_update || null;
      const lastUpdateMs = lastUpdate ? new Date(lastUpdate).getTime() : 0;
      const minutesSinceUpdate = lastUpdateMs ? Math.round((now - lastUpdateMs) / 60000) : null;

      const batteryLevel = position?.battery_level ?? null;
      const totalDistanceKm = position?.attributes?.totalDistance
        ? Math.round(Number(position.attributes.totalDistance) / 1000)
        : 0;
      const speedKmh = position ? Math.round(position.speed || 0) : 0;

      const isOnline = status === 'online' && (minutesSinceUpdate !== null && minutesSinceUpdate < 10);
      const isLowBattery = batteryLevel !== null && batteryLevel < 15;
      const hasNoReport24h = minutesSinceUpdate !== null && minutesSinceUpdate > 1440;

      if (isOnline) onlineCount++;
      else offlineCount++;
      if (isLowBattery) lowBatteryCount++;
      if (hasNoReport24h) noReport24hCount++;

      return {
        id: fv.id,
        matricula: fv.matricula,
        marca: fv.marca,
        modelo: fv.modelo,
        categoria: fv.categoria,
        deviceName: `Xexun X24 (${fv.xexun_imei})`,
        status: isOnline ? 'online' : 'offline',
        lastUpdate,
        minutesSinceUpdate,
        batteryLevel,
        totalDistanceKm,
        speedKmh,
        latitude: position?.latitude || null,
        longitude: position?.longitude || null,
        address: position?.address || null,
        isOnline,
        isLowBattery,
        hasNoReport24h,
      };
    });

    return res.json({
      ok: true,
      vehicles: vehicleStatuses,
      summary: {
        total: vehicleStatuses.length,
        online: onlineCount,
        offline: offlineCount,
        lowBattery: lowBatteryCount,
        noReport24h: noReport24hCount,
      },
    });
  } catch (err) {
    console.error('[gps/fleet-status] Error:', err);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/gps/fleet-daily-km
 * Get daily km traveled for fleet vehicles over a date range.
 * Body: { organization_id, device_id?, days?: number }
 */
export async function handleGpsFleetDailyKm(req: Request, res: Response) {
  try {
    const { organization_id, device_id, days = 7 } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const numDays = Math.min(Math.max(Number(days) || 7, 1), 30);
    const sb = getServiceClient();

    // Get linked fleet vehicles
    let query = sb
      .from('fleet_vehicles')
      .select('id, matricula, xexun_imei')
      .eq('organization_id', organization_id)
      .not('xexun_imei', 'is', null);

    if (device_id) {
      query = query.eq('xexun_imei', device_id);
    }

    const { data: fleetVehicles, error: fvError } = await query.order('matricula');
    if (fvError || !fleetVehicles || fleetVehicles.length === 0) {
      return res.json({ ok: true, data: [], vehicles: [] });
    }

    // Calculate date range
    const now = new Date();
    const toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const fromDate = new Date(toDate);
    fromDate.setDate(fromDate.getDate() - numDays + 1);
    fromDate.setHours(0, 0, 0, 0);

    const results: Array<{ date: string; vehicleId: string; matricula: string; km: number }> = [];
    const vehicleList: Array<{ id: string; matricula: string; deviceId: string }> = [];

    // Process each vehicle
    for (const fv of fleetVehicles) {
      const imei = fv.xexun_imei!;
      vehicleList.push({ id: fv.id, matricula: fv.matricula, deviceId: imei });

      // Get position history for this period
      const { data: positions } = await sb
        .from('device_position_history')
        .select('latitude, longitude, device_time')
        .eq('organization_id', organization_id)
        .eq('imei', imei)
        .gte('device_time', fromDate.toISOString())
        .lte('device_time', toDate.toISOString())
        .eq('valid', true)
        .neq('latitude', 0)
        .neq('longitude', 0)
        .order('device_time', { ascending: true })
        .limit(50000);

      if (!positions || positions.length === 0) continue;

      // Group positions by day and calculate distance
      const dayMap = new Map<string, Array<{ lat: number; lng: number }>>();
      for (const p of positions) {
        const dateStr = p.device_time.split('T')[0];
        if (!dayMap.has(dateStr)) dayMap.set(dateStr, []);
        dayMap.get(dateStr)!.push({ lat: p.latitude, lng: p.longitude });
      }

      for (const [dateStr, dayPositions] of Array.from(dayMap)) {
        let distKm = 0;
        for (let j = 1; j < dayPositions.length; j++) {
          const prev = dayPositions[j - 1];
          const curr = dayPositions[j];
          const R = 6371;
          const dLat = (curr.lat - prev.lat) * Math.PI / 180;
          const dLon = (curr.lng - prev.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distKm += R * c;
        }
        results.push({
          date: dateStr,
          vehicleId: fv.id,
          matricula: fv.matricula,
          km: Math.round(distKm * 100) / 100,
        });
      }
    }

    // Sort results by date
    results.sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ ok: true, data: results, vehicles: vehicleList });
  } catch (err) {
    console.error('[gps/fleet-daily-km] Error:', err);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}
