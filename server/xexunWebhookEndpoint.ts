/**
 * Xexun GPS Tracker Webhook Receiver
 * 
 * Receives Data Push from tracker.xexun.com platform.
 * The Xexun platform pushes GPS + OBD data to this endpoint via HTTP POST.
 * 
 * Endpoints:
 * - POST /api/xexun/push          → Receive position + OBD data push from Xexun platform
 * - POST /api/xexun/push/gps      → Receive GPS-only data push
 * - POST /api/xexun/push/obd      → Receive OBD-only data push
 * - POST /api/xexun/push/alarm    → Receive alarm notifications
 */
import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const getServiceClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Validate the push secret if configured
 */
async function validatePushSecret(req: Request): Promise<{ valid: boolean; organizationId?: string }> {
  const secret = req.headers['x-push-secret'] as string || req.query.secret as string;
  const sb = getServiceClient();

  // If a secret is provided, validate it
  if (secret) {
    const { data } = await sb
      .from('integration_settings')
      .select('organization_id')
      .eq('xexun_push_secret', secret)
      .eq('xexun_enabled', true)
      .maybeSingle();

    if (data) {
      return { valid: true, organizationId: data.organization_id };
    }
    return { valid: false };
  }

  // If no secret, try to find the first enabled Xexun org (single-tenant mode)
  const { data: defaultOrg } = await sb
    .from('integration_settings')
    .select('organization_id')
    .eq('xexun_enabled', true)
    .limit(1)
    .maybeSingle();

  if (defaultOrg) {
    return { valid: true, organizationId: defaultOrg.organization_id };
  }

  return { valid: false };
}

/**
 * Find the fleet_vehicle_id linked to a given IMEI
 */
async function findVehicleByImei(organizationId: string, imei: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('fleet_vehicles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('xexun_imei', imei)
    .maybeSingle();

  return data?.id || null;
}

/**
 * Upsert the latest position for a device (device_positions table)
 */
async function upsertLatestPosition(
  organizationId: string,
  imei: string,
  fleetVehicleId: string | null,
  positionData: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    course?: number;
    address?: string;
    battery_level?: number;
    attributes?: Record<string, unknown>;
  }
) {
  const sb = getServiceClient();

  const record = {
    organization_id: organizationId,
    imei,
    fleet_vehicle_id: fleetVehicleId,
    latitude: positionData.latitude,
    longitude: positionData.longitude,
    altitude: positionData.altitude || 0,
    speed: positionData.speed || 0,
    course: positionData.course || 0,
    address: positionData.address || null,
    battery_level: positionData.battery_level ?? null,
    device_status: 'online' as const,
    last_update: new Date().toISOString(),
    attributes: positionData.attributes || {},
  };

  await sb
    .from('device_positions')
    .upsert(record, { onConflict: 'organization_id,imei' });
}

/**
 * Insert a position into the history table
 */
async function insertPositionHistory(
  organizationId: string,
  imei: string,
  fleetVehicleId: string | null,
  positionData: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    course?: number;
    address?: string;
    device_time: string;
    valid?: boolean;
    attributes?: Record<string, unknown>;
  }
) {
  const sb = getServiceClient();

  await sb.from('device_position_history').insert({
    organization_id: organizationId,
    imei,
    fleet_vehicle_id: fleetVehicleId,
    latitude: positionData.latitude,
    longitude: positionData.longitude,
    altitude: positionData.altitude || 0,
    speed: positionData.speed || 0,
    course: positionData.course || 0,
    address: positionData.address || null,
    device_time: positionData.device_time,
    valid: positionData.valid ?? true,
    attributes: positionData.attributes || {},
  });
}

/**
 * POST /api/xexun/push
 * Main webhook endpoint - receives combined GPS + OBD data from Xexun platform.
 * 
 * Expected payload format (from Xexun Data Push):
 * {
 *   imei: string,
 *   lat: number,        // latitude
 *   lng: number,        // longitude  
 *   speed: number,      // km/h
 *   course: number,     // heading degrees
 *   altitude: number,   // meters
 *   gpsTime: number,    // UTC timestamp (seconds or ms)
 *   battery: number,    // battery percentage
 *   acc: number,        // ACC status (0/1)
 *   // OBD fields (optional)
 *   oil: number,
 *   rpm: number,
 *   coolantTemp: number,
 *   engineLoad: number,
 *   throttlePos: number,
 *   dist: number,       // total distance
 *   dtc: string,        // fault code
 * }
 * 
 * Also supports array format: [{ imei, lat, lng, ... }, ...]
 */
