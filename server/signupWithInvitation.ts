/**
 * POST /api/signup-with-invitation
 * Migrated from Supabase Edge Function signup-with-invitation.
 * Handles user signup through invitation tokens.
 */
import type { Request, Response } from "express";
import { getServiceClient, AuthError } from "./supabaseAdmin";

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

    // Find the invitation
    const { data: invitation, error: invError } = await serviceClient
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invError || !invitation) {
      return res.json({ error: "invitation_not_found" });
    }

    // Check invitation status
    if (invitation.status === "accepted") {
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
    const { data: signUpData, error: signUpError } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name },
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

    // Create profile
    const { error: profileError } = await serviceClient
      .from("profiles")
      .upsert({
        id: userId,
        email: email.trim(),
        name,
        organization_id: invitation.organization_id,
        role: invitation.role || "team_member",
      });

    if (profileError) {
      console.error("[signup-with-invitation] Profile creation error:", profileError);
    }

    // Add to organization_members
    const { error: memberError } = await serviceClient
      .from("organization_members")
      .upsert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role: invitation.role || "team_member",
      });

    if (memberError) {
      console.error("[signup-with-invitation] Member creation error:", memberError);
    }

    // Mark invitation as accepted
    await serviceClient
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("id", invitation.id);

    return res.json({ success: true, userId });
  } catch (error: any) {
    console.error("[signup-with-invitation] Error:", error);
    return res.status(500).json({ error: "signup_failed", message: error?.message || "Error desconocido" });
  }
}
