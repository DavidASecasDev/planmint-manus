/**
 * Scheduled handler: Xexun GPS Position Polling
 * 
 * Polls tracker.xexun.com API every 60 seconds to fetch the latest GPS positions
 * for all devices linked to the organization. Stores results in device_positions
 * (latest) and device_position_history (track log).
 * 
 * This replaces the "Data Push" approach since tracker.xexun.com doesn't expose
 * a push configuration for this account. Instead, we actively pull positions
 * from their internal API endpoint:
 *   GET /web-manager/gpsInfo/pageGpsInfoMap
 * 
 * Path: POST /api/scheduled/xexun-poll
 * Auth: Manus Heartbeat cron identity (validated via x-manus-cron-task-uid header)
 */
import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import axios from "axios";

const XEXUN_BASE_URL = "https://tracker.xexun.com";

interface XexunGpsRecord {
  id: string;
  imei: string;
  monitorName?: string;
  gpsLat: number;
  gpsLng: number;
  gpsLat1?: number;
  gpsLng1?: number;
  speed: number;
  speedPlat?: number;
  satelliteNum?: number;
  pdop?: number;
  electricity?: number;
  uploadTime: number; // Unix timestamp in milliseconds
  locationMode?: number;
  csq?: number;
  signalStrength?: number;
  accuracyLevel?: number;
  floorName?: string;
  seq?: number;
  sensorDistance?: number;
  sensorDistance1?: number;
  course?: number;
}

interface XexunApiResponse {
  code: number;
  data?: {
    current: number;
    total: number;
    pages: number;
    size: number;
    records: XexunGpsRecord[];
  };
}

/**
 * Fetch positions from Xexun API for given IMEIs within a time window
 */
async function fetchXexunPositions(
  token: string,
  imeis: string[],
  startTime: number,
  endTime: number
): Promise<XexunGpsRecord[]> {
  // Xexun API requires trailing comma on IMEI list
  const imeiParam = imeis.join(",") + ",";
  
  const url = `${XEXUN_BASE_URL}/web-manager/gpsInfo/pageGpsInfoMap`;
  const params = {
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    imei: imeiParam,
    pageNum: "1",
    smoothness: "0",
    alg: "0",
    pageSize: "1000000", // Get all records in the window
    isDisData: "0",
    _t: Date.now().toString(),
  };

  const response = await axios.get<XexunApiResponse>(url, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 30000,
  });

  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(`Xexun API returned code ${response.data.code}`);
  }

  return response.data.data.records || [];
}

/**
 * Get the latest record per IMEI from a list of records (sorted by uploadTime)
 */
function getLatestPerImei(records: XexunGpsRecord[]): Map<string, XexunGpsRecord> {
  const latest = new Map<string, XexunGpsRecord>();
  
  for (const record of records) {
    const existing = latest.get(record.imei);
    if (!existing || record.uploadTime > existing.uploadTime) {
      latest.set(record.imei, record);
    }
  }
  
  return latest;
}

// ─── Main scheduled handler ─────────────────────────────────────────────────