export async function handleXexunPush(req: Request, res: Response) {
  try {
    const { valid, organizationId } = await validatePushSecret(req);
    if (!valid || !organizationId) {
      return res.status(401).json({ success: false, msg: "Invalid or missing push secret" });
    }

    // Normalize input: accept single object or array
    const payloads = Array.isArray(req.body) ? req.body : [req.body];

    let processed = 0;
    let errors = 0;

    for (const payload of payloads) {
      try {
        const imei = payload.imei || payload.IMEI || payload.deviceImei;
        if (!imei) {
          errors++;
          continue;
        }

        const fleetVehicleId = await findVehicleByImei(organizationId, imei);

        // Extract GPS position
        const latitude = parseFloat(payload.lat || payload.latitude || payload.Lat || 0);
        const longitude = parseFloat(payload.lng || payload.longitude || payload.Lng || payload.lon || 0);
        const speed = parseFloat(payload.speed || payload.Speed || 0);
        const course = parseFloat(payload.course || payload.heading || payload.Course || 0);
        const altitude = parseFloat(payload.altitude || payload.Altitude || payload.alt || 0);
        const battery = payload.battery != null ? parseInt(payload.battery) :
                        payload.batteryLevel != null ? parseInt(payload.batteryLevel) : null;

        // Extract timestamp
        let deviceTime: string;
        const rawTime = payload.gpsTime || payload.gps_time || payload.timestamp || payload.time || payload.deviceTime;
        if (rawTime) {
          // Handle both seconds and milliseconds timestamps
          const ts = Number(rawTime);
          if (ts > 1e12) {
            deviceTime = new Date(ts).toISOString();
          } else if (ts > 1e9) {
            deviceTime = new Date(ts * 1000).toISOString();
          } else {
            deviceTime = new Date().toISOString();
          }
        } else {
          deviceTime = new Date().toISOString();
        }

        // Build attributes (OBD data + extras)
        const attributes: Record<string, unknown> = {};
        if (payload.oil != null) attributes.oil = payload.oil;
        if (payload.rpm != null) attributes.rpm = payload.rpm;
        if (payload.coolantTemp != null) attributes.coolantTemp = payload.coolantTemp;
        if (payload.engineLoad != null) attributes.engineLoad = payload.engineLoad;
        if (payload.throttlePos != null) attributes.throttlePos = payload.throttlePos;
        if (payload.dist != null) attributes.totalDistance = payload.dist;
        if (payload.dtc != null) attributes.dtc = payload.dtc;
        if (payload.dtc2 != null) attributes.dtc2 = payload.dtc2;
        if (payload.ambientTemp != null) attributes.ambientTemp = payload.ambientTemp;
        if (payload.intakeAirTemperature != null) attributes.intakeAirTemp = payload.intakeAirTemperature;
        if (payload.airFlowRate != null) attributes.airFlowRate = payload.airFlowRate;
        if (payload.airPressure != null) attributes.airPressure = payload.airPressure;
        if (payload.runTime != null) attributes.engineRunTime = payload.runTime;
        if (payload.fuelSystemStatusA != null) attributes.fuelSystemA = payload.fuelSystemStatusA;
        if (payload.fuelSystemStatusB != null) attributes.fuelSystemB = payload.fuelSystemStatusB;
        if (payload.acc != null) attributes.acc = payload.acc;
        if (payload.alarm != null) attributes.alarm = payload.alarm;
        if (payload.protocolType != null) attributes.obdProtocol = payload.protocolType;

        // Only store position if we have valid coordinates
        const hasValidPosition = latitude !== 0 && longitude !== 0;

        if (hasValidPosition) {
          // Update latest position
          await upsertLatestPosition(organizationId, imei, fleetVehicleId, {
            latitude,
            longitude,
            altitude,
            speed,
            course,
            battery_level: battery ?? undefined,
            attributes,
          });

          // Insert into history
          await insertPositionHistory(organizationId, imei, fleetVehicleId, {
            latitude,
            longitude,
            altitude,
            speed,
            course,
            device_time: deviceTime,
            valid: true,
            attributes,
          });
        } else {
          // Even without GPS, update device status and OBD data
          const sb = getServiceClient();
          await sb
            .from('device_positions')
            .upsert({
              organization_id: organizationId,
              imei,
              fleet_vehicle_id: fleetVehicleId,
              latitude: 0,
              longitude: 0,
              device_status: 'online',
              last_update: new Date().toISOString(),
              battery_level: battery ?? null,
              attributes,
            }, { onConflict: 'organization_id,imei' });
        }

        processed++;
      } catch (err) {
        console.error('[xexun/push] Error processing payload:', err);
        errors++;
      }
    }

    return res.json({
      success: true,
      msg: "Request succeeded",
      processed,
      errors,
    });
  } catch (err) {
    console.error('[xexun/push] Error:', err);
    return res.status(500).json({ success: false, msg: "Internal server error" });
  }
}

