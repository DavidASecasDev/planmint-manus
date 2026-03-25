/**
 * Auth-related Express endpoints.
 * These replace direct Supabase frontend queries in AuthContext that fail
 * because the frontend anon key doesn't match the Supabase project.
 * All queries use serviceClient (service role key) to bypass RLS.
 *
 * IMPORTANT: Both endpoints now use authenticateSupabaseRequest() which
 * caches auth.getUser() results for 60s, preventing Supabase rate limiting (429).
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  extractBearerToken,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

// ─── 1. get-my-profile ──────────────────────────────────────────────────────
// Returns the authenticated user's profile from the profiles table.
// Uses authenticateSupabaseRequest() for cached auth validation.
export async function handleGetMyProfile(req: Request, res: Response) {
  try {
    // Use the cached auth helper instead of direct auth.getUser()
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);

    const serviceClient = getServiceClient();

    // Fetch full profile using service role client (bypasses RLS)
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
// Uses authenticateSupabaseRequest() for cached auth validation.
export async function handleGetMyOrganization(req: Request, res: Response) {
  try {
    // Use the cached auth helper instead of direct auth.getUser()
    const { userId, organizationId: userOrgId } = await authenticateSupabaseRequest(req.headers.authorization);

    const { organization_id } = req.body;

    if (!organization_id) {
      return res.json({ data: null, error: null });
    }

    const serviceClient = getServiceClient();

    // Security check: verify user belongs to this organization
    // First check via the cached auth result (profile.organization_id)
    if (userOrgId !== organization_id) {
      // Fallback: check organization_members table
      const { data: member } = await serviceClient
        .from("organization_members")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!member) {
        return res.status(403).json({ data: null, error: "Not authorized to access this organization" });
      }
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
