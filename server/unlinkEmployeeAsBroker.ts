import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError, getServiceClient } from "./supabaseAdmin";

/**
 * POST /api/unlink-employee-as-broker
 * Revokes broker portal access for an employee without deleting their PlanMint account.
 * Deactivates broker_profiles and optionally deactivates the transfer_brokers entity.
 *
 * Body: { memberId: string, deactivateBrokerEntity?: boolean }
 * - memberId: the user_id of the PlanMint employee
 * - deactivateBrokerEntity: if true, also sets transfer_brokers.is_active = false (default: false)
 */
export async function handleUnlinkEmployeeAsBroker(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { memberId, deactivateBrokerEntity = false } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }

    const sb = getServiceClient();

    // 1. Find the broker_profiles row for this user
    const { data: brokerProfile, error: profileError } = await sb
      .from("broker_profiles")
      .select("id, broker_id, name")
      .eq("user_id", memberId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (profileError) {
      console.error("[unlink-employee-as-broker] Query error:", profileError);
      return res.status(500).json({ error: "Error al buscar perfil de broker" });
    }

    if (!brokerProfile) {
      return res.status(404).json({ 
        error: "Este empleado no tiene acceso al portal de brokers" 
      });
    }

    // 2. Delete the broker_profiles row (revokes portal access)
    const { error: deleteError } = await sb
      .from("broker_profiles")
      .delete()
      .eq("id", brokerProfile.id);

    if (deleteError) {
      console.error("[unlink-employee-as-broker] Delete broker_profile error:", deleteError);
      return res.status(500).json({ error: "Error al revocar acceso de broker" });
    }

    // 3. Optionally deactivate the transfer_brokers entity
    if (deactivateBrokerEntity && brokerProfile.broker_id) {
      const { error: deactivateError } = await sb
        .from("transfer_brokers")
        .update({ is_active: false, user_id: null })
        .eq("id", brokerProfile.broker_id)
        .eq("organization_id", organizationId);

      if (deactivateError) {
        console.error("[unlink-employee-as-broker] Deactivate broker entity error:", deactivateError);
        // Non-critical: profile already deleted, just log the error
      }
    } else if (brokerProfile.broker_id) {
      // Just clear the user_id from the broker entity so it can be re-linked later
      await sb
        .from("transfer_brokers")
        .update({ user_id: null })
        .eq("id", brokerProfile.broker_id)
        .eq("organization_id", organizationId);
    }

    console.log(`[unlink-employee-as-broker] Revoked broker access for user ${memberId} (profile ${brokerProfile.id})`);

    // 4. Audit log
    try {
      await sb.from("audit_logs").insert({
        organization_id: organizationId,
        actor_user_id: userId,
        actor_role: "admin",
        action: "broker.unlink_employee",
        entity_type: "broker_profiles",
        entity_id: brokerProfile.broker_id || brokerProfile.id,
        metadata_json: JSON.stringify({
          unlinked_user_id: memberId,
          unlinked_user_name: brokerProfile.name,
          broker_id: brokerProfile.broker_id,
          deactivated_entity: deactivateBrokerEntity,
        }),
        ip_address: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
        user_agent: req.headers["user-agent"] || null,
      });
    } catch (auditErr) {
      console.error("[unlink-employee-as-broker] Audit log failed:", auditErr);
    }

    return res.json({ 
      success: true, 
      message: `Se ha revocado el acceso al portal de brokers para ${brokerProfile.name || "el empleado"}`
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[unlink-employee-as-broker] Error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
