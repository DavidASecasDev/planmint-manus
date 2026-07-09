import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError, getServiceClient } from "./supabaseAdmin";

/**
 * POST /api/link-employee-as-broker
 * Links an existing PlanMint employee to a broker entity, creating the broker_profiles
 * row so they can access the broker portal without going through the invite/register flow.
 *
 * Body: { memberId: string, brokerId?: string }
 * - memberId: the user_id of the PlanMint employee (from profiles table)
 * - brokerId: (optional) existing transfer_brokers.id to link to. If omitted, creates a new broker entity.
 */
export async function handleLinkEmployeeAsBroker(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { memberId, brokerId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }

    const sb = getServiceClient();

    // 1. Verify the member exists in this organization
    const { data: member, error: memberError } = await sb
      .from("organization_members")
      .select("user_id, profiles!inner(id, name)")
      .eq("user_id", memberId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (memberError || !member) {
      return res.status(404).json({ error: "El empleado no pertenece a esta organización" });
    }

    // Get the member's email from auth.users
    const { data: authData } = await sb.auth.admin.getUserById(memberId);
    const memberEmail = authData?.user?.email || null;
    const memberName = (member as any).profiles?.name || "Empleado";

    // 2. Check if user already has a broker_profiles row
    const { data: existingProfile } = await sb
      .from("broker_profiles")
      .select("id")
      .eq("user_id", memberId)
      .maybeSingle();

    if (existingProfile) {
      return res.status(409).json({ 
        error: "Este empleado ya tiene acceso al portal de brokers",
        already_linked: true
      });
    }

    // 3. Resolve or create the broker entity
    let resolvedBrokerId = brokerId;

    if (brokerId) {
      // Verify the broker belongs to this organization
      const { data: broker, error: brokerError } = await sb
        .from("transfer_brokers")
        .select("id, user_id")
        .eq("id", brokerId)
        .eq("organization_id", organizationId)
        .single();

      if (brokerError || !broker) {
        return res.status(404).json({ error: "Broker no encontrado en esta organización" });
      }

      // Update the broker's user_id if not already set
      if (!broker.user_id) {
        await sb
          .from("transfer_brokers")
          .update({ user_id: memberId, email: memberEmail })
          .eq("id", brokerId);
      }
    } else {
      // Create a new broker entity for this employee
      const { data: newBroker, error: insertError } = await sb
        .from("transfer_brokers")
        .insert({
          organization_id: organizationId,
          name: memberName,
          email: memberEmail,
          user_id: memberId,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[link-employee-as-broker] Insert broker error:", insertError);
        return res.status(500).json({ error: "Error al crear entidad broker" });
      }
      resolvedBrokerId = newBroker.id;
    }

    // 4. Get organization info for the broker profile
    const { data: org } = await sb
      .from("organizations")
      .select("name, logo_url")
      .eq("id", organizationId)
      .single();

    // 5. Create broker_profiles row
    const { error: profileError } = await sb
      .from("broker_profiles")
      .insert({
        user_id: memberId,
        broker_id: resolvedBrokerId,
        organization_id: organizationId,
        name: memberName,
        email: memberEmail,
        organization_name: org?.name || null,
        organization_logo: org?.logo_url || null,
        is_active: true,
      });

    if (profileError) {
      console.error("[link-employee-as-broker] Create broker_profile error:", profileError);
      return res.status(500).json({ error: "Error al crear perfil de broker" });
    }

    console.log(`[link-employee-as-broker] Linked employee ${memberId} to broker ${resolvedBrokerId}`);

    return res.json({ 
      success: true, 
      brokerId: resolvedBrokerId,
      message: `${memberName} ahora tiene acceso al portal de brokers`
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[link-employee-as-broker] Error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
