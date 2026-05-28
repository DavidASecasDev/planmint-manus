import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";

/**
 * Timeline Endpoint
 *
 * GET /api/public/operations/:orgSlug/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns vehicles grouped by category with their reservations in the given date range.
 * Used for the Gantt-style timeline view (Rently-like).
 *
 * Public version: no PII (client names anonymized to initials)
 * Authenticated version (via /api/timeline): full data with client names
 */

const ORG_SLUG_MAP: Record<string, string> = {
  "azul-ops": "a23a0d42-5af7-4cda-9955-569c10cc6714",
};

// Color mapping for reservation statuses (matching Rently)
// Custom category display order (as defined by the business)
const CATEGORY_ORDER: string[] = [
  "Mini Convertibles",
  "Familiar",
  "Compact Premium",
  "Cabrio Premium",
  "SUV",
  "SUV Premium",
  "Luxury Van",
  "Aventura",
  "Luxury Elite",
];

function categorySort(a: string, b: string): number {
  const idxA = CATEGORY_ORDER.indexOf(a);
  const idxB = CATEGORY_ORDER.indexOf(b);
  // Categories not in the list go to the end, sorted alphabetically
  if (idxA === -1 && idxB === -1) return a.localeCompare(b);
  if (idxA === -1) return 1;
  if (idxB === -1) return -1;
  return idxA - idxB;
}

const STATUS_COLORS: Record<string, string> = {
  Pendiente: "#93c5fd",    // Light blue
  Confirmada: "#fb923c",   // Orange
  "En curso": "#4ade80",   // Green
  Completada: "#9ca3af",   // Gray
  Cancelada: "#f87171",    // Red (striped)
  Cotizado: "#c084fc",     // Purple
  "No Show": "#f472b6",   // Pink
};

interface TimelineVehicle {
  id: string;
  plate: string;
  model: string | null;
  category: string | null;
}

interface TimelineReservation {
  id: string;
  vehiclePlate: string;
  startDate: string;       // ISO date
  endDate: string;         // ISO date
  status: string;
  color: string;
  clientName: string | null;      // Full name (auth) or initials (public)
  clientPhone: string | null;     // Only in auth version
  model: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  origin: string | null;
  paid: string | null;
  externalId: string | null;
  durationDays: number;
}

interface TimelineGroup {
  category: string;
  vehicles: Array<{
    plate: string;
    model: string | null;
    isCollaborator: boolean;
    reservations: TimelineReservation[];
  }>;
}

/**
 * Resolve a meaningful category name from the raw `categoria` field.
 * Some vehicles have numeric Rently category IDs instead of names.
 * When that happens, fall back to marca (brand) or "Otros".
 */
