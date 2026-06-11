/**
 * Traccar GPS Tracking Integration Endpoint
 * Proxies requests to the Traccar server API for vehicle tracking.
 * 
 * Endpoints:
 * - POST /api/traccar/devices       → List all devices from Traccar
 * - POST /api/traccar/positions      → Get last known positions (all or single device)
 * - POST /api/traccar/device-position → Get position for a specific vehicle (by fleet_vehicle_id)
 * - POST /api/traccar/settings       → Get/update Traccar settings
 * - POST /api/traccar/link-device    → Link a Traccar device to a fleet vehicle
 * - POST /api/traccar/unlink-device  → Unlink a Traccar device from a fleet vehicle
 * - POST /api/traccar/test-connection → Test Traccar server connection
 */
import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const getServiceClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface TraccarCredentials {
  server_url: string;
  email: string;
  password: string;
}

/**
 * Get Traccar credentials from integration_settings for a given organization
 */
async function getTraccarCredentials(organizationId: string): Promise<TraccarCredentials | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('integration_settings')
    .select('traccar_server_url, traccar_email, traccar_password')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.traccar_server_url || !data.traccar_email || !data.traccar_password) return null;

  return {
    server_url: data.traccar_server_url,
    email: data.traccar_email,
    password: data.traccar_password,
  };
}

/**
 * Make an authenticated request to the Traccar API
 */
async function traccarFetch(
  credentials: TraccarCredentials,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const { server_url, email, password } = credentials;
  const url = `${server_url.replace(/\/$/, '')}/api${path}`;
  const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');

  try {
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, status: response.status, error: errorText };
    }

    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * POST /api/traccar/test-connection
 * Test connection to Traccar server
 */
