/**
 * Express endpoints that replace broken Supabase RPCs for invitations:
 *
 * POST /api/get-invitation-public     → replaces rpc('get_invitation_public')
 * POST /api/accept-invitation         → replaces rpc('accept_invitation')
 * POST /api/accept-my-pending-invitation → replaces rpc('accept_my_pending_invitation')
 * POST /api/revoke-invitation         → replaces rpc('revoke_invitation')
 * POST /api/get-organization-invitations → replaces rpc('get_organization_invitations')
 * POST /api/get-my-pending-invitations → replaces rpc('get_my_pending_invitations')
 *
 * IMPORTANT: The `profiles` table does NOT have an `email` column.
 * User emails live only in `auth.users`.
 */
import type { Request, Response } from "express";
import { createHash } from "crypto";
import {
  authenticateSupabaseRequest,
  AuthError,
  getServiceClient,
  extractBearerToken,
} from "./supabaseAdmin";

function hashToken(token: string): string {
  return createHash("sha256").update(Buffer.from(token, "utf-8")).digest("hex");
}

/**
 * POST /api/get-invitation-public
 * Public endpoint (no auth required) — looks up an invitation by plain token
 * and returns preview info (org name, role, expiry).
 */
export async function handleGetInvitationPublic(req: Request, res: Response) {
  try {
    const { p_token } = req.body || {};
    if (!p_token) {
      return res.json({ valid: false, error: "invitation_not_found" });
    }

    const serviceClient = getServiceClient();
    const tokenHash = hashToken(p_token);

    const { data: invitation, error } = await serviceClient
      .from("organization_invitations")
      .select("id, organization_id, email, role, status, accepted, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (error || !invitation) {
      return res.json({ valid: false, error: "invitation_not_found" });
    }

    // Check status
    if (invitation.status === "accepted" || invitation.accepted === true) {
      return res.json({ valid: false, error: "invitation_already_accepted" });
    }
    if (invitation.status === "revoked") {
      return res.json({ valid: false, error: "invitation_revoked" });
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.json({ valid: false, error: "invitation_expired" });
    }

    // Get organization name
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    return res.json({
      valid: true,
      organization_id: invitation.organization_id,
      organization_name: org?.name || "Organización",
      role: invitation.role,
      email: invitation.email,
      expires_at: invitation.expires_at,
    });
  } catch (error: any) {
    console.error("[get-invitation-public] Error:", error);
    return res.json({ valid: false, error: "server_error" });
  }
}

/**
 * POST /api/accept-invitation
 * Authenticated endpoint — accepts an invitation by token for the current user.
 * Updates profiles.organization_id, adds to organization_members, marks invitation accepted.
 */
export async function handleAcceptInvitation(req: Request, res: Response) {
  try {
    const { p_token } = req.body || {};
    if (!p_token) {
      return res.json({ success: false, error: "invitation_not_found" });
    }

    // Authenticate the user
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.json({ success: false, error: "not_authenticated" });
    }

    const serviceClient = getServiceClient();
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.json({ success: false, error: "not_authenticated" });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email?.toLowerCase();

    // Find invitation
    const tokenHash = hashToken(p_token);
    const { data: invitation, error: invError } = await serviceClient
      .from("organization_invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (invError || !invitation) {
      return res.json({ success: false, error: "invitation_not_found" });
    }

    // Validate invitation state
    if (invitation.status === "accepted" || invitation.accepted === true) {
      return res.json({ success: false, error: "invitation_already_accepted" });
    }
    if (invitation.status === "revoked") {
      return res.json({ success: false, error: "invitation_revoked" });
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.json({ success: false, error: "invitation_expired" });
    }

    // Check email matches
    if (userEmail && invitation.email.toLowerCase() !== userEmail) {
      return res.json({ success: false, error: "email_mismatch" });
    }

    // Update profile with organization_id and role
    await serviceClient
      .from("profiles")
      .update({
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      })
      .eq("id", userId);

    // Add to organization_members
    await serviceClient
      .from("organization_members")
      .upsert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      });

    // Mark invitation as accepted
    await serviceClient
      .from("organization_invitations")
      .update({
        status: "accepted",
        accepted: true,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    // Get organization name
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    return res.json({
      success: true,
      organization_name: org?.name || "la organización",
    });
  } catch (error: any) {
    console.error("[accept-invitation] Error:", error);
    return res.json({ success: false, error: "server_error" });
  }
}

/**
 * POST /api/accept-my-pending-invitation
 * Authenticated endpoint — auto-accepts the first pending invitation
 * that matches the current user's email. Used during onboarding.
 */
