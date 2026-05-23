/**
 * POST /api/get-reservation-status-history
 * Returns the status change history for a given reservation.
 * Used in the ReservationDetailSheet to show reactivation events and other status changes.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

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
