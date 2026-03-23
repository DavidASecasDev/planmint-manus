/**
 * POST /api/signup-with-invitation
 * Migrated from Supabase Edge Function signup-with-invitation.
 * Handles user signup through invitation tokens.
 *
 * The invitation system stores SHA256-hashed tokens in the
 * `organization_invitations.token_hash` column. The plain token
 * arrives from the client and must be hashed before lookup.
 */
import type { Request, Response } from "express";
import { createHash } from "crypto";
import { getServiceClient } from "./supabaseAdmin";

/**
 * Hash a plain token the same way the DB function does:
 *   encode(sha256(token::bytea), 'hex')
 */
function hashToken(token: string): string {
  return createHash("sha256").update(Buffer.from(token, "utf-8")).digest("hex");
}

export async function handleSignupWithInvitation(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { email, password, name, token } = req.body || {};

    if (!email || !password || !name || !token) {
      return res.json({ error: "missing_fields" });
    }

    const serviceClient = getServiceClient();
    const tokenHash = hashToken(token);

    // Find the invitation by token_hash in organization_invitations
    const { data: invitation, error: invError } = await serviceClient
      .from("organization_invitations")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (invError || !invitation) {
      console.error("[signup-with-invitation] Invitation lookup error:", invError?.message);
      return res.json({ error: "invitation_not_found" });
    }

    // Check invitation status
    if (invitation.status === "accepted" || invitation.accepted === true) {
      return res.json({ error: "invitation_already_accepted" });
    }
    if (invitation.status === "revoked") {
      return res.json({ error: "invitation_revoked" });
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.json({ error: "invitation_expired" });
    }

    // Check email matches
    if (invitation.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.json({ error: "email_mismatch" });
    }

    // Try to create user with Supabase Auth Admin
    // Pass organization_id and role in user_metadata so the handle_new_user trigger
    // can create the profile with the correct organization from the start
    const { data: signUpData, error: signUpError } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        name,
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      },
    });

    if (signUpError) {
      // Check if user already exists
      if (signUpError.message?.includes("already been registered") || signUpError.message?.includes("already exists")) {
        return res.json({ error: "user_already_confirmed" });
      }
      return res.json({ error: "signup_failed", message: signUpError.message });
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return res.json({ error: "signup_failed", message: "No user ID returned" });
    }

    // Ensure profile has organization_id set (the handle_new_user trigger should
    // have already created it with org_id from user_metadata, but we do an explicit
    // UPDATE as a safety net in case of race conditions)
    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        email: email.trim(),
        name,
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      })
      .eq("id", userId);

    if (profileError) {
      console.error("[signup-with-invitation] Profile update error:", profileError);
      // If UPDATE failed (profile not yet created by trigger), try INSERT
      const { error: insertError } = await serviceClient
        .from("profiles")
        .insert({
          id: userId,
          email: email.trim(),
          name,
          organization_id: invitation.organization_id,
          role: invitation.role || "member",
        });
      if (insertError) {
        console.error("[signup-with-invitation] Profile insert fallback error:", insertError);
      }
    }

    // Add to organization_members
    const { error: memberError } = await serviceClient
      .from("organization_members")
      .upsert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role: invitation.role || "member",
      });

    if (memberError) {
      console.error("[signup-with-invitation] Member creation error:", memberError);
    }

    // Mark invitation as accepted in organization_invitations
    await serviceClient
      .from("organization_invitations")
      .update({
        status: "accepted",
        accepted: true,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    // Get organization name for the response
    const { data: orgData } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    return res.json({
      success: true,
      userId,
      organization_name: orgData?.name || "la organización",
    });
  } catch (error: any) {
    console.error("[signup-with-invitation] Error:", error);
    return res.status(500).json({ error: "signup_failed", message: error?.message || "Error desconocido" });
  }
}
