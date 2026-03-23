/**
 * Auth-related Express endpoints.
 * These replace direct Supabase frontend queries in AuthContext that fail
 * because the frontend anon key doesn't match the Supabase project.
 * All queries use serviceClient (service role key) to bypass RLS.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  extractBearerToken,
  AuthError,
} from "./supabaseAdmin";

// ─── 1. get-my-profile ──────────────────────────────────────────────────────
// Returns the authenticated user's profile from the profiles table.
// Replaces: supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
export async function handleGetMyProfile(req: Request, res: Response) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ data: null, error: "No authorization token provided" });
    }

    const serviceClient = getServiceClient();

    // Validate the user's JWT using the service role client
    const { data: userData, error: userError } =
      await serviceClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return res.status(401).json({ data: null, error: "Invalid or expired token" });
    }

    const userId = userData.user.id;

    // Fetch profile using service role client (bypasses RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[getMyProfile] Query error:", profileError);
      return res.json({ data: null, error: profileError.message });
    }

    return res.json({ data: profile, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getMyProfile] Error:", err);
    return res.json({ data: null, error: "Internal server error" });
  }
}

// ─── 2. get-my-organization ─────────────────────────────────────────────────
// Returns the organization data for the given organization_id.
// Replaces: supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
export async function handleGetMyOrganization(req: Request, res: Response) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ data: null, error: "No authorization token provided" });
    }

    const serviceClient = getServiceClient();

    // Validate the user's JWT
    const { data: userData, error: userError } =
      await serviceClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return res.status(401).json({ data: null, error: "Invalid or expired token" });
    }

    const { organization_id } = req.body;

    if (!organization_id) {
      return res.json({ data: null, error: null });
    }

    // Verify the user belongs to this organization (security check)
    const { data: member } = await serviceClient
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    // Also check if user's profile has this org_id (for users not yet in members table)
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", userData.user.id)
      .single();

    if (!member && profile?.organization_id !== organization_id) {
      return res.status(403).json({ data: null, error: "Not authorized to access this organization" });
    }

    // Fetch organization using service role client (bypasses RLS)
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("*")
      .eq("id", organization_id)
      .maybeSingle();

    if (orgError) {
      console.error("[getMyOrganization] Query error:", orgError);
      return res.json({ data: null, error: orgError.message });
    }

    return res.json({ data: org, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getMyOrganization] Error:", err);
    return res.json({ data: null, error: "Internal server error" });
  }
}
