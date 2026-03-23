/**
 * POST /api/create-invitation
 * Replaces the broken Supabase RPC `create_invitation_secure` which
 * references a non-existent `public.roles` table.
 *
 * Creates an invitation in `organization_invitations`, generates a
 * random token, stores its SHA-256 hash, and returns the plain token
 * so the frontend can build the invitation link.
 */
import type { Request, Response } from "express";
import { randomBytes, createHash } from "crypto";
import {
  authenticateSupabaseRequest,
  AuthError,
  getServiceClient,
} from "./supabaseAdmin";

/** Allowed invitation roles */
const VALID_ROLES = ["owner", "admin", "manager", "member", "read_only"];

export async function handleCreateInvitation(req: Request, res: Response) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // 1. Authenticate the caller
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { p_email, p_role, p_expires_in_days } = req.body || {};

    // 2. Validate inputs
    if (!p_email || typeof p_email !== "string") {
      return res.json({ success: false, error: "missing_email" });
    }

    const email = p_email.trim().toLowerCase();
    const role = (p_role || "member").toLowerCase();
    const expiresInDays = Number(p_expires_in_days) || 7;

    if (!VALID_ROLES.includes(role)) {
      return res.json({ success: false, error: "invalid_role" });
    }

    // 3. Check caller has permission (must be owner or admin)
    const serviceClient = getServiceClient();
    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    const callerRole = callerProfile?.role;
    if (!callerRole || !["owner", "admin"].includes(callerRole)) {
      return res.json({ success: false, error: "insufficient_permissions" });
    }

    // 4. Check if user is already a member of this organization
    // profiles table does NOT have an email column, so we use auth.admin.listUsers
    // to find the user by email, then check organization_members
    const { data: authUsers } = await serviceClient.auth.admin.listUsers();
    const matchedUser = authUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email
    );

    if (matchedUser) {
      const { data: existingMember } = await serviceClient
        .from("organization_members")
        .select("id")
        .eq("user_id", matchedUser.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingMember) {
        return res.json({ success: false, error: "already_member" });
      }
    }

    // 5. Check if there's already a pending invitation for this email
    const { data: existingInvitation } = await serviceClient
      .from("organization_invitations")
      .select("id, status")
      .eq("email", email)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      return res.json({ success: false, error: "invitation_already_exists" });
    }

    // 6. Generate token and hash
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(Buffer.from(token, "utf-8"))
      .digest("hex");

    // 7. Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 8. Insert invitation
    const { data: invitation, error: insertError } = await serviceClient
      .from("organization_invitations")
      .insert({
        organization_id: organizationId,
        email,
        role,
        token_hash: tokenHash,
        status: "pending",
        accepted: false,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, expires_at")
      .single();

    if (insertError) {
      console.error("[create-invitation] Insert error:", insertError);
      return res.json({
        success: false,
        error: "insert_failed",
        message: insertError.message,
      });
    }

    return res.json({
      success: true,
      token,
      expires_at: invitation.expires_at,
      invitation_id: invitation.id,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }
    console.error("[create-invitation] Error:", error);
    return res.status(500).json({
      success: false,
      error: "server_error",
      message: error?.message || "Error desconocido",
    });
  }
}
