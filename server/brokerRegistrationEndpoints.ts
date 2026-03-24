/**
 * Broker Registration Endpoints
 * Handles approving and rejecting broker registration requests.
 * Uses service role client to bypass RLS.
 */
import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

/**
 * POST /api/approve-broker-registration
 * Approves a pending broker registration request.
 * Also creates a new entry in transfer_brokers if the broker doesn't exist yet.
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

    // 3. Check if a broker with this name already exists in transfer_brokers
    const brokerName = request.name;
    const { data: existingBroker } = await sb
      .from("transfer_brokers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", brokerName)
      .maybeSingle();

    // 4. If no broker exists, create one
    if (!existingBroker) {
      const { error: insertError } = await sb
        .from("transfer_brokers")
        .insert({
          organization_id: organizationId,
          name: brokerName,
          is_active: true,
        });

      if (insertError) {
        console.error("[approve-broker-registration] Insert broker error:", insertError);
        // Don't fail the approval — the request is already approved
        // Just log the error
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
