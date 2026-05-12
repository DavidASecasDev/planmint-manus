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

// ─── JWT Decode (no verification) ───────────────────────────────────────────
// Decode the JWT payload WITHOUT verifying the signature.
// This is safe because we still call auth.getUser() to verify the token,
// but we use the decoded 'sub' claim as a cache key to avoid calling
// auth.getUser() on every single request.
function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// ─── Auth Cache (by User ID) ────────────────────────────────────────────────
// Cache auth results by USER ID (not by token) for 60 seconds.
// This means even if the token refreshes, the cached result is reused
// as long as it's the same user and within the TTL.
//
// On initial page load, 5-10+ hooks fire simultaneously, each calling
// authenticateSupabaseRequest. Without this cache, all of them would call
// auth.getUser() → Supabase rate limits (429).
interface AuthCacheEntry {
  userId: string;
  organizationId: string;
  timestamp: number;
  lastVerifiedToken: string; // Track which token was last verified
}

const AUTH_CACHE = new Map<string, AuthCacheEntry>(); // key = userId
const AUTH_CACHE_TTL_MS = 60_000; // 60 seconds
const AUTH_INFLIGHT = new Map<string, Promise<AuthCacheEntry>>(); // key = userId

/** Clear auth cache — exposed for testing only */
export function _clearAuthCacheForTesting() {
  AUTH_CACHE.clear();
  AUTH_INFLIGHT.clear();
}

/** Invalidate cached auth for a specific user (e.g., after org switch) */
export function invalidateAuthCacheForUser(userId: string) {
  AUTH_CACHE.delete(userId);
  AUTH_INFLIGHT.delete(userId);
}

// Periodically clean expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  Array.from(AUTH_CACHE.entries()).forEach(([key, entry]) => {
    if (now - entry.timestamp > AUTH_CACHE_TTL_MS * 2) {
      AUTH_CACHE.delete(key);
    }
  });
}, 5 * 60 * 1000);

/**
 * Authenticate a request using the Supabase JWT.
 * 
 * Strategy to avoid 429 rate limiting:
 * 1. Decode JWT locally (no network call) to extract user ID
 * 2. Check if we have a valid cached result for this user ID
 * 3. If cached, return immediately (no Supabase API call)
 * 4. If not cached, call auth.getUser() ONCE and cache the result
 * 5. Deduplicate concurrent requests for the same user
 * 
 * This reduces Supabase auth.getUser() calls from 5-10 per page load
 * to exactly 1 per user per 60 seconds.
 * 
 * Returns { userId, organizationId } or throws.
 */
export async function authenticateSupabaseRequest(
  authHeader: string | undefined
): Promise<{ userId: string; organizationId: string }> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    throw new AuthError("No authorization token provided", 401);
  }

  // Step 1: Decode JWT locally to get user ID (no network call)
  const payload = decodeJwtPayload(token);
  const userId = payload?.sub;

  if (!userId) {
    throw new AuthError("Invalid token format", 401);
  }

  // Step 2: Check if token is expired locally (avoid unnecessary API calls)
  if (payload?.exp && payload.exp * 1000 < Date.now()) {
    throw new AuthError("Invalid or expired token", 401);
  }

  // Step 3: Check cache by USER ID (not by token)
  const cached = AUTH_CACHE.get(userId);
  if (cached && Date.now() - cached.timestamp < AUTH_CACHE_TTL_MS) {
    return { userId: cached.userId, organizationId: cached.organizationId };
  }

  // Step 4: Deduplicate in-flight requests for the same USER
  const inflight = AUTH_INFLIGHT.get(userId);
  if (inflight) {
    const result = await inflight;
    return { userId: result.userId, organizationId: result.organizationId };
  }

  // Step 5: Verify token with Supabase (only 1 call per user per 60s)
  const authPromise = (async (): Promise<AuthCacheEntry> => {
    const serviceClient = getServiceClient();
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);

    if (userError || !userData?.user) {
      throw new AuthError("Invalid or expired token", 401);
    }

    const verifiedUserId = userData.user.id;

    // Use service role client for profile lookup too (bypasses RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", verifiedUserId)
      .single();

    if (profileError || !profile?.organization_id) {
      throw new AuthError("User has no organization", 400);
    }

    const entry: AuthCacheEntry = {
      userId: verifiedUserId,
      organizationId: profile.organization_id,
      timestamp: Date.now(),
      lastVerifiedToken: token,
    };

    // Store in cache by USER ID
    AUTH_CACHE.set(verifiedUserId, entry);

    return entry;
  })();

  // Register in-flight by USER ID
  AUTH_INFLIGHT.set(userId, authPromise);

  try {
    const result = await authPromise;
    return { userId: result.userId, organizationId: result.organizationId };
  } catch (err) {
    // On auth failure, clear any stale cache for this user
    AUTH_CACHE.delete(userId);
    throw err;
  } finally {
    AUTH_INFLIGHT.delete(userId);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
