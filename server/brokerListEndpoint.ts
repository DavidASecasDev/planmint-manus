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
import { requireAnyPermission } from "./permissionHelper";

export async function handleGetTransferBrokers(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization found for user" });
    }

    const serviceClient = getServiceClient();
    await requireAnyPermission(serviceClient, organizationId, userId, [
      "transfers.manage_brokers",
      "transfers.manage",
    ]);

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
    let profileHealthMap: Record<string, {
      has_profile: boolean;
      has_org: boolean;
      has_broker_profile: boolean;
      broker_profile_matches: boolean;
      broker_profile_active: boolean;
      can_link_company: boolean;
      is_linked: boolean;
    }> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await serviceClient
        .from("profiles")
        .select("id, organization_id")
        .in("id", userIds);

      if (profilesError) {
        console.error("[getTransferBrokers] Profiles query error:", profilesError);
        return res.status(500).json({ data: null, error: "No se pudo comprobar el perfil de los brokers" });
      }

      const { data: brokerProfiles, error: brokerProfilesError } = await serviceClient
        .from("broker_profiles")
        .select("user_id, broker_id, organization_id, is_active")
        .in("user_id", userIds);

      if (brokerProfilesError) {
        console.error("[getTransferBrokers] Broker profiles query error:", brokerProfilesError);
        return res.status(500).json({ data: null, error: "No se pudo comprobar el acceso al portal" });
      }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const brokerProfileMap = new Map((brokerProfiles || []).map((p: any) => [p.user_id, p]));

      for (const broker of brokersWithUserId) {
        const profile = profileMap.get(broker.user_id);
        const brokerProfile = brokerProfileMap.get(broker.user_id);
        const profileMatches = profile?.organization_id === broker.organization_id;
        const brokerProfileMatches =
          brokerProfile?.organization_id === broker.organization_id &&
          brokerProfile?.broker_id === broker.id;
        const brokerProfileActive = brokerProfile?.is_active === true;
        const profileCompatible = !profile?.organization_id || profileMatches;
        const brokerProfileCompatible =
          !brokerProfile || (brokerProfileMatches && brokerProfileActive);
        profileHealthMap[broker.id] = {
          has_profile: !!profile,
          has_org: !!profile?.organization_id,
          has_broker_profile: !!brokerProfile,
          broker_profile_matches: brokerProfileMatches,
          broker_profile_active: brokerProfileActive,
          can_link_company:
            broker.is_active &&
            profileCompatible &&
            brokerProfileCompatible &&
            (!profileMatches || !brokerProfileMatches),
          is_linked: profileMatches && brokerProfileMatches,
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
    if (typeof err?.status === "number") {
      return res.status(err.status).json({ data: null, error: err.message || "Acceso denegado" });
    }
    console.error("[getTransferBrokers] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}
