/**
 * Staff Capacity Endpoint v2 — Calculates workload vs staff availability.
 *
 * Improvements over v1:
 * - Persistent travel time cache in Supabase (travel_time_cache table)
 * - Google Maps departure_time with traffic estimation based on operation hour
 * - duration_in_traffic used when available (more accurate)
 * - Tiered fallback: Supabase cache → Google Maps → default estimate
 * - Cache keyed by (destination_normalized, departure_hour_bucket) for traffic variance
 * - 7-day cache expiry; invalidated when location/hour changes
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { makeRequest, type DistanceMatrixResult } from "./_core/map";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base location: Azul Cars, Polígono Son Oms, Palma */
const BASE_LOCATION = "Carrer del Canal de Sant Jordi, 29, L3, 07610 Palma, Illes Balears, Spain";
const BASE_COORDS = "39.5340,2.7420"; // lat,lng for Azul Cars (Polígono Son Oms)

/** Time in minutes for a single operation at base (entrega or devolución) */
const BASE_OPERATION_MINUTES = 10;

/** Default travel time (minutes one-way) when all sources fail */
const DEFAULT_TRAVEL_MINUTES = 15;

/** Locations considered "at base" (no extra travel time) */
const BASE_LOCATION_KEYWORDS = [
  "son oms",
  "polígono son oms",
  "poligono son oms",
  "oficina azul",
  "azul cars",
  "canal de sant jordi",
  "base",
];

/**
 * Location aliases — Known destinations with fixed travel times.
 * Used when Google Maps doesn't recognize the address (e.g. "Parking G")
 * or returns inaccurate results for airport internal roads.
 * Travel times are based on real Google Maps measurements.
 */
interface LocationAliasConfig {
  /** Keywords that trigger this alias (lowercase) */
  keywords: string[];
  /** Fixed travel time in minutes (based on Google Maps real measurement) */
  fixedTravelMinutes: number;
  /** The actual address to send to Google Maps if needed */
  googleMapsAddress: string;
  /** Whether to always use fixedTravelMinutes instead of Google Maps result */
  alwaysUseFixed: boolean;
}

const LOCATION_ALIASES: LocationAliasConfig[] = [
  {
    keywords: [
      'aeropuerto', 'aeropuerto de palma', 'aeropuerto palma',
      'parking g', 'pmi', '07611',
      'clubs to hire', 'transport meeting point',
    ],
    fixedTravelMinutes: 9, // 7 min drive (Google Maps) + 2 min internal road with barriers
    googleMapsAddress: 'Aeropuerto de Palma de Mallorca, 07611 Palma, Illes Balears, Spain',
    alwaysUseFixed: true, // Always use 9 min because Google Maps doesn't account for internal barriers
  },
];

/**
 * Check if a location matches a known alias.
 * Returns the alias config if matched, null otherwise.
 */
function matchLocationAlias(location: string): LocationAliasConfig | null {
  const normalized = location.toLowerCase().trim();
  for (const alias of LOCATION_ALIASES) {
    for (const keyword of alias.keywords) {
      if (normalized.includes(keyword)) {
        return alias;
      }
    }
  }
  return null;
}

/** Capacity thresholds */
const THRESHOLD_TIGHT = 0.70;  // 70% = tight
const THRESHOLD_DEFICIT = 0.85; // 85% = deficit

/** Hour buckets for traffic-aware caching (group hours into traffic periods) */
function getHourBucket(hour: number): number {
  // 0 = night (22-06), 1 = morning rush (07-09), 2 = midday (10-13),
  // 3 = afternoon (14-16), 4 = evening rush (17-19), 5 = evening (20-21)
  if (hour >= 22 || hour < 7) return 0;
  if (hour >= 7 && hour < 10) return 1;
  if (hour >= 10 && hour < 14) return 2;
  if (hour >= 14 && hour < 17) return 3;
  if (hour >= 17 && hour < 20) return 4;
  return 5;
}