function resolveCategory(rawCategoria: string | null, marca: string): string {
  if (!rawCategoria || /^\d+$/.test(rawCategoria.trim())) {
    // Numeric ID or empty → use marca as category
    return marca || "Otros";
  }
  // Normalize case: "LUXURY ELITE" → "Luxury Elite", but preserve short acronyms like "SUV"
  return rawCategoria
    .split(" ")
    .map(w => {
      // Preserve short uppercase words (likely acronyms: SUV, BMW, etc.)
      if (w.length <= 3 && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function getInitials(nombre: string | null, apellido: string | null): string {
  const n = nombre?.trim().charAt(0).toUpperCase() || "";
  const a = apellido?.trim().charAt(0).toUpperCase() || "";
  return `${n}${a}` || "??";
}

function calculateDays(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const start = new Date(from.substring(0, 10));
  const end = new Date(to.substring(0, 10));
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

export async function handlePublicTimeline(req: Request, res: Response) {
  try {
    const { orgSlug } = req.params;
    const organizationId = ORG_SLUG_MAP[orgSlug];
    if (!organizationId) {
      return res.status(404).json({ error: "Not found" });
    }

    // Parse date range (default: -7 days to +30 days from today)
    const now = new Date();
    const madridNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const todayStr = madridNow.toISOString().split("T")[0];

    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;

    let fromDate: string;
    let toDate: string;

    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      fromDate = fromParam;
    } else {
      const d = new Date(madridNow);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().split("T")[0];
    }

    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      toDate = toParam;
    } else {
      const d = new Date(madridNow);
      d.setDate(d.getDate() + 30);
      toDate = d.toISOString().split("T")[0];
    }

    const serviceClient = getServiceClient();

    // 1. Fetch all active vehicles with their fleet info (for marca/category)
    const { data: vehicles, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, matricula, modelo, categoria, fleet_vehicle_id")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .order("matricula", { ascending: true });

    if (vehError) {
      console.error("[timeline] Error fetching vehicles:", vehError);
      return res.status(500).json({ error: "Internal error" });
    }

    // Get marca from fleet_vehicles
    let fleetMarcaMap = new Map<string, string>();
    if (vehicles && vehicles.length > 0) {
      const fleetIds = vehicles.map(v => v.fleet_vehicle_id).filter(Boolean);
      if (fleetIds.length > 0) {
        const { data: fleetVehicles } = await serviceClient
          .from("fleet_vehicles")
          .select("id, marca")
          .in("id", fleetIds);
        if (fleetVehicles) {
          for (const fv of fleetVehicles) {
            if (fv.marca) fleetMarcaMap.set(fv.id, fv.marca);
          }
        }
      }
    }

    // 2. Fetch reservations that overlap with the date range
    // A reservation overlaps if: desde <= toDate AND hasta >= fromDate
    const { data: reservations, error: resError } = await serviceClient
      .from("reservations")
      .select("id, external_reservation_id, auto, modelo, categoria, desde, hasta, estado, cliente_nombre, cliente_apellido, telefono, lugar_entrega, lugar_devolucion, origen_reserva, pagado")
      .eq("organization_id", organizationId)
      .neq("estado", "Cancelada")
      .lte("desde", `${toDate}T23:59:59`)
      .gte("hasta", `${fromDate}T00:00:00`);

    if (resError) {
      console.error("[timeline] Error fetching reservations:", resError);
      return res.status(500).json({ error: "Internal error" });
    }

    // 3. Group reservations by vehicle plate
    const reservationsByPlate = new Map<string, TimelineReservation[]>();
    for (const r of reservations || []) {
      const plate = r.auto || "";
      if (!plate) continue;

      const startDate = r.desde?.substring(0, 10) || fromDate;
      const endDate = r.hasta?.substring(0, 10) || toDate;
      const status = r.estado || "Pendiente";

      const reservation: TimelineReservation = {
        id: r.id,
        vehiclePlate: plate,
        startDate,
        endDate,
        status,
        color: STATUS_COLORS[status] || "#9ca3af",
        clientName: getInitials(r.cliente_nombre, r.cliente_apellido),
        clientPhone: null, // Public version: no phone
        model: r.modelo,
        pickupLocation: r.lugar_entrega,
        dropoffLocation: r.lugar_devolucion,
        origin: r.origen_reserva,
        paid: r.pagado,
        externalId: r.external_reservation_id,
        durationDays: calculateDays(r.desde, r.hasta),
      };

      if (!reservationsByPlate.has(plate)) {
        reservationsByPlate.set(plate, []);
      }
      reservationsByPlate.get(plate)!.push(reservation);
    }

    // 4. Group vehicles by category
    const categoryMap = new Map<string, TimelineGroup>();
    const knownPlates = new Set<string>();
    for (const v of vehicles || []) {
      const marca = v.fleet_vehicle_id ? (fleetMarcaMap.get(v.fleet_vehicle_id) || "") : "";
      const category = resolveCategory(v.categoria, marca);
      const plate = v.matricula;
      knownPlates.add(plate);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, vehicles: [] });
      }

      categoryMap.get(category)!.vehicles.push({
        plate,
        model: v.modelo ? `${marca ? marca + " " : ""}${v.modelo}` : marca || null,
        isCollaborator: false,
        reservations: reservationsByPlate.get(plate) || [],
      });
    }

    // 4b. Auto-discovery: add vehicles from reservations that are not in the vehicles table
    // This handles collaborator vehicles (e.g., ClickRent) that have reservations but aren't registered
    for (const [plate, plateReservations] of Array.from(reservationsByPlate.entries())) {
      if (knownPlates.has(plate)) continue; // Already included

      // Derive category and model from the reservation data
      const rawRes = (reservations || []).find(r => r.auto === plate);
      const discoveredCategory = rawRes?.categoria || "Otros";
      const normalizedCategory = resolveCategory(discoveredCategory, "");

      if (!categoryMap.has(normalizedCategory)) {
        categoryMap.set(normalizedCategory, { category: normalizedCategory, vehicles: [] });
      }

      categoryMap.get(normalizedCategory)!.vehicles.push({
        plate,
        model: rawRes?.modelo || plateReservations[0]?.model || null,
        isCollaborator: true,
        reservations: plateReservations,
      });
    }

    // Sort categories by custom business order and vehicles within
    const groups = Array.from(categoryMap.values()).sort((a, b) =>
      categorySort(a.category, b.category)
    );
    for (const g of groups) {
      g.vehicles.sort((a, b) => a.plate.localeCompare(b.plate));
    }

    return res.json({
      fromDate,
      toDate,
      today: todayStr,
      groups,
      statusColors: STATUS_COLORS,
    });
  } catch (err) {
    console.error("[timeline] Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/**
 * Authenticated timeline endpoint for PlanMint internal use.
 * Returns full client names and phone numbers.
 *
 * GET /api/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Requires: Supabase auth token
 */
export async function handleAuthenticatedTimeline(req: Request, res: Response) {
  try {
    // Extract org ID from authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.substring(7);

    const serviceClient = getServiceClient();

    // Verify user and get their org
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user's organization
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return res.status(403).json({ error: "No organization" });
    }

    const organizationId = profile.organization_id;

    // Parse date range
    const now = new Date();
    const madridNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const todayStr = madridNow.toISOString().split("T")[0];

    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;

    let fromDate: string;
    let toDate: string;

    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      fromDate = fromParam;
    } else {
      const d = new Date(madridNow);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().split("T")[0];
    }

    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      toDate = toParam;
    } else {
      const d = new Date(madridNow);
      d.setDate(d.getDate() + 30);
      toDate = d.toISOString().split("T")[0];
    }

    // 1. Fetch all active vehicles
    const { data: vehicles, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, matricula, modelo, categoria, fleet_vehicle_id")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .order("matricula", { ascending: true });

    if (vehError) {
      return res.status(500).json({ error: "Internal error" });
    }

    // Get marca from fleet_vehicles
    let fleetMarcaMap = new Map<string, string>();
    if (vehicles && vehicles.length > 0) {
      const fleetIds = vehicles.map(v => v.fleet_vehicle_id).filter(Boolean);
      if (fleetIds.length > 0) {
        const { data: fleetVehicles } = await serviceClient
          .from("fleet_vehicles")
          .select("id, marca")
          .in("id", fleetIds);
        if (fleetVehicles) {
          for (const fv of fleetVehicles) {
            if (fv.marca) fleetMarcaMap.set(fv.id, fv.marca);
          }
        }
      }
    }

    // 2. Fetch reservations overlapping the date range (full data)
    const { data: reservations, error: resError } = await serviceClient
      .from("reservations")
      .select("id, external_reservation_id, auto, modelo, categoria, desde, hasta, estado, cliente_nombre, cliente_apellido, telefono, lugar_entrega, lugar_devolucion, origen_reserva, pagado")
      .eq("organization_id", organizationId)
      .neq("estado", "Cancelada")
      .lte("desde", `${toDate}T23:59:59`)
      .gte("hasta", `${fromDate}T00:00:00`);

    if (resError) {
      return res.status(500).json({ error: "Internal error" });
    }

    // 3. Group reservations by plate (with full names)
    const reservationsByPlate = new Map<string, TimelineReservation[]>();
    for (const r of reservations || []) {
      const plate = r.auto || "";
      if (!plate) continue;

      const startDate = r.desde?.substring(0, 10) || fromDate;
      const endDate = r.hasta?.substring(0, 10) || toDate;
      const status = r.estado || "Pendiente";

      const fullName = [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(" ") || null;

      const reservation: TimelineReservation = {
        id: r.id,
        vehiclePlate: plate,
        startDate,
        endDate,
        status,
        color: STATUS_COLORS[status] || "#9ca3af",
        clientName: fullName,
        clientPhone: r.telefono,
        model: r.modelo,
        pickupLocation: r.lugar_entrega,
        dropoffLocation: r.lugar_devolucion,
        origin: r.origen_reserva,
        paid: r.pagado,
        externalId: r.external_reservation_id,
        durationDays: calculateDays(r.desde, r.hasta),
      };

      if (!reservationsByPlate.has(plate)) {
        reservationsByPlate.set(plate, []);
      }
      reservationsByPlate.get(plate)!.push(reservation);
    }

    // 4. Group vehicles by category
    const categoryMap = new Map<string, TimelineGroup>();
    const knownPlates = new Set<string>();
    for (const v of vehicles || []) {
      const marca = v.fleet_vehicle_id ? (fleetMarcaMap.get(v.fleet_vehicle_id) || "") : "";
      const category = resolveCategory(v.categoria, marca);
      const plate = v.matricula;
      knownPlates.add(plate);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, vehicles: [] });
      }

      categoryMap.get(category)!.vehicles.push({
        plate,
        model: v.modelo ? `${marca ? marca + " " : ""}${v.modelo}` : marca || null,
        isCollaborator: false,
        reservations: reservationsByPlate.get(plate) || [],
      });
    }

    // 4b. Auto-discovery: add vehicles from reservations not in the vehicles table
    for (const [plate, plateReservations] of Array.from(reservationsByPlate.entries())) {
      if (knownPlates.has(plate)) continue;

      const rawRes = (reservations || []).find(r => r.auto === plate);
      const discoveredCategory = rawRes?.categoria || "Otros";
      const normalizedCategory = resolveCategory(discoveredCategory, "");

      if (!categoryMap.has(normalizedCategory)) {
        categoryMap.set(normalizedCategory, { category: normalizedCategory, vehicles: [] });
      }

      categoryMap.get(normalizedCategory)!.vehicles.push({
        plate,
        model: rawRes?.modelo || plateReservations[0].model || null,
        isCollaborator: true,
        reservations: plateReservations,
      });
    }

    const groups = Array.from(categoryMap.values()).sort((a, b) =>
      categorySort(a.category, b.category)
    );
    for (const g of groups) {
      g.vehicles.sort((a, b) => a.plate.localeCompare(b.plate));
    }

    return res.json({
      fromDate,
      toDate,
      today: todayStr,
      groups,
      statusColors: STATUS_COLORS,
    });
  } catch (err) {
    console.error("[timeline-auth] Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
