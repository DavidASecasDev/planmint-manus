/**
 * Supabase Admin Client for server-side operations.
 * Uses the service_role key to bypass RLS for administrative operations.
 * Also provides a helper to create user-scoped clients from JWT tokens.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

// Service role client — bypasses RLS, use only on the server
let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    _serviceClient = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey);
  }
  return _serviceClient;
}

// Anon client scoped to a user's JWT — respects RLS
export function getUserClient(accessToken: string): SupabaseClient {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Extract the Bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Authenticate a request using the Supabase JWT.
 * Returns { userId, organizationId } or throws.
 */
export async function authenticateSupabaseRequest(
  authHeader: string | undefined
): Promise<{ userId: string; organizationId: string }> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    throw new AuthError("No authorization token provided", 401);
  }

  const userClient = getUserClient(token);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new AuthError("Invalid or expired token", 401);
  }

  const userId = userData.user.id;

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    throw new AuthError("User has no organization", 400);
  }

  return { userId, organizationId: profile.organization_id };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
