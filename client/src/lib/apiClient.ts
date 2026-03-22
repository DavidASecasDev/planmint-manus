/**
 * API Client for calling our own Express endpoints.
 * Automatically attaches the Supabase session token for authentication.
 * Replaces supabase.functions.invoke() calls.
 */
import { supabase } from "@/integrations/supabase/client";

interface ApiResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Call one of our Express API endpoints with the current Supabase auth token.
 * Drop-in replacement for supabase.functions.invoke().
 */
export async function apiInvoke<T = unknown>(
  endpoint: string,
  options?: { body?: Record<string, unknown> }
): Promise<ApiResponse<T>> {
  try {
    // Get fresh session token
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });

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