export async function handleTraccarTestConnection(req: Request, res: Response) {
  try {
    const { organization_id, server_url, email, password } = req.body;
    if (!organization_id || !server_url || !email) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // If no password provided, try to use the stored one
    let finalPassword = password;
    if (!finalPassword) {
      const stored = await getTraccarCredentials(organization_id);
      if (stored) {
        finalPassword = stored.password;
      }
    }

    if (!finalPassword) {
      return res.status(400).json({ ok: false, error: 'Contraseña requerida' });
    }

    const credentials: TraccarCredentials = { server_url, email, password: finalPassword };
    const result = await traccarFetch(credentials, '/devices?limit=1');

    if (result.ok) {
      return res.json({ ok: true, message: 'Conexión exitosa con Traccar' });
    } else {
      return res.json({ ok: false, error: `Error de conexión: ${result.error || result.status}` });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/devices
 * List all devices from Traccar
 */
export async function handleTraccarDevices(req: Request, res: Response) {
  try {
    const { organization_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado para esta organización' });
    }

    const result = await traccarFetch(credentials, '/devices');
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: `Error Traccar: ${result.error}` });
    }

    return res.json({ ok: true, devices: result.data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/positions
 * Get last known positions. If device_id is provided, returns only that device's position.
 */
export async function handleTraccarPositions(req: Request, res: Response) {
  try {
    const { organization_id, device_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado para esta organización' });
    }

    const path = device_id ? `/positions?deviceId=${device_id}` : '/positions';
    const result = await traccarFetch(credentials, path);
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: `Error Traccar: ${result.error}` });
    }

    return res.json({ ok: true, positions: result.data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/device-position
 * Get position for a specific fleet vehicle (by fleet_vehicle_id).
 * Resolves fleet_vehicle_id → traccar_device_id → position.
 */
export async function handleTraccarDevicePosition(req: Request, res: Response) {
  try {
    const { organization_id, fleet_vehicle_id } = req.body;
    if (!organization_id || !fleet_vehicle_id) {
      return res.status(400).json({ ok: false, error: 'organization_id and fleet_vehicle_id required' });
    }

    const sb = getServiceClient();

    // Get the traccar_device_id for this fleet vehicle
    const { data: vehicle, error: vError } = await sb
      .from('fleet_vehicles')
      .select('traccar_device_id, matricula, marca, modelo')
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (vError || !vehicle) {
      return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' });
    }

    if (!vehicle.traccar_device_id) {
      return res.json({ ok: true, position: null, message: 'Vehículo sin localizador vinculado' });
    }

    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado' });
    }

    // Get last known position for this device
    const result = await traccarFetch(credentials, `/positions?deviceId=${vehicle.traccar_device_id}`);
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: `Error Traccar: ${result.error}` });
    }

    const positions = result.data as Array<{
      id: number;
      deviceId: number;
      latitude: number;
      longitude: number;
      speed: number;
      course: number;
      address: string;
      deviceTime: string;
      fixTime: string;
      valid: boolean;
      altitude: number;
      attributes: Record<string, unknown>;
    }>;

    // Also get device status
    const deviceResult = await traccarFetch(credentials, `/devices?id=${vehicle.traccar_device_id}`);
    const devices = (deviceResult.ok ? deviceResult.data : []) as Array<{
      id: number;
      name: string;
      status: string;
      lastUpdate: string;
    }>;

    const position = positions.length > 0 ? positions[0] : null;
    const device = devices.length > 0 ? devices[0] : null;

    return res.json({
      ok: true,
      vehicle: {
        matricula: vehicle.matricula,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
      },
      device: device ? {
        name: device.name,
        status: device.status,
        lastUpdate: device.lastUpdate,
      } : null,
      position: position ? {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        address: position.address,
        deviceTime: position.deviceTime,
        valid: position.valid,
        altitude: position.altitude,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/link-device
 * Link a Traccar device to a fleet vehicle
 */
export async function handleTraccarLinkDevice(req: Request, res: Response) {
  try {
    const { organization_id, fleet_vehicle_id, traccar_device_id } = req.body;
    if (!organization_id || !fleet_vehicle_id || !traccar_device_id) {
      return res.status(400).json({ ok: false, error: 'organization_id, fleet_vehicle_id, and traccar_device_id required' });
    }

    const sb = getServiceClient();

    // Verify the vehicle belongs to this org
    const { data: vehicle, error: vError } = await sb
      .from('fleet_vehicles')
      .select('id')
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (vError || !vehicle) {
      return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' });
    }

    // Check no other vehicle has this device linked
    const { data: existing } = await sb
      .from('fleet_vehicles')
      .select('id, matricula')
      .eq('traccar_device_id', traccar_device_id)
      .eq('organization_id', organization_id)
      .neq('id', fleet_vehicle_id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        ok: false,
        error: `Este dispositivo ya está vinculado al vehículo ${existing.matricula}`,
      });
    }

    // Update the fleet vehicle
    const { error: updateError } = await sb
      .from('fleet_vehicles')
      .update({ traccar_device_id: traccar_device_id })
      .eq('id', fleet_vehicle_id);

    if (updateError) {
      return res.status(500).json({ ok: false, error: 'Error al vincular dispositivo' });
    }

    return res.json({ ok: true, message: 'Dispositivo vinculado correctamente' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/unlink-device
 * Unlink a Traccar device from a fleet vehicle
 */
export async function handleTraccarUnlinkDevice(req: Request, res: Response) {
  try {
    const { organization_id, fleet_vehicle_id } = req.body;
    if (!organization_id || !fleet_vehicle_id) {
      return res.status(400).json({ ok: false, error: 'organization_id and fleet_vehicle_id required' });
    }

    const sb = getServiceClient();

    const { error } = await sb
      .from('fleet_vehicles')
      .update({ traccar_device_id: null })
      .eq('id', fleet_vehicle_id)
      .eq('organization_id', organization_id);

    if (error) {
      return res.status(500).json({ ok: false, error: 'Error al desvincular dispositivo' });
    }

    return res.json({ ok: true, message: 'Dispositivo desvinculado' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/settings
 * Get or update Traccar settings for the organization
 */
export async function handleTraccarSettings(req: Request, res: Response) {
  try {
    const { organization_id, _method, traccar_server_url, traccar_email, traccar_password } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    if (_method === 'GET' || (!traccar_server_url && !traccar_email && !traccar_password && !_method)) {
      // GET settings
      const { data, error } = await sb
        .from('integration_settings')
        .select('traccar_server_url, traccar_email, traccar_password')
        .eq('organization_id', organization_id)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ ok: false, error: 'Error al obtener configuración' });
      }

      return res.json({
        ok: true,
        settings: data ? {
          traccar_server_url: data.traccar_server_url || '',
          traccar_email: data.traccar_email || '',
          traccar_password: data.traccar_password ? '••••••••' : '',
          has_password: !!data.traccar_password,
        } : null,
      });
    }

    // UPDATE settings
    const updates: Record<string, string | null> = {};
    if (traccar_server_url !== undefined) updates.traccar_server_url = traccar_server_url || null;
    if (traccar_email !== undefined) updates.traccar_email = traccar_email || null;
    if (traccar_password !== undefined) updates.traccar_password = traccar_password || null;

    // Check if row exists
    const { data: existing } = await sb
      .from('integration_settings')
      .select('id')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from('integration_settings')
        .update(updates)
        .eq('organization_id', organization_id);

      if (error) {
        return res.status(500).json({ ok: false, error: 'Error al actualizar configuración' });
      }
    } else {
      const { error } = await sb
        .from('integration_settings')
        .insert({ organization_id, ...updates });

      if (error) {
        return res.status(500).json({ ok: false, error: 'Error al crear configuración' });
      }
    }

    return res.json({ ok: true, message: 'Configuración actualizada' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/vehicle-by-plate
 * Get position for a vehicle by its matricula (plate number).
 * Resolves matricula → fleet_vehicles.traccar_device_id → position.
 * Used by the delivery operation to show the assigned vehicle's location.
 */
export async function handleTraccarVehicleByPlate(req: Request, res: Response) {
  try {
    const { organization_id, matricula } = req.body;
    if (!organization_id || !matricula) {
      return res.status(400).json({ ok: false, error: 'organization_id and matricula required' });
    }

    const sb = getServiceClient();
    const normalizedPlate = matricula.replace(/\s+/g, '').toUpperCase();

    // Find fleet_vehicle by matricula
    const { data: fleetVehicles, error: fvError } = await sb
      .from('fleet_vehicles')
      .select('id, traccar_device_id, matricula, marca, modelo')
      .eq('organization_id', organization_id);

    if (fvError) {
      return res.status(500).json({ ok: false, error: 'Error al buscar vehículo' });
    }

    // Find matching vehicle by normalized plate
    const vehicle = (fleetVehicles || []).find(
      fv => fv.matricula && fv.matricula.replace(/\s+/g, '').toUpperCase() === normalizedPlate
    );

    if (!vehicle) {
      return res.json({ ok: true, position: null, message: 'Vehículo no encontrado en la flota' });
    }

    if (!vehicle.traccar_device_id) {
      return res.json({ ok: true, position: null, message: 'Vehículo sin localizador vinculado' });
    }

    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado' });
    }

    // Get last known position for this device
    const result = await traccarFetch(credentials, `/positions?deviceId=${vehicle.traccar_device_id}`);
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: `Error Traccar: ${result.error}` });
    }

    const positions = result.data as Array<{
      id: number;
      deviceId: number;
      latitude: number;
      longitude: number;
      speed: number;
      course: number;
      address: string;
      deviceTime: string;
      fixTime: string;
      valid: boolean;
      altitude: number;
      attributes: Record<string, unknown>;
    }>;

    // Also get device status
    const deviceResult = await traccarFetch(credentials, `/devices?id=${vehicle.traccar_device_id}`);
    const devices = (deviceResult.ok ? deviceResult.data : []) as Array<{
      id: number;
      name: string;
      status: string;
      lastUpdate: string;
    }>;

    const position = positions.length > 0 ? positions[0] : null;
    const device = devices.length > 0 ? devices[0] : null;

    return res.json({
      ok: true,
      vehicle: {
        fleet_vehicle_id: vehicle.id,
        matricula: vehicle.matricula,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
      },
      device: device ? {
        name: device.name,
        status: device.status,
        lastUpdate: device.lastUpdate,
      } : null,
      position: position ? {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        address: position.address,
        deviceTime: position.deviceTime,
        valid: position.valid,
        altitude: position.altitude,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/route-history
 * Get route history for a device within a date range.
 * Uses Traccar's /api/reports/route endpoint.
 * Body: { organization_id, device_id, from, to }
 * - from/to: ISO date strings (e.g. "2026-06-11T00:00:00Z")
 */
export async function handleTraccarRouteHistory(req: Request, res: Response) {
  try {
    const { organization_id, device_id, from, to } = req.body;
    if (!organization_id || !device_id) {
      return res.status(400).json({ ok: false, error: 'organization_id and device_id required' });
    }

    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado' });
    }

    // Default: today from 00:00 to now
    const now = new Date();
    const fromDate = from || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const toDate = to || now.toISOString();

    // Traccar reports/route returns all positions for the device in the given time range
    const encodedFrom = encodeURIComponent(fromDate);
    const encodedTo = encodeURIComponent(toDate);
    const path = `/reports/route?deviceId=${device_id}&from=${encodedFrom}&to=${encodedTo}`;

    const result = await traccarFetch(credentials, path);
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: `Error Traccar: ${result.error}` });
    }

    const rawPositions = (result.data || []) as Array<{
      id: number;
      deviceId: number;
      latitude: number;
      longitude: number;
      speed: number;
      course: number;
      address: string;
      deviceTime: string;
      fixTime: string;
      valid: boolean;
      altitude: number;
      attributes: Record<string, unknown>;
    }>;

    // Filter valid positions and map to frontend-friendly format
    const positions = rawPositions
      .filter(p => p.valid && p.latitude !== 0 && p.longitude !== 0)
      .map(p => ({
        lat: p.latitude,
        lng: p.longitude,
        speed: p.speed, // knots
        course: p.course,
        address: p.address || null,
        time: p.fixTime || p.deviceTime,
        altitude: p.altitude,
        attributes: p.attributes || {},
      }));

    // Calculate summary stats
    let totalDistanceKm = 0;
    let maxSpeedKnots = 0;
    let movingTimeMs = 0;
    const MOVING_THRESHOLD_KNOTS = 1; // ~1.85 km/h

    for (let i = 0; i < positions.length; i++) {
      if (positions[i].speed > maxSpeedKnots) {
        maxSpeedKnots = positions[i].speed;
      }
      if (i > 0) {
        const prev = positions[i - 1];
        const curr = positions[i];
        // Haversine distance
        const R = 6371; // km
        const dLat = (curr.lat - prev.lat) * Math.PI / 180;
        const dLon = (curr.lng - prev.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistanceKm += R * c;

        // Moving time
        if (curr.speed > MOVING_THRESHOLD_KNOTS) {
          const timeDiff = new Date(curr.time).getTime() - new Date(prev.time).getTime();
          if (timeDiff > 0 && timeDiff < 600000) { // max 10 min gap
            movingTimeMs += timeDiff;
          }
        }
      }
    }

    const summary = {
      totalPoints: positions.length,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      maxSpeedKmh: Math.round(maxSpeedKnots * 1.852),
      movingTimeMinutes: Math.round(movingTimeMs / 60000),
      startTime: positions.length > 0 ? positions[0].time : null,
      endTime: positions.length > 0 ? positions[positions.length - 1].time : null,
    };

    return res.json({ ok: true, positions, summary });
  } catch (err) {
    console.error('[traccar/route-history] Error:', err);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/fleet-status
 * Get a comprehensive fleet status summary combining:
 * - All linked fleet vehicles
 * - Their Traccar device status (online/offline/unknown)
 * - Last known position with battery level
 * - Total distance (odometer) from Traccar attributes
 * 
 * Returns a flat array of vehicle status objects for the dashboard.
 */
export async function handleTraccarFleetStatus(req: Request, res: Response) {
  try {
    const { organization_id } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const sb = getServiceClient();

    // 1. Get all fleet vehicles with traccar_device_id linked
    const { data: fleetVehicles, error: fvError } = await sb
      .from('fleet_vehicles')
      .select('id, matricula, marca, modelo, categoria, traccar_device_id')
      .eq('organization_id', organization_id)
      .not('traccar_device_id', 'is', null)
      .order('matricula');

    if (fvError) {
      return res.status(500).json({ ok: false, error: 'Error al obtener vehículos' });
    }

    if (!fleetVehicles || fleetVehicles.length === 0) {
      return res.json({ ok: true, vehicles: [], summary: { total: 0, online: 0, offline: 0, lowBattery: 0, noReport24h: 0 } });
    }

    // 2. Get Traccar credentials
    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado para esta organización' });
    }

    // 3. Fetch all devices and positions from Traccar in parallel
    const [devicesResult, positionsResult] = await Promise.all([
      traccarFetch(credentials, '/devices'),
      traccarFetch(credentials, '/positions'),
    ]);

    if (!devicesResult.ok || !positionsResult.ok) {
      return res.status(502).json({ ok: false, error: 'Error al conectar con Traccar' });
    }

    const devices = (devicesResult.data || []) as Array<{
      id: number;
      name: string;
      uniqueId: string;
      status: string;
      lastUpdate: string;
      positionId: number;
      attributes: Record<string, unknown>;
    }>;

    const positions = (positionsResult.data || []) as Array<{
      id: number;
      deviceId: number;
      latitude: number;
      longitude: number;
      speed: number;
      course: number;
      address: string;
      deviceTime: string;
      fixTime: string;
      valid: boolean;
      attributes: Record<string, unknown>;
    }>;

    // Index devices and positions by deviceId
    const deviceMap = new Map(devices.map(d => [d.id, d]));
    const positionMap = new Map(positions.map(p => [p.deviceId, p]));

    // 4. Build fleet status for each linked vehicle
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let onlineCount = 0;
    let offlineCount = 0;
    let lowBatteryCount = 0;
    let noReport24hCount = 0;

    const vehicleStatuses = fleetVehicles.map(fv => {
      const deviceId = Number(fv.traccar_device_id);
      const device = deviceMap.get(deviceId);
      const position = positionMap.get(deviceId);

      const status = device?.status || 'unknown';
      const lastUpdate = device?.lastUpdate || null;
      const lastUpdateMs = lastUpdate ? new Date(lastUpdate).getTime() : 0;
      const minutesSinceUpdate = lastUpdateMs ? Math.round((now - lastUpdateMs) / 60000) : null;

      // Battery from position attributes
      const batteryLevel = position?.attributes?.batteryLevel != null
        ? Number(position.attributes.batteryLevel)
        : null;

      // Total distance (odometer) from device or position attributes — Traccar stores in meters
      const totalDistanceMeters = (position?.attributes?.totalDistance as number)
        || (device?.attributes?.totalDistance as number)
        || 0;
      const totalDistanceKm = Math.round(totalDistanceMeters / 1000);

      // Speed in km/h (Traccar returns knots)
      const speedKmh = position ? Math.round(position.speed * 1.852) : 0;

      // Determine flags
      const isOnline = status === 'online';
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
        deviceName: device?.name || `Device ${deviceId}`,
        status,
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
    console.error('[traccar/fleet-status] Error:', err);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /api/traccar/fleet-daily-km
 * Get daily km traveled for one or all linked fleet vehicles over a date range.
 * Uses Traccar's /api/reports/summary endpoint which returns per-device daily summaries.
 * 
 * Body: { organization_id, device_id?, days?: number }
 * - device_id: optional, if omitted returns data for all linked vehicles
 * - days: number of days to look back (default 7, max 30)
 * 
 * Returns: { ok, data: Array<{ date, vehicleId, matricula, km }> }
 */
export async function handleTraccarFleetDailyKm(req: Request, res: Response) {
  try {
    const { organization_id, device_id, days = 7 } = req.body;
    if (!organization_id) {
      return res.status(400).json({ ok: false, error: 'organization_id required' });
    }

    const numDays = Math.min(Math.max(Number(days) || 7, 1), 30);
    const sb = getServiceClient();

    // Get Traccar credentials
    const credentials = await getTraccarCredentials(organization_id);
    if (!credentials) {
      return res.status(400).json({ ok: false, error: 'Traccar no configurado' });
    }

    // Get linked fleet vehicles
    let query = sb
      .from('fleet_vehicles')
      .select('id, matricula, traccar_device_id')
      .eq('organization_id', organization_id)
      .not('traccar_device_id', 'is', null);

    if (device_id) {
      query = query.eq('traccar_device_id', device_id);
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

    const encodedFrom = encodeURIComponent(fromDate.toISOString());
    const encodedTo = encodeURIComponent(toDate.toISOString());

    // Fetch route data for each vehicle in parallel (max 10 concurrent)
    const results: Array<{ date: string; vehicleId: string; matricula: string; km: number }> = [];
    const vehicleList: Array<{ id: string; matricula: string; deviceId: string }> = [];

    // Process vehicles in batches of 5 to avoid overwhelming Traccar
    const BATCH_SIZE = 5;
    for (let i = 0; i < fleetVehicles.length; i += BATCH_SIZE) {
      const batch = fleetVehicles.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (fv) => {
        const deviceId = fv.traccar_device_id;
        vehicleList.push({ id: fv.id, matricula: fv.matricula, deviceId });

        // Try Traccar's summary report first (more efficient)
        const summaryPath = `/reports/summary?deviceId=${deviceId}&from=${encodedFrom}&to=${encodedTo}&daily=true`;
        const summaryResult = await traccarFetch(credentials, summaryPath);

        if (summaryResult.ok && Array.isArray(summaryResult.data)) {
          // Traccar summary report returns daily entries with distance
          const summaries = summaryResult.data as Array<{
            deviceId: number;
            distance: number; // meters
            startTime: string;
            endTime: string;
          }>;

          for (const s of summaries) {
            const dateStr = s.startTime ? s.startTime.split('T')[0] : null;
            if (dateStr) {
              results.push({
                date: dateStr,
                vehicleId: fv.id,
                matricula: fv.matricula,
                km: Math.round((s.distance || 0) / 1000 * 100) / 100,
              });
            }
          }
        } else {
          // Fallback: use route reports and calculate distance manually per day
          const routePath = `/reports/route?deviceId=${deviceId}&from=${encodedFrom}&to=${encodedTo}`;
          const routeResult = await traccarFetch(credentials, routePath);

          if (routeResult.ok && Array.isArray(routeResult.data)) {
            const positions = (routeResult.data as Array<{
              latitude: number;
              longitude: number;
              fixTime: string;
              valid: boolean;
            }>).filter(p => p.valid && p.latitude !== 0 && p.longitude !== 0);

            // Group positions by day and calculate distance
            const dayMap = new Map<string, Array<{ lat: number; lng: number }>>();
            for (const p of positions) {
              const dateStr = p.fixTime.split('T')[0];
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
        }
      }));
    }

    // Sort results by date
    results.sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      ok: true,
      data: results,
      vehicles: vehicleList,
      dateRange: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
    });
  } catch (err) {
    console.error('[traccar/fleet-daily-km] Error:', err);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
}