export async function handleAcceptMyPendingInvitation(req: Request, res: Response) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.json({ success: false, error: "not_authenticated" });
    }

    const serviceClient = getServiceClient();
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.json({ success: false, error: "not_authenticated" });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email?.toLowerCase();

    if (!userEmail) {
      return res.json({ success: false, error: "no_email" });
    }

    // The frontend may pass p_invitation_id to accept a specific invitation
    const { p_invitation_id } = req.body || {};

    let invitation: any;

    if (p_invitation_id) {
      // Accept a specific invitation by ID
      const { data, error } = await serviceClient
        .from("organization_invitations")
        .select("*")
        .eq("id", p_invitation_id)
        .eq("status", "pending")
        .single();

      if (error || !data) {
        return res.json({ success: false, error: "no_pending_invitations" });
      }
      invitation = data;
    } else {
      // Find the most recent pending invitation for this email
      const { data: invitations, error: invError } = await serviceClient
        .from("organization_invitations")
        .select("*")
        .eq("email", userEmail)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (invError || !invitations || invitations.length === 0) {
        return res.json({ success: false, error: "no_pending_invitations" });
      }
      invitation = invitations[0];
    }

    // Check expiration
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.json({ success: false, error: "invitation_expired" });
    }

    // Verify email matches
    if (invitation.email.toLowerCase() !== userEmail) {
      return res.json({ success: false, error: "email_mismatch" });
    }

    // Update profile with organization_id and role
    await serviceClient
      .from("profiles")
      .update({
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      })
      .eq("id", userId);

    // Add to organization_members
    await serviceClient
      .from("organization_members")
      .upsert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      });

    // Mark invitation as accepted
    await serviceClient
      .from("organization_invitations")
      .update({
        status: "accepted",
        accepted: true,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    // Get organization name
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    return res.json({
      success: true,
      organization_id: invitation.organization_id,
      organization_name: org?.name || "la organización",
    });
  } catch (error: any) {
    console.error("[accept-my-pending-invitation] Error:", error);
    return res.json({ success: false, error: "server_error" });
  }
}

/**
 * POST /api/revoke-invitation
 * Authenticated endpoint — revokes a pending invitation.
 * Caller must be owner or admin of the organization.
 */
export async function handleRevokeInvitation(req: Request, res: Response) {
  try {
    const { p_invitation_id } = req.body || {};
    if (!p_invitation_id) {
      return res.json({ success: false, error: "missing_invitation_id" });
    }

    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const serviceClient = getServiceClient();

    // Check caller has permission (must be owner or admin)
    const { data: callerMember } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .single();

    if (!callerMember?.role || !["owner", "admin"].includes(callerMember.role)) {
      return res.json({ success: false, error: "insufficient_permissions" });
    }

    // Find the invitation
    const { data: invitation } = await serviceClient
      .from("organization_invitations")
      .select("id, status, organization_id")
      .eq("id", p_invitation_id)
      .single();

    if (!invitation) {
      return res.json({ success: false, error: "invitation_not_found" });
    }

    // Must belong to the caller's organization
    if (invitation.organization_id !== organizationId) {
      return res.json({ success: false, error: "insufficient_permissions" });
    }

    // Can only revoke pending invitations
    if (invitation.status !== "pending") {
      return res.json({ success: false, error: "invitation_not_pending" });
    }

    // Revoke
    await serviceClient
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", p_invitation_id);

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    console.error("[revoke-invitation] Error:", error);
    return res.json({ success: false, error: "server_error" });
  }
}

/**
 * POST /api/get-organization-invitations
 * Authenticated endpoint — returns all invitations for the caller's organization.
 */
export async function handleGetOrganizationInvitations(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const serviceClient = getServiceClient();

    const { data: invitations, error } = await serviceClient
      .from("organization_invitations")
      .select("id, email, role, status, created_at, expires_at, accepted_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[get-organization-invitations] Error:", error);
      return res.json([]);
    }

    return res.json(invitations || []);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[get-organization-invitations] Error:", error);
    return res.json([]);
  }
}

/**
 * POST /api/get-my-pending-invitations
 * Authenticated endpoint — returns pending invitations for the current user's email.
 */
export async function handleGetMyPendingInvitations(req: Request, res: Response) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.json([]);
    }

    const serviceClient = getServiceClient();
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      return res.json([]);
    }

    const userEmail = userData.user.email.toLowerCase();

    // Find pending invitations for this email
    const { data: invitations, error } = await serviceClient
      .from("organization_invitations")
      .select("id, email, role, status, created_at, expires_at, organization_id")
      .eq("email", userEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !invitations) {
      return res.json([]);
    }

    // Enrich with organization names
    const enriched = await Promise.all(
      invitations.map(async (inv) => {
        const { data: org } = await serviceClient
          .from("organizations")
          .select("name")
          .eq("id", inv.organization_id)
          .single();
        return {
          ...inv,
          organization_name: org?.name || "Organización",
        };
      })
    );

    return res.json(enriched);
  } catch (error: any) {
    console.error("[get-my-pending-invitations] Error:", error);
    return res.json([]);
  }
}
