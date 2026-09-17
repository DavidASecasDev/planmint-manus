import { Request, Response } from "express";
import {
  authenticateSupabaseRequest,
  AuthError,
  getServiceClient,
} from "./supabaseAdmin";
import { requireAnyPermission } from "./permissionHelper";

interface BrokerRecord {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  is_active: boolean;
}

interface BrokerProfileRecord {
  id: string;
  broker_id: string | null;
  organization_id: string;
  is_active: boolean | null;
}

interface LinkBrokerCompanyResult {
  already_linked: boolean;
  profile_created: boolean;
  organization_name: string;
}

function linkErrorResponse(message: string): { status: number; message: string } {
  if (message.includes("profile_other_organization")) {
    return { status: 409, message: "Este acceso ya está vinculado a otra empresa. No se ha modificado." };
  }
  if (message.includes("broker_profile_missing")) {
    return { status: 409, message: "El perfil del portal está incompleto. Reconfigura primero el acceso al portal." };
  }
  if (message.includes("broker_profile_mismatch")) {
    return { status: 409, message: "Este acceso al portal pertenece a otra empresa o broker. No se ha modificado." };
  }
  if (message.includes("broker_profile_inactive")) {
    return { status: 409, message: "El acceso al portal está desactivado. Reactívalo antes de vincular la empresa." };
  }
  if (message.includes("broker_inactive")) {
    return { status: 409, message: "Activa primero el broker antes de vincular su acceso a la empresa." };
  }
  if (
    message.includes("broker_user_changed") ||
    message.includes("broker_link_changed") ||
    message.includes("profile_changed")
  ) {
    return { status: 409, message: "La vinculación cambió durante la operación. Actualiza la página y vuelve a intentarlo." };
  }
  if (message.includes("broker_not_found") || message.includes("organization_not_found")) {
    return { status: 404, message: "El broker o la empresa ya no están disponibles." };
  }
  return { status: 500, message: "No se pudo vincular el perfil a la empresa" };
}

/**
 * POST /api/link-broker-company
 *
 * Links the main profile of an already configured broker portal user to the
 * authenticated organization. Organization, broker and portal identities are
 * revalidated and locked inside one PostgreSQL transaction by the RPC.
 *
 * Body: { brokerId: string }
 */
export async function handleLinkBrokerCompany(req: Request, res: Response) {
  try {
    const { userId: actorUserId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { brokerId } = req.body ?? {};

    if (typeof brokerId !== "string" || !brokerId.trim()) {
      return res.status(400).json({ error: "brokerId is required" });
    }

    const sb = getServiceClient();
    const { role: actorRole } = await requireAnyPermission(
      sb,
      organizationId,
      actorUserId,
      ["transfers.manage_brokers", "transfers.manage"]
    );

    const { data: broker, error: brokerError } = await sb
      .from("transfer_brokers")
      .select("id, organization_id, user_id, name, is_active")
      .eq("id", brokerId)
      .eq("organization_id", organizationId)
      .maybeSingle<BrokerRecord>();

    if (brokerError) {
      console.error("[link-broker-company] Broker lookup failed:", brokerError.message);
      return res.status(500).json({ error: "No se pudo comprobar el broker" });
    }
    if (!broker) {
      return res.status(404).json({ error: "Broker no encontrado en esta organización" });
    }
    if (!broker.user_id) {
      return res.status(409).json({
        error: "Configura primero el acceso al portal antes de vincular la empresa",
      });
    }
    if (!broker.is_active) {
      return res.status(409).json({
        error: "Activa primero el broker antes de vincular su acceso a la empresa",
      });
    }

    const { data: brokerProfile, error: brokerProfileError } = await sb
      .from("broker_profiles")
      .select("id, broker_id, organization_id, is_active")
      .eq("user_id", broker.user_id)
      .maybeSingle<BrokerProfileRecord>();

    if (brokerProfileError) {
      console.error("[link-broker-company] Broker profile lookup failed:", brokerProfileError.message);
      return res.status(500).json({ error: "No se pudo comprobar el acceso al portal" });
    }
    if (!brokerProfile) {
      return res.status(409).json({
        error: "El perfil del portal está incompleto. Reconfigura primero el acceso al portal.",
      });
    }
    if (
      brokerProfile.organization_id !== organizationId ||
      brokerProfile.broker_id !== broker.id
    ) {
      return res.status(409).json({
        error: "Este acceso al portal pertenece a otra empresa o broker. No se ha modificado.",
      });
    }
    if (brokerProfile.is_active !== true) {
      return res.status(409).json({
        error: "El acceso al portal está desactivado. Reactívalo antes de vincular la empresa.",
      });
    }

    const { data, error } = await sb.rpc("link_broker_profile_to_company", {
      p_organization_id: organizationId,
      p_broker_id: broker.id,
      p_user_id: broker.user_id,
      p_actor_user_id: actorUserId,
      p_actor_role: actorRole,
    });

    if (error) {
      const mapped = linkErrorResponse(error.message || "");
      if (mapped.status >= 500) {
        console.error("[link-broker-company] Transaction failed:", error.message);
      }
      return res.status(mapped.status).json({ error: mapped.message });
    }

    const result = (Array.isArray(data) ? data[0] : data) as LinkBrokerCompanyResult | null;
    if (!result) {
      return res.status(500).json({ error: "La vinculación no devolvió un resultado verificable" });
    }

    return res.json({
      success: true,
      already_linked: result.already_linked,
      organization_name: result.organization_name,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (typeof err?.status === "number") {
      return res.status(err.status).json({ error: err.message || "Acceso denegado" });
    }
    console.error("[link-broker-company] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
