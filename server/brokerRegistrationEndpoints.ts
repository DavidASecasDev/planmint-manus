/**
 * Broker Registration Endpoints
 * Handles approving and rejecting broker registration requests.
 * Uses service role client to bypass RLS.
 * 
 * On approval:
 * 1. Updates broker_registration_requests.status to 'approved'
 * 2. Creates/finds a transfer_brokers entry
 * 3. Creates a broker_profiles entry linking the user to the broker and org
 */
import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

/**
 * POST /api/approve-broker-registration
 * Approves a pending broker registration request.
 * Creates transfer_broker + broker_profile so the user can access the broker portal.
 */
export async function handleApproveBrokerRegistration(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const sb = getServiceClient();

    // 1. Fetch the registration request
    const { data: request, error: fetchError } = await sb
      .from("broker_registration_requests")
      .select("*")
      .eq("id", requestId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: "Registration request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    // 2. Update the registration request status to approved
    const { error: updateError } = await sb
      .from("broker_registration_requests")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("[approve-broker-registration] Update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // 3. Find or create broker in transfer_brokers
    const brokerName = request.name;
    let brokerId: string | null = null;

    const { data: existingBroker } = await sb
      .from("transfer_brokers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", brokerName)
      .maybeSingle();

    if (existingBroker) {
      brokerId = existingBroker.id;
    } else {
      const { data: newBroker, error: insertError } = await sb
        .from("transfer_brokers")
        .insert({
          organization_id: organizationId,
          name: brokerName,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[approve-broker-registration] Insert broker error:", insertError);
      } else {
        brokerId = newBroker.id;
      }
    }

    // 4. Get organization info for the broker profile
    const { data: org } = await sb
      .from("organizations")
      .select("name, logo_url")
      .eq("id", organizationId)
      .single();

    // 5. Create broker_profile linking user to broker and organization
    if (request.user_id) {
      // Check if broker_profile already exists for this user
      const { data: existingProfile } = await sb
        .from("broker_profiles")
        .select("id")
        .eq("user_id", request.user_id)
        .maybeSingle();

      if (!existingProfile) {
        const { error: profileError } = await sb
          .from("broker_profiles")
          .insert({
            user_id: request.user_id,
            broker_id: brokerId,
            organization_id: organizationId,
            name: request.name,
            email: request.email || null,
            phone: request.phone || null,
            company: request.company || null,
            organization_name: org?.name || null,
            organization_logo: org?.logo_url || null,
            is_active: true,
          });

        if (profileError) {
          console.error("[approve-broker-registration] Create broker_profile error:", profileError);
          // Don't fail — the approval is already done, broker can be fixed manually
        } else {
          console.log(`[approve-broker-registration] Created broker_profile for user ${request.user_id}`);
        }
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[approve-broker-registration] Error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}

/**
 * POST /api/reject-broker-registration
 * Rejects a pending broker registration request.
 */
export async function handleRejectBrokerRegistration(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { requestId, reason } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const sb = getServiceClient();

    // 1. Verify the request exists and belongs to this organization
    const { data: request, error: fetchError } = await sb
      .from("broker_registration_requests")
      .select("id, status, organization_id")
      .eq("id", requestId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: "Registration request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    // 2. Update the registration request status to rejected
    const { error: updateError } = await sb
      .from("broker_registration_requests")
      .update({
        status: "rejected",
        rejection_reason: reason || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("[reject-broker-registration] Update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[reject-broker-registration] Error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
