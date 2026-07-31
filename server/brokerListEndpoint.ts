/**
 * GET /api/get-transfer-brokers
 * Returns transfer_brokers for the authenticated user's organization.
 * Uses service role client to bypass RLS — fixes Bug 3 where RLS
 * policies could block broker visibility when the Supabase session
 * token was stale or not properly refreshed.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

export async function handleGetTransferBrokers(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization found for user" });
    }

    const serviceClient = getServiceClient();

    // Fetch all brokers (both active and inactive) for the organization
    const { data: allBrokers, error: allError } = await serviceClient
      .from("transfer_brokers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (allError) {
      console.error("[getTransferBrokers] All brokers query error:", allError);
      return res.status(500).json({ data: null, error: allError.message });
    }

    // Also return active-only subset for convenience
    const activeBrokers = (allBrokers || []).filter((b: any) => b.is_active);

    // Check profile health for brokers with portal access (user_id)
    const brokersWithUserId = (allBrokers || []).filter((b: any) => b.user_id);
    const userIds = brokersWithUserId.map((b: any) => b.user_id);
    let profileHealthMap: Record<string, { has_profile: boolean; has_org: boolean }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, organization_id")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      for (const broker of brokersWithUserId) {
        const profile = profileMap.get(broker.user_id);
        profileHealthMap[broker.id] = {
          has_profile: !!profile,
          has_org: !!profile?.organization_id,
        };
      }
    }

    return res.json({
      data: {
        brokers: activeBrokers,
        allBrokers: allBrokers || [],
        profileHealth: profileHealthMap,
      },
      error: null,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getTransferBrokers] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}
