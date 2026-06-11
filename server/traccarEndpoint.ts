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
    if (!organization_id || !server_url || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const credentials: TraccarCredentials = { server_url, email, password };
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
