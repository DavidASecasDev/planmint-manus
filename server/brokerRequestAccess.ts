/**
 * POST /api/request-broker-access
 * 
 * Public endpoint (no auth required) that handles broker registration requests.
 * Called from the BrokerRegister page when a broker fills out the invite form.
 * 
 * Flow:
 * 1. Validates input fields and organization
 * 2. Checks for existing/duplicate requests
 * 3. Creates a Supabase Auth user with the provided email/password
 * 4. Inserts a row in broker_registration_requests with status 'pending'
 * 
 * The admin then approves/rejects via the existing approve/reject endpoints.
 */
import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";

export async function handleRequestBrokerAccess(req: Request, res: Response) {
  try {
    const { organization_id, name, company, email, phone, password } = req.body;

    // --- Validate required fields ---
    if (!organization_id || !name || !email || !password) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (password.length < 6) {
      return res.status(400).json({ error: "weak_password" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "invalid_email" });
    }

    const sb = getServiceClient();

    // --- Validate organization exists and is active ---
    const { data: org, error: orgError } = await sb
      .from("organizations")
      .select("id, name, status")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return res.status(400).json({ error: "invalid_organization" });
    }

    if (org.status !== "active") {
      return res.status(400).json({ error: "invalid_organization" });
    }

    // --- Check for existing registration requests with this email for this org ---
    const { data: existingRequest } = await sb
      .from("broker_registration_requests")
      .select("id, status, rejection_reason")
      .eq("organization_id", organization_id)
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return res.status(409).json({ error: "pending_request" });
      }
      if (existingRequest.status === "approved") {
        return res.status(409).json({ error: "already_approved" });
      }
      if (existingRequest.status === "rejected") {
        // Allow re-registration after rejection: delete the old request
        await sb
          .from("broker_registration_requests")
          .delete()
          .eq("id", existingRequest.id);
      }
    }

    let userId: string | null = null;

    // --- Try to create a new Supabase Auth user ---
    const { data: newUser, error: signUpError } = await sb.auth.admin.createUser({
      email: trimmedEmail,
      password: password,
      email_confirm: true, // Auto-confirm email for broker registrations
    });

    if (signUpError) {
      // If user already exists, try to find them
      if (
        signUpError.message?.includes("already been registered") ||
        signUpError.message?.includes("already exists")
      ) {
        // List users and find by email using admin API
        const { data: listData } = await sb.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const existingUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === trimmedEmail
        );

        if (existingUser) {
          // Check if they already have a broker profile (already approved)
          const { data: existingProfile } = await sb
            .from("broker_profiles")
            .select("id")
            .eq("user_id", existingUser.id)
            .maybeSingle();

          if (existingProfile) {
            return res.status(409).json({ error: "already_approved" });
          }

          userId = existingUser.id;
        } else {
          return res.status(409).json({ error: "email_exists" });
        }
      } else {
        console.error("[request-broker-access] Sign up error:", signUpError);
        return res
          .status(500)
          .json({ error: "server_error", message: signUpError.message });
      }
    } else {
      userId = newUser?.user?.id || null;
    }

    if (!userId) {
      return res.status(500).json({ error: "critical_error" });
    }

    // --- Insert broker registration request ---
    const { error: insertError } = await sb
      .from("broker_registration_requests")
      .insert({
        organization_id,
        user_id: userId,
        name: trimmedName,
        company: company?.trim() || null,
        email: trimmedEmail,
        phone: phone?.trim() || null,
        status: "pending",
      });

    if (insertError) {
      console.error("[request-broker-access] Insert error:", insertError);

      if (insertError.code === "23505") {
        return res.status(409).json({ error: "duplicate_request" });
      }

      return res
        .status(500)
        .json({ error: "server_error", message: insertError.message });
    }

    console.log(
      `[request-broker-access] New broker request from ${trimmedEmail} for org ${organization_id}`
    );

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[request-broker-access] Unexpected error:", err);
    return res
      .status(500)
      .json({ error: "critical_error", message: err.message });
  }
}
