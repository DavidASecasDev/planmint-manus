/**
 * Check-in Audit Trail Endpoints
 *
 * POST /api/checkin-audit-log       — Log a check-in field change (any authenticated user)
 * POST /api/get-checkin-audit-log   — Get audit entries for a reservation (owner or permission-gated)
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

/**
 * Logs a check-in field change.
 * Body: { reservation_id, operation_type, field_name, old_value, new_value, changed_by_name }
 */
export async function handleLogCheckinAudit(req: Request, res: Response) {
  try {
    const { organizationId, userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { reservation_id, operation_type, field_name, old_value, new_value, changed_by_name } = req.body;

    if (!reservation_id || !operation_type || !field_name || !new_value || !changed_by_name) {
      return res.status(400).json({ error: "reservation_id, operation_type, field_name, new_value, and changed_by_name are required" });
    }

    const serviceClient = getServiceClient();

    const { error } = await serviceClient
      .from("checkin_audit_log")
      .insert({
        organization_id: organizationId,
        reservation_id,
        operation_type,
        field_name,
        old_value: old_value || null,
        new_value,
        changed_by_user_id: userId || null,
        changed_by_name,
      });

    if (error) {
      console.error("[checkin-audit-log] Insert error:", error);
      return res.status(500).json({ error: "Failed to log check-in change" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[checkin-audit-log] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Returns check-in audit entries for given reservation IDs.
 * Only accessible by owner or users with 'reservations.view_checkin_audit' permission.
 * Body: { reservation_ids: string[] }
 */
export async function handleGetCheckinAuditLog(req: Request, res: Response) {
  try {
    const { organizationId, userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { reservation_ids } = req.body;

    if (!reservation_ids || !Array.isArray(reservation_ids) || reservation_ids.length === 0) {
      return res.status(400).json({ error: "reservation_ids array is required" });
    }

    const serviceClient = getServiceClient();

    // Check permission: owner always has access, otherwise check specific permission
    const { data: permCheck } = await serviceClient.rpc("has_permission", {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_permission: "reservations.view_checkin_audit",
    });

    if (!permCheck) {
      return res.status(403).json({ error: "No tienes permiso para ver el historial de check-in" });
    }

    // Fetch audit entries for the given reservation IDs (max 100 reservations at a time)
    const limitedIds = reservation_ids.slice(0, 100);

    const { data, error } = await serviceClient
      .from("checkin_audit_log")
      .select("id, reservation_id, operation_type, field_name, old_value, new_value, changed_by_name, created_at")
      .eq("organization_id", organizationId)
      .in("reservation_id", limitedIds)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[get-checkin-audit-log] Query error:", error);
      return res.status(500).json({ error: "Failed to fetch audit log" });
    }

    return res.json({ data: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[get-checkin-audit-log] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