/**
 * POST /api/xexun/push/gps
 * GPS-only data push endpoint.
 * Delegates to the main push handler.
 */
export async function handleXexunPushGps(req: Request, res: Response) {
  return handleXexunPush(req, res);
}

/**
 * POST /api/xexun/push/obd
 * OBD-only data push endpoint (no GPS coordinates expected).
 */
export async function handleXexunPushObd(req: Request, res: Response) {
  try {
    const { valid, organizationId } = await validatePushSecret(req);
    if (!valid || !organizationId) {
      return res.status(401).json({ success: false, msg: "Invalid or missing push secret" });
    }

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    let processed = 0;

    for (const payload of payloads) {
      const imei = payload.imei || payload.IMEI;
      if (!imei) continue;

      const fleetVehicleId = await findVehicleByImei(organizationId, imei);
      const sb = getServiceClient();

      // Build OBD attributes
      const attributes: Record<string, unknown> = {};
      if (payload.oil != null) attributes.oil = payload.oil;
      if (payload.speed != null) attributes.obdSpeed = payload.speed;
      if (payload.rpm != null) attributes.rpm = payload.rpm;
      if (payload.coolantTemp != null) attributes.coolantTemp = payload.coolantTemp;
      if (payload.engineLoad != null) attributes.engineLoad = payload.engineLoad;
      if (payload.throttlePos != null) attributes.throttlePos = payload.throttlePos;
      if (payload.dist != null) attributes.totalDistance = payload.dist;
      if (payload.dtc != null) attributes.dtc = payload.dtc;
      if (payload.dtc2 != null) attributes.dtc2 = payload.dtc2;
      if (payload.ambientTemp != null) attributes.ambientTemp = payload.ambientTemp;
      if (payload.intakeAirTemperature != null) attributes.intakeAirTemp = payload.intakeAirTemperature;
      if (payload.runTime != null) attributes.engineRunTime = payload.runTime;
      if (payload.protocolType != null) attributes.obdProtocol = payload.protocolType;

      // Update the device's attributes with OBD data
      const { data: existing } = await sb
        .from('device_positions')
        .select('attributes')
        .eq('organization_id', organizationId)
        .eq('imei', imei)
        .maybeSingle();

      const mergedAttributes = { ...(existing?.attributes || {}), ...attributes };

      await sb
        .from('device_positions')
        .upsert({
          organization_id: organizationId,
          imei,
          fleet_vehicle_id: fleetVehicleId,
          latitude: 0,
          longitude: 0,
          device_status: 'online',
          last_update: new Date().toISOString(),
          attributes: mergedAttributes,
        }, { onConflict: 'organization_id,imei' });

      processed++;
    }

    return res.json({ success: true, msg: "Request succeeded", processed });
  } catch (err) {
    console.error('[xexun/push/obd] Error:', err);
    return res.status(500).json({ success: false, msg: "Internal server error" });
  }
}

/**
 * POST /api/xexun/push/alarm
 * Alarm notification push endpoint.
 */
export async function handleXexunPushAlarm(req: Request, res: Response) {
  try {
    const { valid, organizationId } = await validatePushSecret(req);
    if (!valid || !organizationId) {
      return res.status(401).json({ success: false, msg: "Invalid or missing push secret" });
    }

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    let processed = 0;

    for (const payload of payloads) {
      const imei = payload.imei || payload.IMEI;
      if (!imei) continue;

      const fleetVehicleId = await findVehicleByImei(organizationId, imei);
      const sb = getServiceClient();

      // Store alarm in attributes
      const alarmData: Record<string, unknown> = {
        lastAlarm: {
          type: payload.alarmType || payload.alarm_type || payload.type || 'unknown',
          value: payload.alarmValue || payload.alarm_value || payload.value || null,
          time: new Date().toISOString(),
        },
      };

      // Update device position with alarm info
      const { data: existing } = await sb
        .from('device_positions')
        .select('attributes')
        .eq('organization_id', organizationId)
        .eq('imei', imei)
        .maybeSingle();

      const mergedAttributes = { ...(existing?.attributes || {}), ...alarmData };

      await sb
        .from('device_positions')
        .upsert({
          organization_id: organizationId,
          imei,
          fleet_vehicle_id: fleetVehicleId,
          latitude: 0,
          longitude: 0,
          device_status: 'online',
          last_update: new Date().toISOString(),
          attributes: mergedAttributes,
        }, { onConflict: 'organization_id,imei' });

      processed++;
    }

    return res.json({ success: true, msg: "Request succeeded", processed });
  } catch (err) {
    console.error('[xexun/push/alarm] Error:', err);
    return res.status(500).json({ success: false, msg: "Internal server error" });
  }
}
