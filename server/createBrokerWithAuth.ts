/**
 * POST /api/create-broker-with-auth
 * 
 * Creates a broker with a full auth account so they can immediately log in to the portal.
 * Flow:
 * 1. Validates input (name, email, password required)
 * 2. Creates Supabase Auth user with email/password
 * 3. Creates transfer_brokers record linked to the auth user
 * 4. Creates broker_profiles record for portal access
 * 5. Creates broker_registration_requests record with status 'approved' for consistency
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

export async function handleCreateBrokerWithAuth(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { name, email, password, phone } = req.body;

    // --- Validate required fields ---
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const sb = getServiceClient();

    // --- Check if broker with this email already exists in this org ---
    const { data: existingBroker } = await sb
      .from("transfer_brokers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (existingBroker) {
      return res.status(409).json({ error: "Ya existe un broker con ese email en esta organización" });
    }

    // --- Create or find auth user ---
    let authUserId: string | null = null;

    const { data: newUser, error: signUpError } = await sb.auth.admin.createUser({
      email: trimmedEmail,
      password: password,
      email_confirm: true,
    });

    if (signUpError) {
      if (
        signUpError.message?.includes("already been registered") ||
        signUpError.message?.includes("already exists")
      ) {
        // User already exists — find them and update password
        const { data: listData } = await sb.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const existingUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === trimmedEmail
        );

        if (existingUser) {
          // Update their password to the new one
          await sb.auth.admin.updateUserById(existingUser.id, { password });
          authUserId = existingUser.id;
        } else {
          return res.status(500).json({ error: "No se pudo encontrar el usuario existente" });
        }
      } else {
        console.error("[create-broker-with-auth] Sign up error:", signUpError);
        return res.status(500).json({ error: signUpError.message });
      }
    } else {
      authUserId = newUser?.user?.id || null;
    }

    if (!authUserId) {
      return res.status(500).json({ error: "No se pudo crear la cuenta de autenticación" });
    }

    // --- Create transfer_brokers record ---
    const { data: brokerRecord, error: brokerError } = await sb
      .from("transfer_brokers")
      .insert({
        organization_id: organizationId,
        name: trimmedName,
        email: trimmedEmail,
        phone: phone?.trim() || null,
        company: null,
        user_id: authUserId,
        is_active: true,
      })
      .select("id")
      .single();

    if (brokerError) {
      console.error("[create-broker-with-auth] Insert broker error:", brokerError);
      return res.status(500).json({ error: brokerError.message });
    }

    // --- Get organization info ---
    const { data: org } = await sb
      .from("organizations")
      .select("name, logo_url")
      .eq("id", organizationId)
      .single();

    // --- Create broker_profiles for portal access ---
    // First clean up any orphaned profile for this user
    await sb
      .from("broker_profiles")
      .delete()
      .eq("user_id", authUserId);

    const { error: profileError } = await sb
      .from("broker_profiles")
      .insert({
        user_id: authUserId,
        broker_id: brokerRecord.id,
        organization_id: organizationId,
        name: trimmedName,
        email: trimmedEmail,
        phone: phone?.trim() || null,
        company: null,
        organization_name: org?.name || null,
        organization_logo: org?.logo_url || null,
        is_active: true,
      });

    if (profileError) {
      console.error("[create-broker-with-auth] Create broker_profile error:", profileError);
      // Non-fatal — broker record is created, portal access can be fixed later
    }

    // --- Create broker_registration_requests record for consistency ---
    await sb
      .from("broker_registration_requests")
      .insert({
        organization_id: organizationId,
        user_id: authUserId,
        name: trimmedName,
        email: trimmedEmail,
        phone: phone?.trim() || null,
        company: null,
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      });

    console.log(`[create-broker-with-auth] Created broker "${trimmedName}" with auth for org ${organizationId}`);

    return res.json({ success: true, brokerId: brokerRecord.id });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[create-broker-with-auth] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
