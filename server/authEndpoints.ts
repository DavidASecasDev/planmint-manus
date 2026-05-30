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
  invalidateAuthCacheForUser,
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

// ─── 3. get-my-organizations ────────────────────────────────────────────────
// Returns all organizations the authenticated user belongs to.
// Uses organization_members table to find memberships.
export async function handleGetMyOrganizations(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const serviceClient = getServiceClient();

    // Get all organization memberships for this user
    const { data: memberships, error: memberError } = await serviceClient
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active");

    if (memberError) {
      console.error("[getMyOrganizations] Membership query error:", memberError);
      return res.json({ data: [], error: memberError.message });
    }

    if (!memberships || memberships.length === 0) {
      // Fallback: check profile's organization_id directly
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.organization_id) {
        const { data: org } = await serviceClient
          .from("organizations")
          .select("id, name, created_at, vertical_preset")
          .eq("id", profile.organization_id)
          .maybeSingle();

        if (org) {
          return res.json({ data: [{ ...org, role: "owner", is_current: true }], error: null });
        }
      }

      return res.json({ data: [], error: null });
    }

    // Fetch organization details for all memberships
    const orgIds = memberships.map((m) => m.organization_id);
    const { data: orgs, error: orgsError } = await serviceClient
      .from("organizations")
      .select("id, name, created_at, vertical_preset")
      .in("id", orgIds);

    if (orgsError) {
      console.error("[getMyOrganizations] Orgs query error:", orgsError);
      return res.json({ data: [], error: orgsError.message });
    }

    // Get user's current active org from profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    // Merge org data with membership role and current status
    const result = (orgs || []).map((org) => {
      const membership = memberships.find((m) => m.organization_id === org.id);
      return {
        ...org,
        role: membership?.role || "member",
        is_current: profile?.organization_id === org.id,
      };
    });

    return res.json({ data: result, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: [], error: err.message });
    }
    console.error("[getMyOrganizations] Error:", err);
    return res.json({ data: [], error: "Internal server error" });
  }
}

// ─── 4. switch-organization ─────────────────────────────────────────────────
// Switches the user's active organization by updating profiles.organization_id.
// Validates that the user is a member of the target organization.
export async function handleSwitchOrganization(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { organization_id } = req.body;

    if (!organization_id) {
      return res.status(400).json({ data: null, error: "organization_id is required" });
    }

    const serviceClient = getServiceClient();

    // Verify user is a member of the target organization
    const { data: membership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("id, role, status")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (memberError) {
      console.error("[switchOrganization] Membership check error:", memberError);
      return res.status(500).json({ data: null, error: "Failed to verify membership" });
    }

    if (!membership) {
      return res.status(403).json({ data: null, error: "Not a member of this organization" });
    }

    // Update the user's active organization in profiles
    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({
        organization_id: organization_id,
        role: membership.role, // Sync the role for this org
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[switchOrganization] Profile update error:", updateError);
      return res.status(500).json({ data: null, error: "Failed to switch organization" });
    }

    // Clear the auth cache so subsequent requests pick up the new org
    invalidateAuthCacheForUser(userId);

    // Fetch the new organization data
    const { data: org } = await serviceClient
      .from("organizations")
      .select("id, name, created_at, vertical_preset")
      .eq("id", organization_id)
      .maybeSingle();

    return res.json({ data: { organization: org, role: membership.role }, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[switchOrganization] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}
