/**
 * POST /api/delete-broker
 * 
 * Fully deletes a broker and all associated records:
 * 1. Deletes from transfer_brokers
 * 2. Deletes from broker_profiles (portal access)
 * 3. Deletes from broker_registration_requests (allows re-registration)
 * 4. Deletes the Supabase Auth user IF they have no other role (no profile in profiles table)
 * 
 * This ensures a deleted broker can re-register with the same email.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

export async function handleDeleteBroker(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { brokerId } = req.body;
    if (!brokerId) {
      return res.status(400).json({ error: "brokerId is required" });
    }

    const sb = getServiceClient();

    // 1. Fetch the broker record to get user_id and email
    const { data: broker, error: fetchError } = await sb
      .from("transfer_brokers")
      .select("id, user_id, email, name, organization_id")
      .eq("id", brokerId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !broker) {
      return res.status(404).json({ error: "Broker not found" });
    }

    const userId = broker.user_id;
    const brokerEmail = broker.email;

    // 2. Delete from transfer_brokers
    const { error: deleteError } = await sb
      .from("transfer_brokers")
      .delete()
      .eq("id", brokerId);

    if (deleteError) {
      console.error("[delete-broker] Delete transfer_brokers error:", deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    // 3. Delete from broker_profiles (if user_id exists)
    if (userId) {
      const { error: profileError } = await sb
        .from("broker_profiles")
        .delete()
        .eq("user_id", userId);

      if (profileError) {
        console.error("[delete-broker] Delete broker_profiles error:", profileError);
        // Non-fatal: continue cleanup
      }
    }

    // 4. Delete from broker_registration_requests (by email and org)
    if (brokerEmail) {
      const { error: reqError } = await sb
        .from("broker_registration_requests")
        .delete()
        .eq("organization_id", organizationId)
        .eq("email", brokerEmail.toLowerCase());

      if (reqError) {
        console.error("[delete-broker] Delete broker_registration_requests error:", reqError);
        // Non-fatal: continue cleanup
      }
    }

    // 5. Delete the Auth user IF they don't have a PlanMint profile (i.e., they're broker-only)
    if (userId) {
      const { data: planmintProfile } = await sb
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!planmintProfile) {
        // User has no PlanMint profile — safe to delete from auth
        const { error: authDeleteError } = await sb.auth.admin.deleteUser(userId);
        if (authDeleteError) {
          console.error("[delete-broker] Delete auth user error:", authDeleteError);
          // Non-fatal: broker record is already cleaned up
        } else {
          console.log(`[delete-broker] Deleted auth user ${userId} (broker-only account)`);
        }
      } else {
        console.log(`[delete-broker] Kept auth user ${userId} (has PlanMint profile)`);
      }
    }

    console.log(`[delete-broker] Fully deleted broker "${broker.name}" (${brokerId})`);
    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[delete-broker] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
