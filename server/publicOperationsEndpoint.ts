import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import { ORG_SLUG_MAP, EXCLUDED_PLATES } from "../shared/const";

/**
 * Public Operations Endpoint
 * 
 * GET /api/public/operations/:orgSlug
 * Query params: ?date=YYYY-MM-DD&location=all
 * 
 * Returns anonymized, read-only data for the commercial team:
 * - Operations by hour (deliveries/returns count)
 * - Vehicle fleet status (counts by status)
 * - Vehicle availability grouped by model
 * 
 * No authentication required. No sensitive data exposed.
 */

interface HourlyOperation {
  hour: number;
  entregas: number;
  devoluciones: number;
  total: number;
  locations: string[];
}

interface VehicleStatusSummary {
  limpio: number;
  sucio: number;
  incompleto: number;
  en_servicio: number;
  alquilado: number;
  total: number;
}

interface ModelAvailability {
  modelo: string;
  marca: string | null;
  categoria: string | null;
  limpios: number;
  pendientes: number; // sucio + incompleto
  no_disponibles: number; // alquilado + en_servicio
  total: number;
}

export async function handlePublicOperations(req: Request, res: Response) {
  try {
    const { orgSlug } = req.params;
    const organizationId = ORG_SLUG_MAP[orgSlug];

    if (!organizationId) {
      return res.status(404).json({ error: "Not found" });
    }

    // Parse date param (default to today in Europe/Madrid timezone)
    const dateParam = req.query.date as string | undefined;
    const locationFilter = req.query.location as string | undefined;

    // Use provided date or today
    let targetDate: string;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = dateParam;
    } else {
      // Get today in Europe/Madrid timezone
      const now = new Date();
      const madridDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
      targetDate = madridDate.toISOString().split("T")[0];
    }

    const serviceClient = getServiceClient();

    // ─── 1. Fetch operations for the target date ─────────────────────────────
    // Get reservations where desde (delivery) or hasta (return) falls on the target date
    // Use a single OR filter that captures:
    // 1. desde is on target date (for entregas and transfers)
    // 2. hasta is on target date (for devoluciones)
    // 3. confirmed_entrega_datetime is on target date
    // 4. confirmed_devolucion_datetime is on target date
    const { data: reservations, error: resError } = await serviceClient
      .from("reservations")
      .select("id, desde, hasta, confirmed_entrega_datetime, confirmed_devolucion_datetime, lugar_entrega, lugar_devolucion, lugar_entrega_direccion, lugar_devolucion_direccion, auto, modelo, tipo_actividad, estado, entrega_completada, devolucion_completada, transfer_completado, asignado_rental_id, asignado_rental_entrega_id, asignado_rental_devolucion_id, asignado_escoba_id, asignado_escoba_entrega_id, asignado_escoba_devolucion_id, cliente_nombre, cliente_apellido")
      .eq("organization_id", organizationId)
      .or("estado.neq.Cancelada,estado.is.null")
      .or(`and(desde.gte.${targetDate}T00:00:00,desde.lte.${targetDate}T23:59:59),and(hasta.gte.${targetDate}T00:00:00,hasta.lte.${targetDate}T23:59:59),and(confirmed_entrega_datetime.gte.${targetDate}T00:00:00,confirmed_entrega_datetime.lte.${targetDate}T23:59:59),and(confirmed_devolucion_datetime.gte.${targetDate}T00:00:00,confirmed_devolucion_datetime.lte.${targetDate}T23:59:59)`);

    if (resError) {
      console.error("[public-ops] Error fetching reservations:", resError);
      return res.status(500).json({ error: "Internal error" });
    }

    // ─── Fetch assigned rental names from profiles ────────────────────────────
    const allAssigneeIds = new Set<string>();
    for (const r of reservations || []) {
      if (r.asignado_rental_id) allAssigneeIds.add(r.asignado_rental_id);
      if (r.asignado_rental_entrega_id) allAssigneeIds.add(r.asignado_rental_entrega_id);
      if (r.asignado_rental_devolucion_id) allAssigneeIds.add(r.asignado_rental_devolucion_id);
      if (r.asignado_escoba_id) allAssigneeIds.add(r.asignado_escoba_id);
      if (r.asignado_escoba_entrega_id) allAssigneeIds.add(r.asignado_escoba_entrega_id);
      if (r.asignado_escoba_devolucion_id) allAssigneeIds.add(r.asignado_escoba_devolucion_id);
    }

    let profileNameMap = new Map<string, string>();
    if (allAssigneeIds.size > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, name")
        .in("id", Array.from(allAssigneeIds));
      if (profiles) {
        for (const p of profiles) {
          if (p.name) profileNameMap.set(p.id, p.name);
        }
      }
    }

    // ─── Fetch en_camino_tracking records for today ──────────────────────────
    const { data: enCaminoRecords } = await serviceClient
      .from("en_camino_tracking")
      .select("reservation_id, operation_type, en_camino_at, assigned_user_name, llego_at")
      .gte("en_camino_at", `${targetDate}T00:00:00.000Z`)
      .lte("en_camino_at", `${targetDate}T23:59:59.999Z`)
      .is("llego_at", null);

    // Build a map: reservation_id + operation_type -> en_camino record
    const enCaminoMap = new Map<string, { en_camino_at: string; assigned_user_name: string | null }>();
    for (const rec of enCaminoRecords || []) {
      enCaminoMap.set(`${rec.reservation_id}_${rec.operation_type}`, {
        en_camino_at: rec.en_camino_at,
        assigned_user_name: rec.assigned_user_name,
      });
    }

    // ─── Fetch vehicle statuses for cleanliness indicator ─────────────────────
    // Build a map: matricula (uppercase) -> effective status
    // Uses task-based logic: if all cleaning tasks are completed -> "limpio"
    // Otherwise falls back to vehicles.status
    const vehicleStatusMap = new Map<string, string>();
    const { data: allVehicles } = await serviceClient
      .from("vehicles")
      .select("id, matricula, status")
      .eq("organization_id", organizationId)
      .or("is_archived.eq.false,is_archived.is.null");

    if (allVehicles && allVehicles.length > 0) {
      // First set base status from vehicles table
      for (const v of allVehicles) {
        if (v.matricula && v.status) {
          vehicleStatusMap.set(v.matricula.toUpperCase().trim(), v.status);
        }
      }

      // Now fetch cleaning tasks to override status for vehicles with all tasks done
      const vehicleIds = allVehicles.map((v: any) => v.id);
      const { data: cleaningTasks } = await serviceClient
        .from("vehicle_cleaning_tasks")
        .select("vehicle_id, task_key, completed")
        .in("vehicle_id", vehicleIds);

      if (cleaningTasks && cleaningTasks.length > 0) {
        // Build map: vehicle_id -> { total, completed } (excluding inicio_prep)
        const taskProgressByVehicle = new Map<string, { total: number; completed: number }>();
        for (const task of cleaningTasks) {
          if (task.task_key === "inicio_prep") continue;
          const progress = taskProgressByVehicle.get(task.vehicle_id) || { total: 0, completed: 0 };
          progress.total++;
          if (task.completed) progress.completed++;
          taskProgressByVehicle.set(task.vehicle_id, progress);
        }

        // Override status: if all tasks completed -> "limpio", if some -> "incompleto"
        for (const v of allVehicles) {
          if (!v.matricula) continue;
          const progress = taskProgressByVehicle.get(v.id);
          if (!progress || progress.total === 0) continue; // No tasks = keep original status
          const key = v.matricula.toUpperCase().trim();
          const currentStatus = vehicleStatusMap.get(key);
          // Only override for sucio/incompleto vehicles (not alquilado/en_servicio)
          if (currentStatus === "sucio" || currentStatus === "incompleto") {
            if (progress.completed >= progress.total) {
              vehicleStatusMap.set(key, "limpio");
            } else if (progress.completed > 0) {
              vehicleStatusMap.set(key, "incompleto");
            }
          }
        }
      }
    }

    // Filter to only reservations that have operations on the target date
    const operations: Array<{
      type: "entrega" | "devolucion" | "transfer";
      hour: number;
      hourMinute: string; // "HH:MM" format
      location: string;
      address: string | null;
      modelo: string;
      auto: string;
      completed: boolean;
      assignedRentalName: string | null;
      assignedEscobaName: string | null;
      clientName: string | null;
      enCamino: boolean;
      enCaminoAt: string | null;
      vehicleStatus: string | null; // limpio, sucio, incompleto, alquilado, en_servicio
    }> = [];

    for (const r of reservations || []) {
      // Skip excluded plates (dummy/test vehicles)
      const plate = (r.auto || "").toUpperCase().trim();
      if (EXCLUDED_PLATES.includes(plate)) continue;

      // Handle transfers (tipo_actividad = 'Transfer') - they only use desde as the transfer datetime
      if (r.tipo_actividad === 'Transfer') {
        const transferDate = r.confirmed_entrega_datetime?.substring(0, 10) || r.desde?.substring(0, 10);
        if (transferDate === targetDate) {
          const transferTime = r.confirmed_entrega_datetime || r.desde;
          const hour = transferTime ? parseInt(transferTime.substring(11, 13)) || 0 : 0;
          const minutes = transferTime ? parseInt(transferTime.substring(14, 16)) || 0 : 0;
          const location = r.lugar_entrega || r.lugar_devolucion || "Sin ubicación";
          const address = r.lugar_entrega_direccion || r.lugar_devolucion_direccion || null;

          if (!locationFilter || locationFilter === "all" || location.toLowerCase().includes(locationFilter.toLowerCase())) {
            const assigneeId = r.asignado_rental_id;
            const enCaminoKey = `${r.id}_entrega`;
            const enCaminoRec = enCaminoMap.get(enCaminoKey);
            operations.push({
              type: "transfer",
              hour,
              hourMinute: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
              location,
              address,
              modelo: r.modelo || "Desconocido",
              auto: r.auto || "",
              completed: r.transfer_completado || false,
              assignedRentalName: assigneeId ? (profileNameMap.get(assigneeId) || null) : null,
              assignedEscobaName: (() => { const eid = r.asignado_escoba_id; return eid ? (profileNameMap.get(eid) || null) : null; })(),
              clientName: [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(" ") || null,
              enCamino: !!enCaminoRec,
              enCaminoAt: enCaminoRec?.en_camino_at || null,
              vehicleStatus: r.auto ? (vehicleStatusMap.get(r.auto.toUpperCase().trim()) || null) : null,
            });
          }
        }
        continue; // Skip normal entrega/devolucion processing for transfers
      }

      // Check if delivery is on target date
      const desdeDate = r.confirmed_entrega_datetime?.substring(0, 10) || r.desde?.substring(0, 10);
      if (desdeDate === targetDate) {
        const desdeTime = r.confirmed_entrega_datetime || r.desde;
        const hour = desdeTime ? parseInt(desdeTime.substring(11, 13)) || 0 : 0;
        const location = r.lugar_entrega || "Sin ubicación";
        const address = r.lugar_entrega_direccion || null;

        // Apply location filter
        if (!locationFilter || locationFilter === "all" || location.toLowerCase().includes(locationFilter.toLowerCase())) {
          const minutes = desdeTime ? parseInt(desdeTime.substring(14, 16)) || 0 : 0;
          const assigneeId = r.asignado_rental_entrega_id || r.asignado_rental_id;
          const enCaminoKey = `${r.id}_entrega`;
          const enCaminoRec = enCaminoMap.get(enCaminoKey);
          operations.push({
            type: "entrega",
            hour,
            hourMinute: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
            location,
            address,
            modelo: r.modelo || "Desconocido",
            auto: r.auto || "",
            completed: r.entrega_completada || false,
            assignedRentalName: assigneeId ? (profileNameMap.get(assigneeId) || null) : null,
            assignedEscobaName: (() => { const eid = r.asignado_escoba_entrega_id || r.asignado_escoba_id; return eid ? (profileNameMap.get(eid) || null) : null; })(),
            clientName: [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(" ") || null,
            enCamino: !!enCaminoRec,
            enCaminoAt: enCaminoRec?.en_camino_at || null,
            vehicleStatus: r.auto ? (vehicleStatusMap.get(r.auto.toUpperCase().trim()) || null) : null,
          });
        }
      }

      // Check if return is on target date
      const hastaDate = r.confirmed_devolucion_datetime?.substring(0, 10) || r.hasta?.substring(0, 10);
      if (hastaDate === targetDate) {
        const hastaTime = r.confirmed_devolucion_datetime || r.hasta;
        const hour = hastaTime ? parseInt(hastaTime.substring(11, 13)) || 0 : 0;
        const location = r.lugar_devolucion || "Sin ubicación";
        const address = r.lugar_devolucion_direccion || null;

        // Apply location filter
        if (!locationFilter || locationFilter === "all" || location.toLowerCase().includes(locationFilter.toLowerCase())) {
          const minutes = hastaTime ? parseInt(hastaTime.substring(14, 16)) || 0 : 0;
          const assigneeId = r.asignado_rental_devolucion_id || r.asignado_rental_id;
          const enCaminoKey = `${r.id}_devolucion`;
          const enCaminoRec = enCaminoMap.get(enCaminoKey);
          operations.push({
            type: "devolucion",
            hour,
            hourMinute: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
            location,
            address,
            modelo: r.modelo || "Desconocido",
            auto: r.auto || "",
            completed: r.devolucion_completada || false,
            assignedRentalName: assigneeId ? (profileNameMap.get(assigneeId) || null) : null,
            assignedEscobaName: (() => { const eid = r.asignado_escoba_devolucion_id || r.asignado_escoba_id; return eid ? (profileNameMap.get(eid) || null) : null; })(),
            clientName: [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(" ") || null,
            enCamino: !!enCaminoRec,
            enCaminoAt: enCaminoRec?.en_camino_at || null,
            vehicleStatus: r.auto ? (vehicleStatusMap.get(r.auto.toUpperCase().trim()) || null) : null,
          });
        }
      }
    }

    // ─── 2. Group operations by hour ─────────────────────────────────────────
    const hourlyMap = new Map<number, HourlyOperation>();
    for (let h = 7; h <= 22; h++) {
      hourlyMap.set(h, { hour: h, entregas: 0, devoluciones: 0, total: 0, locations: [] });
    }

    for (const op of operations) {
      const hourData = hourlyMap.get(op.hour);
      if (hourData) {
        if (op.type === "entrega" || op.type === "transfer") hourData.entregas++;
        else hourData.devoluciones++;
        hourData.total++;
        if (!hourData.locations.includes(op.location)) {
          hourData.locations.push(op.location);
        }
      } else {
        // Operations outside 7-22 range
        hourlyMap.set(op.hour, {
          hour: op.hour,
          entregas: (op.type === "entrega" || op.type === "transfer") ? 1 : 0,
          devoluciones: op.type === "devolucion" ? 1 : 0,
          total: 1,
          locations: [op.location],
        });
      }
    }

    const hourlyOperations = Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour);

    // ─── 3. Calculate load levels and recommendations ────────────────────────
    const maxOpsPerHour = Math.max(...hourlyOperations.map(h => h.total), 1);
    const avgOpsPerHour = operations.length / Math.max(hourlyOperations.filter(h => h.total > 0).length, 1);

    const hourlyWithLoad = hourlyOperations.map(h => ({
      ...h,
      load: h.total === 0 ? "libre" as const :
            h.total <= Math.max(avgOpsPerHour * 0.7, 2) ? "baja" as const :
            h.total <= Math.max(avgOpsPerHour * 1.3, 4) ? "media" as const :
            "alta" as const,
    }));

    // Recommended slots: hours with low or no load between 8-20
    const recommendedSlots = hourlyWithLoad
      .filter(h => h.hour >= 8 && h.hour <= 20 && (h.load === "libre" || h.load === "baja"))
      .map(h => ({ hour: h.hour, load: h.load, currentOps: h.total }));

    // Saturated slots
    const saturatedSlots = hourlyWithLoad
      .filter(h => h.load === "alta")
      .map(h => ({ hour: h.hour, total: h.total, entregas: h.entregas, devoluciones: h.devoluciones }));

    // ─── 4. Fetch vehicle fleet status ───────────────────────────────────────
    // vehicles table doesn't have marca, so we join with fleet_vehicles via fleet_vehicle_id
    const { data: vehicles, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, modelo, categoria, status, fleet_vehicle_id")
      .eq("organization_id", organizationId)
      .or("is_archived.eq.false,is_archived.is.null");

    // Fetch fleet_vehicles to get marca for each vehicle
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

    if (vehError) {
      console.error("[public-ops] Error fetching vehicles:", vehError);
      return res.status(500).json({ error: "Internal error" });
    }

    // Status summary
    const statusSummary: VehicleStatusSummary = {
      limpio: 0,
      sucio: 0,
      incompleto: 0,
      en_servicio: 0,
      alquilado: 0,
      total: 0,
    };

    for (const v of vehicles || []) {
      statusSummary.total++;
      const s = v.status as keyof VehicleStatusSummary;
      if (s in statusSummary && s !== "total") {
        statusSummary[s]++;
      }
    }

    // ─── 5. Group by model ───────────────────────────────────────────────────
    const modelMap = new Map<string, ModelAvailability>();

    for (const v of vehicles || []) {
      const key = v.modelo || "Sin modelo";
      const marca = v.fleet_vehicle_id ? (fleetMarcaMap.get(v.fleet_vehicle_id) || null) : null;
      const existing = modelMap.get(key);
      if (existing) {
        existing.total++;
        if (v.status === "limpio") existing.limpios++;
        else if (v.status === "sucio" || v.status === "incompleto") existing.pendientes++;
        else existing.no_disponibles++;
        // Keep marca from first vehicle with a non-null value
        if (!existing.marca && marca) existing.marca = marca;
      } else {
        modelMap.set(key, {
          modelo: key,
          marca: marca,
          categoria: v.categoria || null,
          limpios: v.status === "limpio" ? 1 : 0,
          pendientes: (v.status === "sucio" || v.status === "incompleto") ? 1 : 0,
          no_disponibles: (v.status === "alquilado" || v.status === "en_servicio") ? 1 : 0,
          total: 1,
        });
      }
    }

    const modelAvailability = Array.from(modelMap.values())
      .sort((a, b) => b.limpios - a.limpios || a.modelo.localeCompare(b.modelo));

    // ─── 6. Get distinct locations for filter options ─────────────────────────
    const allLocations = new Set<string>();
    for (const op of operations) {
      if (op.location !== "Sin ubicación") allLocations.add(op.location);
    }

    // ─── Response ────────────────────────────────────────────────────────────
    // Sort operations by time for the table view
    const sortedOperations = [...operations].sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.hourMinute.localeCompare(b.hourMinute);
    });

    return res.json({
      date: targetDate,
      summary: {
        totalOperations: operations.length,
        totalEntregas: operations.filter(o => o.type === "entrega").length,
        totalDevoluciones: operations.filter(o => o.type === "devolucion").length,
        totalTransfers: operations.filter(o => o.type === "transfer").length,
        completedOps: operations.filter(o => o.completed).length,
        pendingOps: operations.filter(o => !o.completed).length,
      },
      operations: sortedOperations.map(op => ({
        type: op.type,
        time: op.hourMinute,
        location: op.location,
        address: op.address || null,
        modelo: op.modelo,
        auto: op.auto,
        completed: op.completed,
        assignedRentalName: op.assignedRentalName || null,
        assignedEscobaName: op.assignedEscobaName || null,
        clientName: op.clientName || null,
        enCamino: op.enCamino || false,
        enCaminoAt: op.enCaminoAt || null,
        vehicleStatus: op.vehicleStatus || null,
      })),
      hourly: hourlyWithLoad,
      recommendedSlots,
      saturatedSlots,
      fleet: {
        status: statusSummary,
        byModel: modelAvailability,
      },
      filters: {
        locations: Array.from(allLocations).sort(),
      },
    });
  } catch (err) {
    console.error("[public-ops] Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
