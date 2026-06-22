/**
 * Reinforcement Endpoint — Returns operations needing assignment in a given hour slot
 * and handles assigning a reinforcement employee to an operation.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UnassignedOperation {
  reservationId: string;
  type: "Entrega" | "Devolución" | "Transfer";
  datetime: string;
  hour: number;
  location: string | null;
  clientName: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  reservationCode: string | null;
  /** Which role is missing: rental, escoba, or both */
  needsRental: boolean;
  needsEscoba: boolean;
  /** Current assignees (if partially assigned) */
  currentRentalName: string | null;
  currentEscobaName: string | null;
}

// ─── Helper: Get assignment fields based on operation type ──────────────────

function getAssignmentFields(opType: "Entrega" | "Devolución" | "Transfer") {
  if (opType === "Transfer") {
    return {
      rentalId: "asignado_rental_id",
      rentalTeamId: "asignado_rental_team_id",
      escobaId: "asignado_escoba_id",
      escobaTeamId: "asignado_escoba_team_id",
    };
  }
  const suffix = opType === "Entrega" ? "_entrega" : "_devolucion";
  return {
    rentalId: `asignado_rental${suffix}_id`,
    rentalTeamId: `asignado_rental${suffix}_team_id`,
    escobaId: `asignado_escoba${suffix}_id`,
    escobaTeamId: `asignado_escoba${suffix}_team_id`,
  };
}

// ─── Handler: Get unassigned operations for a given hour ────────────────────

