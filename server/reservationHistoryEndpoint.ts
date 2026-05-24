/**
 * POST /api/get-reservation-status-history
 * Returns the status change history for a given reservation.
 * Used in the ReservationDetailSheet to show reactivation events and other status changes.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

export async function handleLogReservationStatusChange(req: Request, res: Response) {
  try {
    const { organizationId, userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { reservation_id, external_reservation_id, old_status, new_status, change_type, notes, changed_by_name } = req.body;

    if (!reservation_id || !new_status) {
      return res.status(400).json({ error: "reservation_id and new_status are required" });
    }

    const serviceClient = getServiceClient();

    const { error } = await serviceClient
      .from("reservation_status_history")
      .insert({
        organization_id: organizationId,
        reservation_id,
        external_reservation_id: external_reservation_id || null,
        old_status: old_status || null,
        new_status,
        change_type: change_type || "manual",
        changed_by_user_id: userId || null,
        changed_by_name: changed_by_name || null,
        notes: notes || null,
      });

    if (error) {
      console.error("[log-reservation-status-change] Insert error:", error);
      return res.status(500).json({ error: "Failed to log status change" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[log-reservation-status-change] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleGetReactivatedReservationIds(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("reservation_status_history")
      .select("reservation_id")
      .eq("organization_id", organizationId)
      .eq("change_type", "reactivation_auto");

    if (error) {
      console.error("[get-reactivated-reservation-ids] Query error:", error);
      return res.status(500).json({ error: "Failed to fetch reactivated IDs" });
    }

    // Deduplicate
    const uniqueIds = Array.from(new Set((data || []).map(r => r.reservation_id)));
    return res.json(uniqueIds.map(id => ({ reservation_id: id })));
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[get-reactivated-reservation-ids] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleGetReservationStatusHistory(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { reservation_id } = req.body;

    if (!reservation_id) {
      return res.status(400).json({ error: "reservation_id is required" });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("reservation_status_history")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("reservation_id", reservation_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[get-reservation-status-history] Query error:", error);
      return res.status(500).json({ error: "Failed to fetch status history" });
    }

    return res.json(data || []);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[get-reservation-status-history] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleGetReactivatedReservations(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const serviceClient = getServiceClient();

    // Step 1: Get reactivated reservation IDs from history
    const { data: historyData, error: historyError } = await serviceClient
      .from("reservation_status_history")
      .select("reservation_id")
      .eq("organization_id", organizationId)
      .eq("change_type", "reactivation_auto");

    if (historyError) {
      console.error("[get-reactivated-reservations] History query error:", historyError);
      return res.status(500).json({ error: "Failed to fetch reactivated IDs" });
    }

    const uniqueIds = Array.from(new Set((historyData || []).map(r => r.reservation_id)));

    if (uniqueIds.length === 0) {
      return res.json([]);
    }

    // Step 2: Fetch full reservation data for those IDs
    const { data: reservations, error: resError } = await serviceClient
      .from("reservations")
      .select("*")
      .eq("organization_id", organizationId)
      .in("id", uniqueIds)
      .is("archived_at", null)
      .order("desde", { ascending: false });

    if (resError) {
      console.error("[get-reactivated-reservations] Reservations query error:", resError);
      return res.status(500).json({ error: "Failed to fetch reactivated reservations" });
    }

    return res.json(reservations || []);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[get-reactivated-reservations] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