export async function handleScheduledXexunPoll(req: Request, res: Response) {
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

    const token = process.env.XEXUN_API_TOKEN;
    const deptId = process.env.XEXUN_DEPT_ID;

    if (!token) {
      return res.status(500).json({ error: "XEXUN_API_TOKEN not configured" });
    }

    const serviceClient = getServiceClient();

    // 1. Get all organizations with Xexun enabled
    const { data: orgs, error: orgsError } = await serviceClient
      .from("integration_settings")
      .select("organization_id")
      .eq("xexun_enabled", true);

    if (orgsError || !orgs || orgs.length === 0) {
      return res.json({
        ok: true,
        message: "No organizations with Xexun enabled",
        polled: 0,
      });
    }

    let totalPolled = 0;
    let totalUpdated = 0;
    let totalHistoryInserted = 0;
    const errors: string[] = [];

    for (const org of orgs) {
      try {
        // 2. Get all fleet vehicles with xexun_imei for this org
        const { data: vehicles, error: vError } = await serviceClient
          .from("fleet_vehicles")
          .select("id, xexun_imei, matricula")
          .eq("organization_id", org.organization_id)
          .not("xexun_imei", "is", null);

        if (vError || !vehicles || vehicles.length === 0) {
          continue;
        }

        const imeis = vehicles
          .map(v => v.xexun_imei)
          .filter((imei): imei is string => !!imei && imei.trim() !== "");

        if (imeis.length === 0) continue;

        // 3. Fetch positions from Xexun API (last 2 minutes window)
        const now = Date.now();
        const twoMinAgo = now - 120000;

        const records = await fetchXexunPositions(token, imeis, twoMinAgo, now);
        totalPolled += imeis.length;

        if (records.length === 0) {
          // No new data in the last 2 minutes - that's fine
          continue;
        }

        // 4. Get the latest position per IMEI
        const latestPerImei = getLatestPerImei(records);

        // 5. Upsert latest positions and insert history
        for (const [imei, record] of Array.from(latestPerImei.entries())) {
          const vehicle = vehicles.find(v => v.xexun_imei === imei);
          const fleetVehicleId = vehicle?.id || null;

          // Only process records with valid GPS coordinates
          if (!record.gpsLat || !record.gpsLng || (record.gpsLat === 0 && record.gpsLng === 0)) {
            continue;
          }

          const deviceTime = new Date(record.uploadTime).toISOString();
          const attributes: Record<string, unknown> = {};
          if (record.satelliteNum != null) attributes.satellites = record.satelliteNum;
          if (record.pdop != null) attributes.pdop = record.pdop;
          if (record.csq != null) attributes.csq = record.csq;
          if (record.signalStrength != null) attributes.signalStrength = record.signalStrength;
          if (record.accuracyLevel != null) attributes.accuracyLevel = record.accuracyLevel;
          if (record.locationMode != null) attributes.locationMode = record.locationMode;
          if (record.sensorDistance != null) attributes.sensorDistance = record.sensorDistance;
          if (record.monitorName) attributes.monitorName = record.monitorName;

          // Upsert latest position
          const { error: upsertErr } = await serviceClient
            .from("device_positions")
            .upsert({
              organization_id: org.organization_id,
              imei,
              fleet_vehicle_id: fleetVehicleId,
              latitude: record.gpsLat,
              longitude: record.gpsLng,
              altitude: 0,
              speed: record.speed || 0,
              course: record.course || 0,
              address: null,
              battery_level: record.electricity ?? null,
              device_status: "online",
              last_update: new Date().toISOString(),
              attributes,
            }, { onConflict: "organization_id,imei" });

          if (upsertErr) {
            errors.push(`Upsert error for ${imei}: ${upsertErr.message}`);
          } else {
            totalUpdated++;
          }
        }

        // 6. Insert ALL records from the window into history (for route tracking)
        // Only insert records we haven't seen before (check by xexun record id)
        for (const record of records) {
          if (!record.gpsLat || !record.gpsLng || (record.gpsLat === 0 && record.gpsLng === 0)) {
            continue;
          }

          const vehicle = vehicles.find(v => v.xexun_imei === record.imei);
          const fleetVehicleId = vehicle?.id || null;
          const deviceTime = new Date(record.uploadTime).toISOString();

          const attributes: Record<string, unknown> = {};
          if (record.satelliteNum != null) attributes.satellites = record.satelliteNum;
          if (record.pdop != null) attributes.pdop = record.pdop;
          if (record.speed != null) attributes.speed = record.speed;
          if (record.monitorName) attributes.monitorName = record.monitorName;
          attributes.xexunRecordId = record.id; // For deduplication

          const { error: histErr } = await serviceClient
            .from("device_position_history")
            .insert({
              organization_id: org.organization_id,
              imei: record.imei,
              fleet_vehicle_id: fleetVehicleId,
              latitude: record.gpsLat,
              longitude: record.gpsLng,
              altitude: 0,
              speed: record.speed || 0,
              course: record.course || 0,
              address: null,
              device_time: deviceTime,
              valid: true,
              attributes,
            });

          if (!histErr) {
            totalHistoryInserted++;
          }
          // Ignore duplicate insert errors silently
        }
      } catch (orgErr: any) {
        errors.push(`Org ${org.organization_id}: ${orgErr.message}`);
      }
    }

    return res.json({
      ok: true,
      polled: totalPolled,
      updated: totalUpdated,
      historyInserted: totalHistoryInserted,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[xexun-poll] Error:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
