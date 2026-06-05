/**
 * POST /api/reset-member-password
 * Allows org admins (with members.create permission) to reset a member's password.
 * The target user must belong to the same organization as the caller.
 */
import type { Request, Response } from "express";
import {
  authenticateSupabaseRequest,
  AuthError,
  getServiceClient,
} from "./supabaseAdmin";
import { requirePermission } from "./permissionHelper";

export async function handleResetMemberPassword(req: Request, res: Response) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // 1. Authenticate the caller
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    // 2. Check permission (reuse members.create which is for managing members)
    const serviceClient = getServiceClient();
    await requirePermission(
      serviceClient,
      organizationId,
      userId,
      "members.create"
    );

    // 3. Validate inputs
    const { targetUserId, newPassword } = req.body || {};

    if (!targetUserId || typeof targetUserId !== "string") {
      return res.json({ success: false, error: "missing_target_user" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.json({ success: false, error: "invalid_password", message: "La contraseña debe tener al menos 6 caracteres" });
    }

    // 4. Verify target user belongs to the same organization
    const { data: targetMember, error: memberError } = await serviceClient
      .from("organization_members")
      .select("id, user_id, role")
      .eq("user_id", targetUserId)
      .eq("organization_id", organizationId)
      .single();

    if (memberError || !targetMember) {
      return res.json({ success: false, error: "user_not_in_organization" });
    }

    // 5. Prevent non-owners from resetting owner passwords
    if (targetMember.role === "owner") {
      // Check if the caller is also an owner
      const { data: callerMember } = await serviceClient
        .from("organization_members")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .single();

      if (callerMember?.role !== "owner") {
        return res.json({ success: false, error: "cannot_reset_owner_password" });
      }
    }

    // 6. Reset the password via Supabase admin API
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("[resetMemberPassword] Update error:", updateError);
      return res.json({ success: false, error: updateError.message });
    }

    // 7. Log audit entry
    try {
      await serviceClient.from("audit_logs").insert({
        organization_id: organizationId,
        actor_user_id: userId,
        actor_role: "admin",
        action: "reset_member_password",
        entity_type: "user",
        entity_id: targetUserId,
        metadata_json: JSON.stringify({ targetUserId }),
        ip_address: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
      });
    } catch {
      // Audit log failure should not block the operation
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err?.code === "PERMISSION_DENIED") {
      return res.status(403).json({ success: false, error: "insufficient_permissions" });
    }
    console.error("[resetMemberPassword] Error:", err);
    return res.json({ success: false, error: "Internal server error" });
  }
}
