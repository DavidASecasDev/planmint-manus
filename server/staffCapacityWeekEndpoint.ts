/**
 * Staff Capacity Week Endpoint — Returns 7 days of capacity summaries.
 * Also includes travel time override management (list/upsert/delete).
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { handleGetStaffCapacity } from "./staffCapacityEndpoint";

// ─── Weekly Capacity ───────────────────────────────────────────────────────

interface ReinforcementSuggestion {
  userId: string;
  name: string;
  teamName: string;
  shiftStart: string;
  shiftEnd: string;
  availableHours: number[];
}

interface DaySummary {
  date: string;
  overallStatus: "sufficient" | "tight" | "deficit";
  overallUtilization: number;
  totalOperations: number;
  totalPersonMinutesNeeded: number;
  totalPersonMinutesAvailable: number;
  deficitHours: number[];
  tightHours: number[];
  summary: string;
  reinforcements: ReinforcementSuggestion[];
}

/**
 * POST /api/get-staff-capacity-week
 * Body: { startDate: "YYYY-MM-DD" } — returns 7 days starting from startDate
 */
export async function handleGetStaffCapacityWeek(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId)
      return res.status(400).json({ ok: false, error: "No organization" });

    const { startDate } = req.body;
    if (!startDate)
      return res.status(400).json({ ok: false, error: "startDate is required (YYYY-MM-DD)" });

    // Generate 7 dates
    const dates: string[] = [];
    const start = new Date(startDate + "T12:00:00Z"); // noon to avoid DST issues
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }

    // Call the single-day handler for each date in parallel
    const results: DaySummary[] = await Promise.all(
      dates.map(async (date) => {
        // Create a mock request/response to reuse the existing handler
        const mockRes = createMockResponse();
        const mockReq = {
          headers: req.headers,
          body: { date },
        } as Request;

        await handleGetStaffCapacity(mockReq, mockRes as any);

        const responseData = mockRes.getResponseData();
        if (responseData?.ok && responseData.data) {
          const d = responseData.data;
          return {
            date,
            overallStatus: d.overallStatus,
            overallUtilization: d.overallUtilization,
            totalOperations: d.totalOperations,
            totalPersonMinutesNeeded: d.totalPersonMinutesNeeded,
            totalPersonMinutesAvailable: d.totalPersonMinutesAvailable,
            deficitHours: d.deficitHours,
            tightHours: d.tightHours,
            summary: d.summary,
            reinforcements: d.reinforcements || [],
          } as DaySummary;
        }

        // If the single-day call failed, return a neutral summary
        return {
          date,
          overallStatus: "sufficient" as const,
          overallUtilization: 0,
          totalOperations: 0,
          totalPersonMinutesNeeded: 0,
          totalPersonMinutesAvailable: 0,
          deficitHours: [],
          tightHours: [],
          summary: "Sin datos disponibles.",
          reinforcements: [],
        };
      })
    );

    return res.json({ ok: true, data: results });
  } catch (err: any) {
    if (err instanceof AuthError)
      return res.status(401).json({ ok: false, error: err.message });
    console.error("[staff-capacity-week]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Travel Time Overrides ─────────────────────────────────────────────────

/**
 * POST /api/travel-time-overrides/list
 * Returns all cached travel times for the organization (with manual overrides highlighted)
 */
export async function handleListTravelTimeOverrides(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId)
      return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("travel_time_cache")
      .select("*")
      .eq("organization_id", orgId)
      .order("destination", { ascending: true });

    if (error) throw error;

    // Group by destination (normalized), pick the most relevant entry per destination
    const grouped = new Map<string, any>();
    for (const row of data || []) {
      const key = row.dest_normalized || row.destination;
      if (!grouped.has(key)) {
        grouped.set(key, {
          destination: row.destination,
          destNormalized: row.dest_normalized,
          travelMinutes: row.travel_minutes,
          travelMinutesTraffic: row.travel_minutes_traffic,
          distanceMeters: row.distance_meters,
          source: row.source,
          isManualOverride: row.source === "manual",
          hourBucket: row.hour_bucket,
          updatedAt: row.updated_at,
        });
      } else {
        // Prefer manual overrides
        const existing = grouped.get(key)!;
        if (row.source === "manual" && existing.source !== "manual") {
          grouped.set(key, {
            destination: row.destination,
            destNormalized: row.dest_normalized,
            travelMinutes: row.travel_minutes,
            travelMinutesTraffic: row.travel_minutes_traffic,
            distanceMeters: row.distance_meters,
            source: row.source,
            isManualOverride: true,
            hourBucket: row.hour_bucket,
            updatedAt: row.updated_at,
          });
        }
      }
    }

    return res.json({ ok: true, data: Array.from(grouped.values()) });
  } catch (err: any) {
    if (err instanceof AuthError)
      return res.status(401).json({ ok: false, error: err.message });
    console.error("[travel-time-overrides/list]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/travel-time-overrides/upsert
 * Body: { destination: string, travelMinutes: number }
 * Creates or updates a manual override for a destination
 */
export async function handleUpsertTravelTimeOverride(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId)
      return res.status(400).json({ ok: false, error: "No organization" });

    const { destination, travelMinutes } = req.body;
    if (!destination || typeof travelMinutes !== "number" || travelMinutes < 0) {
      return res.status(400).json({
        ok: false,
        error: "destination (string) and travelMinutes (number >= 0) required",
      });
    }

    const destNormalized = destination
      .toLowerCase()
      .trim()
      .replace(/[^a-záéíóúñü0-9\s]/gi, "")
      .replace(/\s+/g, " ");

    const sb = getServiceClient();

    // Upsert for all hour buckets (manual override applies to all times)
    const hourBuckets = [0, 1, 2, 3, 4, 5];
    const rows = hourBuckets.map((bucket) => ({
      organization_id: orgId,
      destination: destination.trim(),
      dest_normalized: destNormalized,
      hour_bucket: bucket,
      travel_minutes: travelMinutes,
      travel_minutes_traffic: travelMinutes, // Manual = same for traffic
      distance_meters: null,
      source: "manual",
      updated_at: new Date().toISOString(),
    }));

    // Delete existing entries for this destination, then insert
    await sb
      .from("travel_time_cache")
      .delete()
      .eq("organization_id", orgId)
      .eq("dest_normalized", destNormalized);

    const { error } = await sb.from("travel_time_cache").insert(rows);
    if (error) throw error;

    return res.json({ ok: true, message: "Override saved successfully" });
  } catch (err: any) {
    if (err instanceof AuthError)
      return res.status(401).json({ ok: false, error: err.message });
    console.error("[travel-time-overrides/upsert]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/travel-time-overrides/delete
 * Body: { destination: string }
 * Removes the manual override, allowing Google Maps to be used again
 */
export async function handleDeleteTravelTimeOverride(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId)
      return res.status(400).json({ ok: false, error: "No organization" });

    const { destination } = req.body;
    if (!destination) {
      return res.status(400).json({ ok: false, error: "destination required" });
    }

    const destNormalized = destination
      .toLowerCase()
      .trim()
      .replace(/[^a-záéíóúñü0-9\s]/gi, "")
      .replace(/\s+/g, " ");

    const sb = getServiceClient();

    const { error } = await sb
      .from("travel_time_cache")
      .delete()
      .eq("organization_id", orgId)
      .eq("dest_normalized", destNormalized);

    if (error) throw error;

    return res.json({ ok: true, message: "Override deleted" });
  } catch (err: any) {
    if (err instanceof AuthError)
      return res.status(401).json({ ok: false, error: err.message });
    console.error("[travel-time-overrides/delete]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Mock Response Helper ──────────────────────────────────────────────────

function createMockResponse() {
  let statusCode = 200;
  let responseBody: any = null;

  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseBody = body;
      return this;
    },
    getResponseData() {
      return responseBody;
    },
    getStatusCode() {
      return statusCode;
    },
    writeHead() { return this; },
    end() { return this; },
  };
}
