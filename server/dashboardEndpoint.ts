/**
 * Consolidated Operational Dashboard endpoint.
 * Replaces 12 individual client-side Supabase queries with a single server-side request.
 * This reduces network round-trips from 12 to 1 per dashboard refresh.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

export async function handleGetOperationalDashboard(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    const serviceClient = getServiceClient();

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const in7days = new Date(
      today.getTime() + 7 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];
    const in30days = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

    // Execute all 12 queries in parallel on the server
    const [
      vehiclesResult,
      activeReservationsResult,
      todayReservationsDetailResult,
      upcomingReservationsResult,
      activeMovementsResult,
      activeRepairsResult,
      fleetResult,
      expiringContractsResult,
      pendingTasksHighResult,
      pendingTasksTotalResult,
      dirtyVehiclesResult,
      upcomingReservationsDetailResult,
    ] = await Promise.all([
      // 1. All non-archived vehicles with their status
      serviceClient
        .from("vehicles")
        .select("status")
        .eq("organization_id", orgId)
        .eq("is_archived", false),
      // 2. Active reservations count (not cancelled, not terminated, not archived)
      serviceClient
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .or("estado.not.ilike.%cancelada%,estado.is.null")
        .or("estado.not.ilike.%terminada%,estado.is.null"),
      // 3. Today's reservations detail (for operations list)
      serviceClient
        .from("reservations")
        .select(
          "id, cliente_nombre, cliente_apellido, auto, modelo, desde, hasta, lugar_entrega, lugar_devolucion, estado, confirmed_entrega_datetime, confirmed_devolucion_datetime, extras_contratados, tipo_actividad, entrega_completada, devolucion_completada, transfer_completado"
        )
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .or("estado.not.ilike.%cancelada%,estado.is.null")
        .or(
          `and(desde.gte.${todayStr}T00:00:00,desde.lte.${todayStr}T23:59:59),and(hasta.gte.${todayStr}T00:00:00,hasta.lte.${todayStr}T23:59:59)`
        )
        .order("desde", { ascending: true })
        .limit(100),
      // 4. Upcoming reservations count (next 7 days)
      serviceClient
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .gte("desde", `${todayStr}T00:00:00`)
        .lte("desde", `${in7days}T23:59:59`)
        .or("estado.not.ilike.%cancelada%,estado.is.null")
        .or("estado.not.ilike.%terminada%,estado.is.null"),
      // 5. Active movements count
      serviceClient
        .from("vehicle_movements")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "en_curso"),
      // 6. Active repairs count
      serviceClient
        .from("repairs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["pending", "in_progress", "waiting_parts"]),
      // 7. Fleet vehicles count
      serviceClient
        .from("fleet_vehicles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      // 8. Contracts expiring in next 30 days
      serviceClient
        .from("fleet_vehicles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .lte("fecha_fin_contrato", in30days)
        .gte("fecha_fin_contrato", todayStr),
      // 9. Pending tasks with urgent priority
      serviceClient
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress"])
        .eq("priority", "urgent"),
      // 10. All pending tasks
      serviceClient
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress"]),
      // 11. All dirty/incomplete vehicles
      serviceClient
        .from("vehicles")
        .select("id, matricula, modelo, status")
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .in("status", ["sucio", "incompleto"]),
      // 12. Upcoming reservations with vehicle info (for cross-referencing prep)
      serviceClient
        .from("reservations")
        .select("auto, desde, cliente_nombre, cliente_apellido, estado")
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .gte("desde", today.toISOString())
        .lte("desde", `${in7days}T23:59:59`)
        .or("estado.not.ilike.%cancelada%,estado.is.null")
        .or("estado.not.ilike.%terminada%,estado.is.null")
        .order("desde", { ascending: true }),
    ]);

    // Check for critical errors
    const allResults = [
      vehiclesResult,
      activeReservationsResult,
      todayReservationsDetailResult,
      upcomingReservationsResult,
      activeMovementsResult,
      activeRepairsResult,
      fleetResult,
      expiringContractsResult,
      pendingTasksHighResult,
      pendingTasksTotalResult,
      dirtyVehiclesResult,
      upcomingReservationsDetailResult,
    ];

    for (const result of allResults) {
      if (result.error) {
        console.error(
          "[getOperationalDashboard] Query error:",
          result.error.message
        );
      }
    }

    // Return raw query results for client-side processing
    // This keeps the same data shape but eliminates 12 network round-trips
    return res.json({
      vehicles: vehiclesResult.data || [],
      activeReservationsCount: activeReservationsResult.count || 0,
      todayReservationsDetail: todayReservationsDetailResult.data || [],
      upcomingReservationsCount: upcomingReservationsResult.count || 0,
      activeMovementsCount: activeMovementsResult.count || 0,
      activeRepairsCount: activeRepairsResult.count || 0,
      fleetCount: fleetResult.count || 0,
      expiringContractsCount: expiringContractsResult.count || 0,
      pendingTasksHighCount: pendingTasksHighResult.count || 0,
      pendingTasksTotalCount: pendingTasksTotalResult.count || 0,
      dirtyVehicles: dirtyVehiclesResult.data || [],
      upcomingReservationsDetail: upcomingReservationsDetailResult.data || [],
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getOperationalDashboard] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
