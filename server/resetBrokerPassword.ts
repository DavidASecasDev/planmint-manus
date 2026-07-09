/**
 * POST /api/reset-broker-password
 * 
 * Resets the password for an existing broker's auth account.
 * Requires: brokerId and newPassword in body.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

export async function handleResetBrokerPassword(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { brokerId, newPassword } = req.body;

    if (!brokerId || !newPassword) {
      return res.status(400).json({ error: "brokerId and newPassword are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const sb = getServiceClient();

    // --- Find the broker and verify it belongs to this organization ---
    const { data: broker, error: brokerError } = await sb
      .from("transfer_brokers")
      .select("id, name, email, user_id, organization_id")
      .eq("id", brokerId)
      .single();

    if (brokerError || !broker) {
      return res.status(404).json({ error: "Broker no encontrado" });
    }

    if (broker.organization_id !== organizationId) {
      return res.status(403).json({ error: "No tienes permiso para modificar este broker" });
    }

    // --- Find the auth user ---
    let authUserId = broker.user_id;

    if (!authUserId && broker.email) {
      // Try to find user by email if user_id is not linked
      const { data: listData } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existingUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === broker.email?.toLowerCase()
      );
      if (existingUser) {
        authUserId = existingUser.id;
      }
    }

    if (!authUserId) {
      return res.status(404).json({ error: "Este broker no tiene cuenta de autenticación. Usa 'Configurar Portal' primero." });
    }

    // --- Update the password ---
    const { error: updateError } = await sb.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("[reset-broker-password] Update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log(`[reset-broker-password] Password reset for broker "${broker.name}" (${broker.email}) by user ${userId}`);

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[reset-broker-password] Unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
