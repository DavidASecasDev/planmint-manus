/**
 * Staff Capacity Endpoint — Calculates workload vs staff availability.
 *
 * For a given date, it:
 * 1. Fetches all non-cancelled reservations (entregas + devoluciones)
 * 2. Fetches staff schedules (who is working, in which team, and when)
 * 3. Uses Google Maps Distance Matrix to estimate travel times from base
 * 4. Computes per-hour-slot workload (in person-minutes) vs available person-minutes
 * 5. Returns capacity status: sufficient / tight / deficit
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { makeRequest, type DistanceMatrixResult } from "./_core/map";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base location: Polígono Son Oms, Palma (near PMI airport) */
const BASE_LOCATION = "Polígono Son Oms, Palma de Mallorca, Spain";
const BASE_COORDS = "39.5516,2.7278"; // lat,lng for distance matrix

/** Time in minutes for a single operation at base (entrega or devolución) */
const BASE_OPERATION_MINUTES = 10;

/** Default travel time (minutes one-way) when Google Maps fails or location is unknown */
const DEFAULT_TRAVEL_MINUTES = 15;

/** Locations considered "at base" (no extra travel time) */
const BASE_LOCATION_KEYWORDS = [
  "aeropuerto",
  "son oms",
  "polígono son oms",
  "poligono son oms",
  "oficina azul",
  "pmi",
  "aeropuerto de palma",
];

/** Capacity thresholds */
const THRESHOLD_TIGHT = 0.70;  // 70% = tight
const THRESHOLD_DEFICIT = 0.85; // 85% = deficit

