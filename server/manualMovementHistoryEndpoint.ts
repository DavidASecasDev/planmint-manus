/**
 * Endpoints for manual movement edit history.
 * 
 * POST /api/log-manual-movement-edit
 *   Records a set of field changes made to a manual movement (reservation with MANUAL-xxx ID).
 *   Body: { reservation_id, external_reservation_id, changes: [{ field, old_value, new_value }], changed_by_name }
 * 
 * POST /api/get-manual-movement-history
 *   Returns the edit history for a given manual movement reservation.
 *   Body: { reservation_id }
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

export interface FieldChange {
  field: string;
  label: string;
  old_value: string | null;
  new_value: string | null;
}

export async function handleLogManualMovementEdit(req: Request, res: Response) {
  try {
    const { organizationId, userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { reservation_id, external_reservation_id, changes, changed_by_name } = req.body;

    if (!reservation_id || !changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: "reservation_id and non-empty changes array are required" });
    }

    const serviceClient = getServiceClient();

    const { error } = await serviceClient
      .from("manual_movement_edit_history")
      .insert({
        organization_id: organizationId,
        reservation_id,
        external_reservation_id: external_reservation_id || null,
        changed_by_user_id: userId || null,
        changed_by_name: changed_by_name || null,
        changes,
      });

    if (error) {
      console.error("[log-manual-movement-edit] Insert error:", error);
      return res.status(500).json({ error: "Failed to log edit history" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[log-manual-movement-edit] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function handleGetManualMovementHistory(req: Request, res: Response) {
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
      .from("manual_movement_edit_history")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("reservation_id", reservation_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[get-manual-movement-history] Query error:", error);
      return res.status(500).json({ error: "Failed to fetch edit history" });
    }

    return res.json(data || []);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[get-manual-movement-history] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