/** Normalize destination string for cache key consistency */
function normalizeDestination(dest: string): string {
  return dest
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,.\-]+$/, "")
    .trim();
}

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
 * Build a Unix timestamp for a specific date and hour in Europe/Madrid timezone.
 * Used as departure_time for Google Maps traffic estimation.
 */
function buildDepartureTimestamp(dateStr: string, hour: number): number {
  // dateStr is YYYY-MM-DD, hour is 0-23
  // Create a date in local time (server runs in UTC, but we want Madrid time)
  const dt = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00+02:00`);
  return Math.floor(dt.getTime() / 1000);
}

// ─── Travel Time Cache (Supabase-backed) ────────────────────────────────────

interface CachedTravelTime {
  travel_minutes_one_way: number;
  travel_minutes_with_traffic: number | null;
  distance_meters: number | null;
  source: string;
}

/**
 * Look up cached travel times from Supabase for multiple destinations.
 * Returns a map of normalizedDest -> CachedTravelTime (only for cache hits).
 */
async function getCachedTravelTimes(
  sb: ReturnType<typeof getServiceClient>,
  orgId: string,
  lookups: Array<{ destNormalized: string; hourBucket: number }>
): Promise<Map<string, CachedTravelTime>> {
  const result = new Map<string, CachedTravelTime>();
  if (lookups.length === 0) return result;

  // Build unique keys
  const uniqueKeys = lookups.map((l) => `${l.destNormalized}|${l.hourBucket}`);

  // Query in batches of 50
  for (let i = 0; i < lookups.length; i += 50) {
    const batch = lookups.slice(i, i + 50);
    const destNorms = batch.map((l) => l.destNormalized);

    const { data, error } = await sb
      .from("travel_time_cache")
      .select("destination_normalized, departure_hour_bucket, travel_minutes_one_way, travel_minutes_with_traffic, distance_meters, source")
      .eq("organization_id", orgId)
      .in("destination_normalized", destNorms)
      .gt("expires_at", new Date().toISOString());

    if (error) {
      console.error("[staff-capacity] Cache read error:", error);
      continue;
    }

    for (const row of data || []) {
      const key = `${row.destination_normalized}|${row.departure_hour_bucket}`;
      if (uniqueKeys.includes(key)) {
        result.set(key, {
          travel_minutes_one_way: row.travel_minutes_one_way,
          travel_minutes_with_traffic: row.travel_minutes_with_traffic,
          distance_meters: row.distance_meters,
          source: row.source,
        });
      }
    }
  }

  return result;
}

/**
 * Save travel times to Supabase cache (upsert).
 */
async function saveTravelTimesToCache(
  sb: ReturnType<typeof getServiceClient>,
  orgId: string,
  entries: Array<{
    destination: string;
    destNormalized: string;
    hourBucket: number;
    travelMinutes: number;
    travelMinutesTraffic: number | null;
    distanceMeters: number | null;
    source: string;
  }>
): Promise<void> {
  if (entries.length === 0) return;

  // Deduplicate by composite key to avoid upsert conflict errors
  const deduped = new Map<string, typeof entries[0]>();
  for (const e of entries) {
    const key = `${e.destNormalized}|${e.hourBucket}`;
    deduped.set(key, e); // last write wins
  }

  const rows = Array.from(deduped.values()).map((e) => ({
    organization_id: orgId,
    origin: "base",
    destination: e.destination,
    destination_normalized: e.destNormalized,
    departure_hour_bucket: e.hourBucket,
    travel_minutes_one_way: e.travelMinutes,
    travel_minutes_with_traffic: e.travelMinutesTraffic,
    distance_meters: e.distanceMeters,
    google_maps_status: "OK",
    source: e.source,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  // Upsert in batches
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await sb
      .from("travel_time_cache")
      .upsert(batch, {
        onConflict: "organization_id,destination_normalized,departure_hour_bucket",
      });

    if (error) {
      console.error("[staff-capacity] Cache write error:", error);
    }
  }
}

// ─── Google Maps with Traffic ───────────────────────────────────────────────

interface DistanceMatrixResultWithTraffic {
  rows: Array<{
    elements: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      duration_in_traffic?: { text: string; value: number };
      status: string;
    }>;
  }>;
  origin_addresses: string[];
  destination_addresses: string[];
  status: string;
}

/**
 * Fetch travel times from Google Maps Distance Matrix with traffic estimation.
 * Groups destinations by departure hour for traffic-aware results.
 */
async function fetchGoogleMapsTravelTimes(
  destinations: Array<{ location: string; departureTimestamp: number; hour: number }>,
  dateStr: string
): Promise<Map<string, { minutes: number; minutesTraffic: number | null; distanceMeters: number | null }>> {
  const result = new Map<string, { minutes: number; minutesTraffic: number | null; distanceMeters: number | null }>();

  // Group by departure hour bucket for efficient batching
  const byBucket = new Map<number, Array<{ location: string; departureTimestamp: number }>>();
  for (const d of destinations) {
    const bucket = getHourBucket(d.hour);
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(d);
  }

  for (const [bucket, group] of Array.from(byBucket.entries())) {
    // Deduplicate locations within the same bucket
    const uniqueLocs = Array.from(new Set(group.map((g: { location: string; departureTimestamp: number }) => g.location)));
    // Use the first departure timestamp from this bucket
    const departureTime = group[0].departureTimestamp;

    // Google Maps Distance Matrix supports up to 25 destinations per request
    for (let i = 0; i < uniqueLocs.length; i += 25) {
      const batch = uniqueLocs.slice(i, i + 25);
      const destinationsStr = batch.map((l) => `${l}, Mallorca, Spain`).join("|");

      try {
        // Determine if departure_time is in the future (required for traffic)
        const now = Math.floor(Date.now() / 1000);
        const params: Record<string, unknown> = {
          origins: BASE_COORDS,
          destinations: destinationsStr,
          mode: "driving",
          units: "metric",
          language: "es",
        };

        // Only add departure_time if it's in the future (Google Maps requirement)
        if (departureTime > now) {
          params.departure_time = departureTime;
        }

        const apiResult = await makeRequest<DistanceMatrixResultWithTraffic>(
          "/maps/api/distancematrix/json",
          params
        );

        if (apiResult.status === "OK") {
          batch.forEach((loc, idx) => {
            const element = apiResult.rows?.[0]?.elements?.[idx];
            if (element?.status === "OK") {
              const minutes = Math.ceil(element.duration.value / 60);
              const minutesTraffic = element.duration_in_traffic
                ? Math.ceil(element.duration_in_traffic.value / 60)
                : null;
              const distanceMeters = element.distance?.value ?? null;

              const key = `${normalizeDestination(loc)}|${bucket}`;
              result.set(key, { minutes, minutesTraffic, distanceMeters });
            }
          });
        }
      } catch (err) {
        console.error(`[staff-capacity] Google Maps error for bucket ${bucket}:`, err);
      }
    }
  }

  return result;
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
  travelMinutesWithTraffic: number | null;
  travelSource: string; // "cache" | "google_maps" | "fallback"
  /** Total person-minutes this operation consumes */
  personMinutes: number;
  /** Number of people required */
  peopleNeeded: number;
  isCompleted: boolean;
}

interface ReinforcementSuggestion {
  userId: string;
  name: string;
  teamName: string;
  shiftStart: string; // "07:00"
  shiftEnd: string;   // "15:00"
  availableHours: number[]; // hours this person could cover
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
  reinforcements: ReinforcementSuggestion[];
}

interface CapacityResult {
  date: string;
  overallStatus: "sufficient" | "tight" | "deficit";
  overallUtilization: number;
  totalOperations: number;
  totalPersonMinutesNeeded: number;
  totalPersonMinutesAvailable: number;
  hourSlots: HourSlot[];
  /** All operations (including completed) with travel times — used by Programación for row enrichment */
  allOperations: Operation[];
  deficitHours: number[];
  tightHours: number[];
  summary: string;
  cacheStats: { hits: number; misses: number; googleCalls: number };
  reinforcements: ReinforcementSuggestion[];
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
          // Prioritize exact address (direccion) for Google Maps accuracy, fallback to lugar name
          const location = r.lugar_entrega_direccion || r.lugar_entrega || r.lugar_entrega_ciudad || null;
          const atBase = isBaseLocation(location);
          operations.push({
            reservationId: r.id,
            type: "Transfer",
            datetime: dt,
            hour: parseInt(dt.substring(11, 13), 10),
            location,
            isAtBase: atBase,
            travelMinutesOneWay: 0,
            travelMinutesWithTraffic: null,
            travelSource: "none",
            personMinutes: 0,
            peopleNeeded: atBase ? 1 : 2,
            isCompleted: r.transfer_completado,
          });
        }
      } else {
        // Entrega
        const entregaDt = r.confirmed_entrega_datetime || r.desde;
        if (entregaDt && entregaDt.substring(0, 10) === date) {
          // Prioritize exact address (direccion) for Google Maps accuracy, fallback to lugar name
          const location = r.lugar_entrega_direccion || r.lugar_entrega || r.lugar_entrega_ciudad || null;
          const atBase = isBaseLocation(location);
          operations.push({
            reservationId: r.id,
            type: "Entrega",
            datetime: entregaDt,
            hour: parseInt(entregaDt.substring(11, 13), 10),
            location,
            isAtBase: atBase,
            travelMinutesOneWay: 0,
            travelMinutesWithTraffic: null,
            travelSource: "none",
            personMinutes: 0,
            peopleNeeded: atBase ? 1 : 2,
            isCompleted: r.entrega_completada,
          });
        }

        // Devolución
        const devolDt = r.confirmed_devolucion_datetime || r.hasta;
        if (devolDt && devolDt.substring(0, 10) === date) {
          // Prioritize exact address (direccion) for Google Maps accuracy, fallback to lugar name
          const location = r.lugar_devolucion_direccion || r.lugar_devolucion || r.lugar_devolucion_ciudad || null;
          const atBase = isBaseLocation(location);
          operations.push({
            reservationId: r.id,
            type: "Devolución",
            datetime: devolDt,
            hour: parseInt(devolDt.substring(11, 13), 10),
            location,
            isAtBase: atBase,
            travelMinutesOneWay: 0,
            travelMinutesWithTraffic: null,
            travelSource: "none",
            personMinutes: 0,
            peopleNeeded: atBase ? 1 : 2,
            isCompleted: r.devolucion_completada,
          });
        }
      }
    }

    // ── 2. Calculate travel times with tiered fallback ──────────────────────
    // Collect all non-base operations that need travel time
    const needsTravelTime: Array<{
      opIndex: number;
      location: string;
      destNormalized: string;
      hourBucket: number;
      hour: number;
    }> = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (!op.isAtBase && op.location) {
        needsTravelTime.push({
          opIndex: i,
          location: op.location,
          destNormalized: normalizeDestination(op.location),
          hourBucket: getHourBucket(op.hour),
          hour: op.hour,
        });
      }
    }

    let cacheHits = 0;
    let cacheMisses = 0;
    let googleCalls = 0;

    if (needsTravelTime.length > 0) {
      // Step 0: Resolve location aliases (fixed travel times for known locations)
      const remainingNeedsTravelTime: typeof needsTravelTime = [];
      for (const entry of needsTravelTime) {
        const alias = matchLocationAlias(entry.location);
        if (alias && alias.alwaysUseFixed) {
          // Apply fixed travel time directly — skip cache and Google Maps
          const op = operations[entry.opIndex];
          op.travelMinutesOneWay = alias.fixedTravelMinutes;
          op.travelMinutesWithTraffic = alias.fixedTravelMinutes;
          op.travelSource = "alias";
          cacheHits++; // Count as a "hit" for stats
        } else {
          remainingNeedsTravelTime.push(entry);
        }
      }

      // Step 1: Check Supabase cache (only for non-alias destinations)
      const cacheKeys = remainingNeedsTravelTime.map((n) => ({
        destNormalized: n.destNormalized,
        hourBucket: n.hourBucket,
      }));

      const cachedTimes = await getCachedTravelTimes(sb, orgId, cacheKeys);

      // Step 2: Identify cache misses
      const misses: Array<typeof needsTravelTime[0]> = [];

      for (const entry of remainingNeedsTravelTime) {
        const cacheKey = `${entry.destNormalized}|${entry.hourBucket}`;
        const cached = cachedTimes.get(cacheKey);

        if (cached) {
          cacheHits++;
          const op = operations[entry.opIndex];
          op.travelMinutesOneWay = cached.travel_minutes_one_way;
          op.travelMinutesWithTraffic = cached.travel_minutes_with_traffic;
          op.travelSource = "cache";
        } else {
          cacheMisses++;
          misses.push(entry);
        }
      }

      // Step 3: Fetch from Google Maps for cache misses
      if (misses.length > 0) {
        const googleDestinations = misses.map((m) => ({
          location: m.location,
          departureTimestamp: buildDepartureTimestamp(date, m.hour),
          hour: m.hour,
        }));

        googleCalls = misses.length;
        const googleResults = await fetchGoogleMapsTravelTimes(googleDestinations, date);

        // Save new entries to cache
        const cacheEntries: Array<{
          destination: string;
          destNormalized: string;
          hourBucket: number;
          travelMinutes: number;
          travelMinutesTraffic: number | null;
          distanceMeters: number | null;
          source: string;
        }> = [];

        for (const miss of misses) {
          const key = `${miss.destNormalized}|${miss.hourBucket}`;
          const googleResult = googleResults.get(key);

          const op = operations[miss.opIndex];

          if (googleResult) {
            op.travelMinutesOneWay = googleResult.minutes;
            op.travelMinutesWithTraffic = googleResult.minutesTraffic;
            op.travelSource = "google_maps";

            cacheEntries.push({
              destination: miss.location,
              destNormalized: miss.destNormalized,
              hourBucket: miss.hourBucket,
              travelMinutes: googleResult.minutes,
              travelMinutesTraffic: googleResult.minutesTraffic,
              distanceMeters: googleResult.distanceMeters,
              source: "google_maps",
            });
          } else {
            // Fallback: use default estimate
            op.travelMinutesOneWay = DEFAULT_TRAVEL_MINUTES;
            op.travelMinutesWithTraffic = null;
            op.travelSource = "fallback";

            cacheEntries.push({
              destination: miss.location,
              destNormalized: miss.destNormalized,
              hourBucket: miss.hourBucket,
              travelMinutes: DEFAULT_TRAVEL_MINUTES,
              travelMinutesTraffic: null,
              distanceMeters: null,
              source: "fallback",
            });
          }
        }

        // Save to Supabase cache (fire-and-forget, don't block response)
        saveTravelTimesToCache(sb, orgId, cacheEntries).catch((err) =>
          console.error("[staff-capacity] Cache save error:", err)
        );
      }
    }

    // ── 3. Compute person-minutes per operation ─────────────────────────────
    // Only pending (non-completed) operations consume capacity.
    // Completed operations are kept in the list for reference but with 0 demand.
    for (const op of operations) {
      if (op.isCompleted) {
        // Already done — no capacity needed
        op.personMinutes = 0;
        continue;
      }
      if (op.isAtBase) {
        op.travelMinutesOneWay = 0;
        op.personMinutes = BASE_OPERATION_MINUTES;
      } else {
        // Use traffic-aware time if available, otherwise standard time
        const effectiveTravel = op.travelMinutesWithTraffic ?? op.travelMinutesOneWay;
        // Round trip + operation time, times number of people
        const timePerPerson = effectiveTravel * 2 + BASE_OPERATION_MINUTES;
        op.personMinutes = timePerPerson * op.peopleNeeded;
      }
    }

    // ── 4. Fetch staff schedules for this date ──────────────────────────────
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

    // Fetch user profiles for names
    const allUserIds = Array.from(new Set((schedules || []).map((s: any) => s.user_id)));
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, name")
      .in("id", allUserIds.length > 0 ? allUserIds : ["__none__"]);
    const profileNameById = new Map<string, string>();
    (profiles || []).forEach((p: any) => profileNameById.set(p.id, p.name || "Sin nombre"));

    // Fetch team_members to resolve team when staff_schedules.team_id is NULL
    // (staff_schedules often stores team_id as NULL; the canonical user→team
    //  association lives in team_members)
    const { data: teamMembers } = await sb
      .from("team_members")
      .select("user_id, team_id")
      .eq("organization_id", orgId)
      .in("user_id", allUserIds.length > 0 ? allUserIds : ["__none__"]);

    const userTeamIdFromMembers = new Map<string, string>();
    (teamMembers || []).forEach((tm: any) => {
      // If a user belongs to multiple teams, keep the first one found
      if (!userTeamIdFromMembers.has(tm.user_id)) {
        userTeamIdFromMembers.set(tm.user_id, tm.team_id);
      }
    });

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
      if (template.is_day_off) return;

      // Resolve team: prefer staff_schedules.team_id, fallback to team_members
      const effectiveTeamId = s.team_id || userTeamIdFromMembers.get(s.user_id) || null;
      const teamName = effectiveTeamId ? (teamNameById.get(effectiveTeamId) || "Unknown") : "Unknown";

      // Exclude Directiva — they don't participate in operational tasks
      const tn = teamName.toLowerCase();
      if (tn.includes("directiva") || tn.includes("direcci")) return;

      staffShifts.push({
        userId: s.user_id,
        teamName,
        startMinutes: toMinutes(template.start_time),
        endMinutes: toMinutes(template.end_time),
      });
    });

    // ── 5. Build hourly slots ───────────────────────────────────────────────
    let minHour = 24;
    let maxHour = 0;
    for (const op of operations) {
      if (op.hour < minHour) minHour = op.hour;
      if (op.hour > maxHour) maxHour = op.hour;
    }
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
          allOperations: [],
          deficitHours: [],
          tightHours: [],
          summary: "No hay operaciones ni personal programado para este día.",
          cacheStats: { hits: cacheHits, misses: cacheMisses, googleCalls },
          reinforcements: [],
        } as CapacityResult,
      });
    }

    if (minHour > maxHour) { minHour = 7; maxHour = 22; }

    const hourSlots: HourSlot[] = [];

    for (let h = minHour; h <= maxHour; h++) {
      const slotStart = h * 60;
      const slotEnd = (h + 1) * 60;

      // Operations in this hour (exclude completed — they no longer need capacity)
      const slotOps = operations.filter((op) => op.hour === h && !op.isCompleted);

      // Staff available in this hour
      const rentals: string[] = [];
      const preparacion: string[] = [];
      const mostrador: string[] = [];

      const seenUsers = new Set<string>();
      for (const ss of staffShifts) {
        if (seenUsers.has(ss.userId + "_" + ss.teamName)) continue;
        seenUsers.add(ss.userId + "_" + ss.teamName);

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

      // ── Demand split: Rental demand vs Escoba demand ──
      // Operations at base: 1 person (Rental/Mostrador) → BASE_OPERATION_MINUTES
      // Operations a domicilio: need 1 Rental + 1 Escoba
      //   - Rental demand: travel round-trip + operation time
      //   - Escoba demand: travel round-trip only (driver support)
      let rentalDemandMinutes = 0;  // demand that only Rentals/Mostrador can fulfill
      let escobaDemandMinutes = 0;  // demand that Preparación/Rentals/Mostrador can fulfill

      for (const op of slotOps) {
        if (op.isAtBase) {
          // At base: only needs 1 Rental/Mostrador person
          rentalDemandMinutes += BASE_OPERATION_MINUTES;
        } else {
          // A domicilio: needs 1 Rental + 1 Escoba
          const effectiveTravel = op.travelMinutesWithTraffic ?? op.travelMinutesOneWay;
          const roundTrip = effectiveTravel * 2;
          // Rental person: round trip + operation
          rentalDemandMinutes += roundTrip + BASE_OPERATION_MINUTES;
          // Escoba person: round trip only (drives the Rental there and back)
          escobaDemandMinutes += roundTrip;
        }
      }

      // Available capacity:
      // Rentals: 60 min/h — can do Rental work AND Escoba work
      // Mostrador: 30 min/h (50%) — can do Rental work AND Escoba work
      // Preparación: 60 min/h — can ONLY do Escoba work
      const rentalCapacity = rentals.length * 60 + mostrador.length * 30;
      const escobaCapacity = preparacion.length * 60;

      // First, satisfy Rental demand with Rental+Mostrador capacity
      const rentalOverflow = Math.max(0, rentalDemandMinutes - rentalCapacity);
      const rentalSurplus = Math.max(0, rentalCapacity - rentalDemandMinutes);

      // Escoba demand can be covered by: Preparación + leftover Rental/Mostrador capacity
      const totalEscobaCapacity = escobaCapacity + rentalSurplus;
      const escobaOverflow = Math.max(0, escobaDemandMinutes - totalEscobaCapacity);

      // Total: any overflow from either pool is unmet demand
      const totalNeeded = rentalDemandMinutes + escobaDemandMinutes;
      const totalUnmet = rentalOverflow + escobaOverflow;
      const availableMinutes = rentalCapacity + escobaCapacity;

      const utilization = availableMinutes > 0
        ? (totalNeeded > 0 ? Math.min(totalNeeded / availableMinutes, totalUnmet > 0 ? 1 : totalNeeded / availableMinutes) : 0)
        : (totalNeeded > 0 ? 1 : 0);

      let status: "sufficient" | "tight" | "deficit" = "sufficient";
      if (utilization > THRESHOLD_DEFICIT) status = "deficit";
      else if (utilization > THRESHOLD_TIGHT) status = "tight";

      // Build reinforcement suggestions for tight/deficit slots
      const slotReinforcements: ReinforcementSuggestion[] = [];
      if (status === "tight" || status === "deficit") {
        // Find Mostrador staff on shift this hour who are NOT already counted as Rentals/Preparación
        const rentalsSet = new Set(rentals);
        const prepSet = new Set(preparacion);
        for (const ss of staffShifts) {
          const tn = ss.teamName.toLowerCase();
          if (!tn.includes("mostrador")) continue;
          if (rentalsSet.has(ss.userId) || prepSet.has(ss.userId)) continue;

          let coversHour = false;
          if (ss.endMinutes <= ss.startMinutes) {
            coversHour = slotStart >= ss.startMinutes || slotEnd <= ss.endMinutes;
          } else {
            coversHour = slotStart >= ss.startMinutes && slotStart < ss.endMinutes;
          }
          if (!coversHour) continue;

          // Check if already added
          if (slotReinforcements.some((r) => r.userId === ss.userId)) continue;

          const startH = Math.floor(ss.startMinutes / 60);
          const startM = ss.startMinutes % 60;
          const endH = Math.floor(ss.endMinutes / 60);
          const endM = ss.endMinutes % 60;

          // Calculate all hours this person covers
          const availHours: number[] = [];
          if (ss.endMinutes > ss.startMinutes) {
            for (let hr = startH; hr < endH; hr++) availHours.push(hr);
          } else {
            for (let hr = startH; hr < 24; hr++) availHours.push(hr);
            for (let hr = 0; hr < endH; hr++) availHours.push(hr);
          }

          slotReinforcements.push({
            userId: ss.userId,
            name: profileNameById.get(ss.userId) || "Sin nombre",
            teamName: ss.teamName,
            shiftStart: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
            shiftEnd: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
            availableHours: availHours,
          });
        }
      }

      hourSlots.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`,
        operations: slotOps,
        totalPersonMinutes: totalNeeded,
        availablePersonMinutes: availableMinutes,
        availableStaff: { rentals, preparacion, mostrador },
        utilizationPct: Math.round(utilization * 100),
        status,
        reinforcements: slotReinforcements,
      });
    }

    // ── 6. Compute overall status ───────────────────────────────────────────
    const totalNeeded = hourSlots.reduce((s, h) => s + h.totalPersonMinutes, 0);
    const totalAvailable = hourSlots.reduce((s, h) => s + h.availablePersonMinutes, 0);
    const overallUtil = totalAvailable > 0 ? totalNeeded / totalAvailable : (totalNeeded > 0 ? 1 : 0);

    // Overall status uses the aggregated utilization across all hours,
    // not the worst individual slot. This prevents confusing situations
    // where a day shows 10% overall but "Déficit" because one slot is overloaded.
    // The individual deficit/tight hours are still reported for drill-down.
    let overallStatus: "sufficient" | "tight" | "deficit" = "sufficient";
    const overallUtilPct = Math.round(overallUtil * 100);
    if (overallUtilPct > THRESHOLD_DEFICIT * 100) overallStatus = "deficit";
    else if (overallUtilPct > THRESHOLD_TIGHT * 100) overallStatus = "tight";
    // However, if there are deficit hours, at minimum mark as "tight"
    // to signal that some slots need attention even if overall is low.
    if (overallStatus === "sufficient" && hourSlots.some((h) => h.status === "deficit")) {
      overallStatus = "tight";
    }

    const deficitHours = hourSlots.filter((h) => h.status === "deficit").map((h) => h.hour);
    const tightHours = hourSlots.filter((h) => h.status === "tight").map((h) => h.hour);

    // Build summary with travel info
    const nonBaseOps = operations.filter((o) => !o.isAtBase);
    const avgTravel = nonBaseOps.length > 0
      ? Math.round(nonBaseOps.reduce((s, o) => s + (o.travelMinutesWithTraffic ?? o.travelMinutesOneWay), 0) / nonBaseOps.length)
      : 0;

    let summary = "";
    if (overallStatus === "sufficient") {
      summary = `Personal suficiente para cubrir las ${operations.length} operaciones del día.`;
      if (nonBaseOps.length > 0) {
        summary += ` ${nonBaseOps.length} a domicilio (media ${avgTravel} min desplazamiento).`;
      }
    } else if (overallStatus === "tight") {
      summary = `Personal justo. ${tightHours.length} franja(s) con carga alta (${tightHours.map((h) => `${h}:00`).join(", ")}).`;
      if (nonBaseOps.length > 0) {
        summary += ` ${nonBaseOps.length} op. a domicilio (media ${avgTravel} min).`;
      }
    } else {
      summary = `Déficit de personal. ${deficitHours.length} franja(s) con sobrecarga (${deficitHours.map((h) => `${h}:00`).join(", ")}). Se recomienda refuerzo.`;
      if (nonBaseOps.length > 0) {
        summary += ` ${nonBaseOps.length} op. a domicilio (media ${avgTravel} min).`;
      }
    }

    // Aggregate unique reinforcements across all deficit/tight slots
    const allReinforcements: ReinforcementSuggestion[] = [];
    const seenReinforcement = new Set<string>();
    for (const slot of hourSlots) {
      for (const r of slot.reinforcements) {
        if (!seenReinforcement.has(r.userId)) {
          seenReinforcement.add(r.userId);
          // Merge available hours from all slots
          const allHoursForUser = hourSlots
            .filter((s) => s.reinforcements.some((sr) => sr.userId === r.userId))
            .map((s) => s.hour);
          allReinforcements.push({ ...r, availableHours: allHoursForUser });
        }
      }
    }

    // Update summary with reinforcement info
    if (allReinforcements.length > 0 && (overallStatus === "deficit" || overallStatus === "tight")) {
      summary += ` Posibles refuerzos de Mostrador: ${allReinforcements.map((r) => r.name).join(", ")}.`;
    }

    const result: CapacityResult = {
      date,
      overallStatus,
      overallUtilization: Math.round(overallUtil * 100),
      totalOperations: operations.filter((o) => !o.isCompleted).length,
      totalPersonMinutesNeeded: totalNeeded,
      totalPersonMinutesAvailable: totalAvailable,
      hourSlots,
      allOperations: operations,
      deficitHours,
      tightHours,
      summary,
      cacheStats: { hits: cacheHits, misses: cacheMisses, googleCalls },
      reinforcements: allReinforcements,
    };

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    if (err instanceof AuthError)
      return res.status(401).json({ ok: false, error: err.message });
    console.error("[staff-capacity]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
