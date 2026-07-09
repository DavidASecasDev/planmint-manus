import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError, getServiceClient } from "./supabaseAdmin";

/**
 * POST /api/check-broker-access
 * Checks if a given user has a broker_profiles entry (i.e., has broker portal access).
 * Used by the sidebar to show/hide the "Portal Broker" link.
 */
export async function handleCheckBrokerAccess(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("broker_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      console.error("[check-broker-access] Error:", error.message);
      return res.status(500).json({ error: "Error checking broker access" });
    }

    return res.json({ exists: !!data });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    console.error("[check-broker-access] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