export async function handleGetUnassignedOperations(req: Request, res: Response) {
  try {
    const { organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const { date, hour } = req.body;
    if (!date) return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" });
    if (hour === undefined || hour === null)
      return res.status(400).json({ ok: false, error: "hour is required (0-23)" });

    const targetHour = parseInt(String(hour), 10);
    const sb = getServiceClient();

    // Fetch reservations for this date
    const { data: reservations, error: resErr } = await sb
      .from("reservations")
      .select(
        `id, desde, hasta, tipo_actividad, estado,
         confirmed_entrega_datetime, confirmed_devolucion_datetime,
         lugar_entrega, lugar_devolucion,
         lugar_entrega_direccion, lugar_entrega_ciudad,
         lugar_devolucion_direccion, lugar_devolucion_ciudad,
         cliente_nombre, cliente_apellido, modelo, auto, external_reservation_id,
         entrega_completada, devolucion_completada, transfer_completado,
         asignado_rental_id, asignado_rental_team_id,
         asignado_escoba_id, asignado_escoba_team_id,
         asignado_rental_entrega_id, asignado_rental_entrega_team_id,
         asignado_escoba_entrega_id, asignado_escoba_entrega_team_id,
         asignado_rental_devolucion_id, asignado_rental_devolucion_team_id,
         asignado_escoba_devolucion_id, asignado_escoba_devolucion_team_id,
         shuttle_entrega, shuttle_devolucion`
      )
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .neq("estado", "Cancelada");

    if (resErr) throw resErr;

    // Collect all user IDs we need names for
    const userIdsToResolve = new Set<string>();

    // Build operation list for the target hour
    const operations: UnassignedOperation[] = [];

    for (const r of reservations || []) {
      const clientName = [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(" ") || null;

      const processOperation = (
        type: "Entrega" | "Devolución" | "Transfer",
        dt: string | null,
        location: string | null,
        isCompleted: boolean
      ) => {
        if (!dt || dt.substring(0, 10) !== date) return;
        const opHour = parseInt(dt.substring(11, 13), 10);
        if (opHour !== targetHour) return;
        if (isCompleted) return;

        const fields = getAssignmentFields(type);
        const rentalId = (r as any)[fields.rentalId] || null;
        const escobaId = (r as any)[fields.escobaId] || null;

        // Shuttle operations don't need a rental assignee
        const isShuttle = type === 'Entrega' ? !!(r as any).shuttle_entrega : type === 'Devolución' ? !!(r as any).shuttle_devolucion : false;
        // Only include if at least one role is unassigned
        const needsRental = isShuttle ? false : !rentalId;
        const needsEscoba = !escobaId;

        if (!needsRental && !needsEscoba) return;

        if (rentalId) userIdsToResolve.add(rentalId);
        if (escobaId) userIdsToResolve.add(escobaId);

        operations.push({
          reservationId: r.id,
          type,
          datetime: dt,
          hour: opHour,
          location,
          clientName,
          vehicleModel: r.modelo || null,
          vehiclePlate: r.auto || null,
          reservationCode: r.external_reservation_id || null,
          needsRental,
          needsEscoba,
          currentRentalName: rentalId, // Will be resolved to name below
          currentEscobaName: escobaId, // Will be resolved to name below
        });
      };

      if (r.tipo_actividad === "Transfer") {
        const dt = r.confirmed_entrega_datetime || r.desde;
        const location = r.lugar_entrega || r.lugar_entrega_direccion || r.lugar_entrega_ciudad || null;
        processOperation("Transfer", dt, location, r.transfer_completado);
      } else {
        // Entrega
        const entregaDt = r.confirmed_entrega_datetime || r.desde;
        const entregaLoc = r.lugar_entrega || r.lugar_entrega_direccion || r.lugar_entrega_ciudad || null;
        processOperation("Entrega", entregaDt, entregaLoc, r.entrega_completada);

        // Devolución
        const devolDt = r.confirmed_devolucion_datetime || r.hasta;
        const devolLoc = r.lugar_devolucion || r.lugar_devolucion_direccion || r.lugar_devolucion_ciudad || null;
        processOperation("Devolución", devolDt, devolLoc, r.devolucion_completada);
      }
    }

    // Resolve user names for current assignees
    const userIds = Array.from(userIdsToResolve);
    const nameMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", userIds);

      for (const p of profiles || []) {
        nameMap.set(p.id, p.display_name || p.full_name || "—");
      }
    }

    // Replace IDs with names
    for (const op of operations) {
      if (op.currentRentalName && nameMap.has(op.currentRentalName)) {
        op.currentRentalName = nameMap.get(op.currentRentalName)!;
      } else if (op.currentRentalName) {
        op.currentRentalName = null;
      }
      if (op.currentEscobaName && nameMap.has(op.currentEscobaName)) {
        op.currentEscobaName = nameMap.get(op.currentEscobaName)!;
      } else if (op.currentEscobaName) {
        op.currentEscobaName = null;
      }
    }

    // Sort by datetime
    operations.sort((a, b) => a.datetime.localeCompare(b.datetime));

    return res.json({
      ok: true,
      data: {
        date,
        hour: targetHour,
        operations,
        totalUnassigned: operations.length,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error("[reinforcement] Error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}

// ─── Handler: Assign reinforcement to an operation ─────────────────────────

export async function handleAssignReinforcement(req: Request, res: Response) {
  try {
    const { organizationId: orgId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const { reservationId, operationType, role, userId } = req.body;

    if (!reservationId || !operationType || !role || !userId) {
      return res.status(400).json({
        ok: false,
        error: "reservationId, operationType, role, and userId are required",
      });
    }

    if (!["Entrega", "Devolución", "Transfer"].includes(operationType)) {
      return res.status(400).json({ ok: false, error: "Invalid operationType" });
    }

    if (!["rental", "escoba"].includes(role)) {
      return res.status(400).json({ ok: false, error: "role must be 'rental' or 'escoba'" });
    }

    const sb = getServiceClient();

    // Verify reservation belongs to this org
    const { data: reservation, error: fetchErr } = await sb
      .from("reservations")
      .select("id, organization_id")
      .eq("id", reservationId)
      .eq("organization_id", orgId)
      .single();

    if (fetchErr || !reservation) {
      return res.status(404).json({ ok: false, error: "Reservation not found" });
    }

    // Build the update fields
    const fields = getAssignmentFields(operationType as "Entrega" | "Devolución" | "Transfer");
    const updateData: Record<string, string | null> = {};

    if (role === "rental") {
      updateData[fields.rentalId] = userId;
      // Don't set team_id — the user is being assigned individually
    } else {
      updateData[fields.escobaId] = userId;
    }

    const { error: updateErr } = await sb
      .from("reservations")
      .update(updateData)
      .eq("id", reservationId);

    if (updateErr) throw updateErr;

    // Get the user's name for the response
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", userId)
      .single();

    const userName = profile?.display_name || profile?.full_name || "—";

    return res.json({
      ok: true,
      data: {
        reservationId,
        operationType,
        role,
        userId,
        userName,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error("[reinforcement] Assign error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
