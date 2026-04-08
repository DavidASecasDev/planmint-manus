/**
 * API Client for calling our own Express endpoints.
 * Automatically attaches the Supabase session token for authentication.
 * Replaces supabase.functions.invoke() calls.
 *
 * On 401 responses, attempts to refresh the Supabase session and retry once.
 * If refresh fails (e.g. refresh_token expired), redirects to login.
 */
import { supabase, waitForSession } from "@/integrations/supabase/client";

interface ApiResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

/** Prevent multiple simultaneous refresh attempts */
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the Supabase session and return the new access_token.
 * Returns null if refresh fails (e.g. refresh_token expired).
 * Deduplicates concurrent calls so only one refresh request is made.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.warn("[apiClient] Session refresh failed:", error?.message || "no session");
        return null;
      }
      return data.session.access_token;
    } catch (err) {
      console.error("[apiClient] Session refresh exception:", err);
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * Redirect to login page, clearing stale session data.
 */
function redirectToLogin() {
  // Sign out to clear stale tokens from localStorage
  supabase.auth.signOut().finally(() => {
    window.location.href = "/login";
  });
}

/**
 * Call one of our Express API endpoints with the current Supabase auth token.
 * Drop-in replacement for supabase.functions.invoke().
 *
 * Flow:
 * 1. Wait for initial session to be validated/refreshed
 * 2. Get access_token from Supabase SDK
 * 3. Make the request
 * 4. On 401: refresh session and retry once
 * 5. On second 401: redirect to login
 */
export async function apiInvoke<T = unknown>(
  endpoint: string,
  options?: { body?: Record<string, unknown> }
): Promise<ApiResponse<T>> {
  try {
    // Wait for the initial session to be fully validated/refreshed
    await waitForSession();

    // Get current session token
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData?.session?.access_token;

    const makeRequest = async (token: string | undefined) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(`/api/${endpoint}`, {
        method: "POST",
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        credentials: "include",
      });
    };

    let response = await makeRequest(accessToken);

    // On 401, attempt to refresh the session and retry once
    if (response.status === 401 && accessToken) {
      console.warn(`[apiClient] 401 on /api/${endpoint} — attempting session refresh`);
      const newToken = await refreshAccessToken();

      if (newToken) {
        // Retry with the fresh token
        response = await makeRequest(newToken);

        if (response.status === 401) {
          // Refresh succeeded but token still rejected — session is truly invalid
          console.error(`[apiClient] 401 after refresh on /api/${endpoint} — redirecting to login`);
          redirectToLogin();
          return { data: null, error: { message: "Sesión expirada. Redirigiendo al login..." } };
        }
      } else {
        // Refresh failed — refresh_token is expired or revoked
        console.error(`[apiClient] Session refresh failed — redirecting to login`);
        redirectToLogin();
        return { data: null, error: { message: "Sesión expirada. Redirigiendo al login..." } };
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return {
        data: null,
        error: { message: errorData.error || `Edge Function returned a non-2xx status code` },
      };
    }

    const data = await response.json();
    return { data: data as T, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err?.message || "Error de red" },
    };
  }
}