/** Cache for travel times (location string -> minutes one-way) */
const travelTimeCache = new Map<string, number>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cacheTimestamps = new Map<string, number>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function toMinutes(timeStr: string | null): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function isBaseLocation(location: string | null): boolean {
  if (!location) return true; // No location specified = assume base
  const lower = location.toLowerCase().trim();
  return BASE_LOCATION_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Get travel time in minutes from base to a destination using Google Maps.
 * Uses caching to avoid repeated API calls for the same location.
 */
async function getTravelMinutes(destination: string): Promise<number> {
  const cacheKey = destination.toLowerCase().trim();

  // Check cache
  const cachedTime = travelTimeCache.get(cacheKey);
  const cachedAt = cacheTimestamps.get(cacheKey);
  if (cachedTime !== undefined && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedTime;
  }

  try {
    const result = await makeRequest<DistanceMatrixResult>(
      "/maps/api/distancematrix/json",
      {
        origins: BASE_COORDS,
        destinations: `${destination}, Mallorca, Spain`,
        mode: "driving",
        units: "metric",
        language: "es",
      }
    );

    if (
      result.status === "OK" &&
      result.rows?.[0]?.elements?.[0]?.status === "OK"
    ) {
      const durationSeconds = result.rows[0].elements[0].duration.value;
      const minutes = Math.ceil(durationSeconds / 60);
      travelTimeCache.set(cacheKey, minutes);
      cacheTimestamps.set(cacheKey, Date.now());
      return minutes;
    }
  } catch (err) {
    console.error(`[staff-capacity] Google Maps error for "${destination}":`, err);
  }

  // Fallback
  travelTimeCache.set(cacheKey, DEFAULT_TRAVEL_MINUTES);
  cacheTimestamps.set(cacheKey, Date.now());
  return DEFAULT_TRAVEL_MINUTES;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Operation {
  reservationId: string;
  type: "Entrega" | "Devolución" | "Transfer";
  datetime: string; // ISO string
  hour: number; // 0-23
  location: string | null;
  isAtBase: boolean;
  travelMinutesOneWay: number;
  /** Total person-minutes this operation consumes */
  personMinutes: number;
  /** Number of people required */
  peopleNeeded: number;
  isCompleted: boolean;
}

interface HourSlot {
  hour: number;
  label: string; // "09:00 - 10:00"
  operations: Operation[];
  totalPersonMinutes: number;
  availablePersonMinutes: number;
  availableStaff: {
    rentals: string[];
    preparacion: string[];
    mostrador: string[];
  };
  utilizationPct: number;
  status: "sufficient" | "tight" | "deficit";
}

interface CapacityResult {
  date: string;
  overallStatus: "sufficient" | "tight" | "deficit";
  overallUtilization: number;
  totalOperations: number;
  totalPersonMinutesNeeded: number;
  totalPersonMinutesAvailable: number;
  hourSlots: HourSlot[];
  deficitHours: number[];
  tightHours: number[];
  summary: string;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function handleGetStaffCapacity(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId)
      return res.status(400).json({ ok: false, error: "No organization" });

    const { date } = req.body;
    if (!date)
      return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" });

    const sb = getServiceClient();

    // ── 1. Fetch reservations for this date ─────────────────────────────────
    const { data: reservations, error: resErr } = await sb
      .from("reservations")
      .select(
        `id, desde, hasta, tipo_actividad, estado,
         confirmed_entrega_datetime, confirmed_devolucion_datetime,
         lugar_entrega, lugar_devolucion,
         lugar_entrega_direccion, lugar_entrega_ciudad,
         lugar_devolucion_direccion, lugar_devolucion_ciudad,
         entrega_completada, devolucion_completada, transfer_completado`
      )
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .neq("estado", "Cancelada");

    if (resErr) throw resErr;

    // Filter to operations happening on this date
    const operations: Operation[] = [];

    for (const r of reservations || []) {
      // Entrega / Transfer
      if (r.tipo_actividad === "Transfer") {
        const dt = r.confirmed_entrega_datetime || r.desde;
        if (dt && dt.substring(0, 10) === date) {
          const location = r.lugar_entrega || r.lugar_entrega_direccion || r.lugar_entrega_ciudad || null;
          const atBase = isBaseLocation(location);
          operations.push({
            reservationId: r.id,
            type: "Transfer",
            datetime: dt,
            hour: parseInt(dt.substring(11, 13), 10),
            location,
            isAtBase: atBase,
            travelMinutesOneWay: 0, // Will be calculated
            personMinutes: 0,
            peopleNeeded: atBase ? 1 : 2,
            isCompleted: r.transfer_completado,
          });
        }
      } else {
        // Entrega
        const entregaDt = r.confirmed_entrega_datetime || r.desde;
        if (entregaDt && entregaDt.substring(0, 10) === date) {
          const location = r.lugar_entrega || r.lugar_entrega_direccion || r.lugar_entrega_ciudad || null;
          const atBase = isBaseLocation(location);
          operations.push({
            reservationId: r.id,
            type: "Entrega",
            datetime: entregaDt,
            hour: parseInt(entregaDt.substring(11, 13), 10),
            location,
            isAtBase: atBase,
            travelMinutesOneWay: 0,
            personMinutes: 0,
            peopleNeeded: atBase ? 1 : 2, // At base: 1 person. Domicilio: 2 (rental + escoba)
            isCompleted: r.entrega_completada,
          });
        }

        // Devolución
        const devolDt = r.confirmed_devolucion_datetime || r.hasta;
        if (devolDt && devolDt.substring(0, 10) === date) {
          const location = r.lugar_devolucion || r.lugar_devolucion_direccion || r.lugar_devolucion_ciudad || null;
          const atBase = isBaseLocation(location);
          operations.push({
            reservationId: r.id,
            type: "Devolución",
            datetime: devolDt,
            hour: parseInt(devolDt.substring(11, 13), 10),
            location,
            isAtBase: atBase,
            travelMinutesOneWay: 0,
            personMinutes: 0,
            peopleNeeded: atBase ? 1 : 2, // At base: 1 person. Domicilio: 2 (escoba goes, picks up car)
            isCompleted: r.devolucion_completada,
          });
        }
      }
    }

    // ── 2. Calculate travel times for non-base operations ───────────────────
    const uniqueLocations = new Set<string>();
    for (const op of operations) {
      if (!op.isAtBase && op.location) {
        uniqueLocations.add(op.location);
      }
    }

    // Batch fetch travel times
    const travelTimes = new Map<string, number>();
    const locationArray = Array.from(uniqueLocations);

    // Google Maps Distance Matrix supports up to 25 destinations per request
    for (let i = 0; i < locationArray.length; i += 25) {
      const batch = locationArray.slice(i, i + 25);
      const destinations = batch.map((l) => `${l}, Mallorca, Spain`).join("|");

      try {
        const result = await makeRequest<DistanceMatrixResult>(
          "/maps/api/distancematrix/json",
          {
            origins: BASE_COORDS,
            destinations,
            mode: "driving",
            units: "metric",
            language: "es",
          }
        );

        if (result.status === "OK") {
          batch.forEach((loc, idx) => {
            const element = result.rows?.[0]?.elements?.[idx];
            if (element?.status === "OK") {
              const minutes = Math.ceil(element.duration.value / 60);
              travelTimes.set(loc, minutes);
              travelTimeCache.set(loc.toLowerCase().trim(), minutes);
              cacheTimestamps.set(loc.toLowerCase().trim(), Date.now());
            } else {
              travelTimes.set(loc, DEFAULT_TRAVEL_MINUTES);
            }
          });
        }
      } catch (err) {
        console.error("[staff-capacity] Distance matrix batch error:", err);
        batch.forEach((loc) => travelTimes.set(loc, DEFAULT_TRAVEL_MINUTES));
      }
    }

    // Also check cache for any we already know
    for (const loc of Array.from(uniqueLocations)) {
      if (!travelTimes.has(loc)) {
        const cached = travelTimeCache.get(loc.toLowerCase().trim());
        travelTimes.set(loc, cached ?? DEFAULT_TRAVEL_MINUTES);
      }
    }

    // Assign travel times and compute person-minutes
    for (const op of operations) {
      if (op.isAtBase) {
        op.travelMinutesOneWay = 0;
        // At base: just the operation time, 1 person
        op.personMinutes = BASE_OPERATION_MINUTES;
      } else {
        const travel = op.location ? (travelTimes.get(op.location) ?? DEFAULT_TRAVEL_MINUTES) : DEFAULT_TRAVEL_MINUTES;
        op.travelMinutesOneWay = travel;
        // Domicilio: round trip + operation time, times number of people
        // Both people travel together, so total person-minutes = (travel*2 + operation) * peopleNeeded
        // Actually: both people spend the same time (travel out + operation + travel back)
        const timePerPerson = travel * 2 + BASE_OPERATION_MINUTES;
        op.personMinutes = timePerPerson * op.peopleNeeded;
      }
    }

    // ── 3. Fetch staff schedules for this date ──────────────────────────────
    const { data: schedules, error: schedErr } = await sb
      .from("staff_schedules")
      .select(`
        user_id,
        team_id,
        shift_template_id,
        shift_templates!inner(id, name, start_time, end_time, is_day_off)
      `)
      .eq("organization_id", orgId)
      .eq("date", date);

    if (schedErr) throw schedErr;

    // Get team info to classify staff
    const { data: teams, error: teamErr } = await sb
      .from("teams")
      .select("id, name")
      .eq("organization_id", orgId);

    if (teamErr) throw teamErr;

    // Build team name lookup
    const teamNameById = new Map<string, string>();
    (teams || []).forEach((t: any) => teamNameById.set(t.id, t.name));

    // Classify staff by team and their shift hours
    interface StaffShift {
      userId: string;
      teamName: string;
      startMinutes: number;
      endMinutes: number;
    }

    const staffShifts: StaffShift[] = [];
    (schedules || []).forEach((s: any) => {
      const template = s.shift_templates;
      if (template.is_day_off) return; // Day off = not available

      const teamName = s.team_id ? (teamNameById.get(s.team_id) || "Unknown") : "Unknown";
      staffShifts.push({
        userId: s.user_id,
        teamName,
        startMinutes: toMinutes(template.start_time),
        endMinutes: toMinutes(template.end_time),
      });
    });

    // ── 4. Build hourly slots ───────────────────────────────────────────────
    // Find the range of hours we need to cover (from earliest operation to latest)
    let minHour = 24;
    let maxHour = 0;
    for (const op of operations) {
      if (op.hour < minHour) minHour = op.hour;
      if (op.hour > maxHour) maxHour = op.hour;
    }
    // Also consider staff shift range
    for (const ss of staffShifts) {
      const startH = Math.floor(ss.startMinutes / 60);
      const endH = Math.ceil(ss.endMinutes / 60);
      if (startH < minHour) minHour = startH;
      if (endH > maxHour) maxHour = endH;
    }

    if (operations.length === 0 && staffShifts.length === 0) {
      return res.json({
        ok: true,
        data: {
          date,
          overallStatus: "sufficient",
          overallUtilization: 0,
          totalOperations: 0,
          totalPersonMinutesNeeded: 0,
          totalPersonMinutesAvailable: 0,
          hourSlots: [],
          deficitHours: [],
          tightHours: [],
          summary: "No hay operaciones ni personal programado para este día.",
        } as CapacityResult,
      });
    }

    // Ensure reasonable range
    if (minHour > maxHour) { minHour = 7; maxHour = 22; }

    const hourSlots: HourSlot[] = [];

    for (let h = minHour; h <= maxHour; h++) {
      const slotStart = h * 60;
      const slotEnd = (h + 1) * 60;

      // Operations in this hour
      const slotOps = operations.filter((op) => {
        // An operation "occupies" the hour it starts in, plus potentially more hours
        // For simplicity, we assign the full person-minutes to the starting hour
        // For long operations (travel > 60min), we could split across hours, but
        // for now we keep it simple
        return op.hour === h;
      });

      // Staff available in this hour
      const rentals: string[] = [];
      const preparacion: string[] = [];
      const mostrador: string[] = [];

      const seenUsers = new Set<string>();
      for (const ss of staffShifts) {
        if (seenUsers.has(ss.userId + "_" + ss.teamName)) continue;
        seenUsers.add(ss.userId + "_" + ss.teamName);

        // Check if this staff member's shift covers this hour
        let coversHour = false;
        if (ss.endMinutes <= ss.startMinutes) {
          // Overnight shift
          coversHour = slotStart >= ss.startMinutes || slotEnd <= ss.endMinutes;
        } else {
          coversHour = slotStart >= ss.startMinutes && slotStart < ss.endMinutes;
        }

        if (!coversHour) continue;

        const tn = ss.teamName.toLowerCase();
        if (tn.includes("rental")) {
          if (!rentals.includes(ss.userId)) rentals.push(ss.userId);
        } else if (tn.includes("preparaci") || tn.includes("preparacion")) {
          if (!preparacion.includes(ss.userId)) preparacion.push(ss.userId);
        } else if (tn.includes("mostrador")) {
          if (!mostrador.includes(ss.userId)) mostrador.push(ss.userId);
        }
      }

      // Available person-minutes:
      // Rentals: 60 min per person (full hour available for operations)
      // Preparación: 60 min per person (available as escoba)
      // Mostrador: 30 min per person (can help but should stay at desk, so only 50% available)
      const availableMinutes =
        rentals.length * 60 +
        preparacion.length * 60 +
        mostrador.length * 30; // Mostrador at 50% capacity for field ops

      const totalNeeded = slotOps.reduce((sum, op) => sum + op.personMinutes, 0);

      const utilization = availableMinutes > 0 ? totalNeeded / availableMinutes : (totalNeeded > 0 ? 1 : 0);

      let status: "sufficient" | "tight" | "deficit" = "sufficient";
      if (utilization > THRESHOLD_DEFICIT) status = "deficit";
      else if (utilization > THRESHOLD_TIGHT) status = "tight";

      hourSlots.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`,
        operations: slotOps,
        totalPersonMinutes: totalNeeded,
        availablePersonMinutes: availableMinutes,
        availableStaff: { rentals, preparacion, mostrador },
        utilizationPct: Math.round(utilization * 100),
        status,
      });
    }

    // ── 5. Compute overall status ───────────────────────────────────────────
    const totalNeeded = hourSlots.reduce((s, h) => s + h.totalPersonMinutes, 0);
    const totalAvailable = hourSlots.reduce((s, h) => s + h.availablePersonMinutes, 0);
    const overallUtil = totalAvailable > 0 ? totalNeeded / totalAvailable : (totalNeeded > 0 ? 1 : 0);

    let overallStatus: "sufficient" | "tight" | "deficit" = "sufficient";
    // Overall status is the worst status of any hour slot
    if (hourSlots.some((h) => h.status === "deficit")) overallStatus = "deficit";
    else if (hourSlots.some((h) => h.status === "tight")) overallStatus = "tight";

    const deficitHours = hourSlots.filter((h) => h.status === "deficit").map((h) => h.hour);
    const tightHours = hourSlots.filter((h) => h.status === "tight").map((h) => h.hour);

    // Build summary
    let summary = "";
    if (overallStatus === "sufficient") {
      summary = `Personal suficiente para cubrir las ${operations.length} operaciones del día.`;
    } else if (overallStatus === "tight") {
      summary = `Personal justo. ${tightHours.length} franja(s) horaria(s) con carga alta (${tightHours.map((h) => `${h}:00`).join(", ")}).`;
    } else {
      summary = `Déficit de personal detectado. ${deficitHours.length} franja(s) horaria(s) con sobrecarga (${deficitHours.map((h) => `${h}:00`).join(", ")}). Se recomienda refuerzo.`;
    }

    const result: CapacityResult = {
      date,
      overallStatus,
      overallUtilization: Math.round(overallUtil * 100),
      totalOperations: operations.filter((o) => !o.isCompleted).length,
      totalPersonMinutesNeeded: totalNeeded,
      totalPersonMinutesAvailable: totalAvailable,
      hourSlots,
      deficitHours,
      tightHours,
      summary,
    };

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    if (err instanceof AuthError)
      return res.status(401).json({ ok: false, error: err.message });
    console.error("[staff-capacity]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
