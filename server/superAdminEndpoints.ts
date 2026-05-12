/**
 * Super Admin Express endpoints.
 * These use the service_role client to bypass RLS for administrative operations.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  extractBearerToken,
  AuthError,
} from "./supabaseAdmin";

async function authenticateAsSuperAdmin(
  authHeader: string | undefined
): Promise<{ userId: string; email: string }> {
  const token = extractBearerToken(authHeader);
  if (!token) throw new AuthError("No authorization token provided", 401);
  const serviceClient = getServiceClient();
  const { data: userData, error: userError } =
    await serviceClient.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new AuthError("Invalid or expired token", 401);
  }
  const userId = userData.user.id;
  // Verify super admin status
  const { data: superAdmin } = await serviceClient
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  if (!superAdmin) {
    throw new AuthError("Only super admins can perform this action", 403);
  }
  return { userId, email: userData.user.email || "" };
}

/**
 * POST /api/super-admin/add-member
 * Body: { userId, organizationId, role }
 * Adds a user to an organization, bypassing RLS.
 */
export async function handleSuperAdminAddMember(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { userId, organizationId, role } = req.body;
    if (!userId || !organizationId || !role) {
      return res.status(400).json({ error: "userId, organizationId, and role are required" });
    }
    const serviceClient = getServiceClient();

    // Check if membership already exists
    const { data: existing } = await serviceClient
      .from("organization_members")
      .select("id, status")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existing) {
      if (existing.status === "active") {
        return res.status(409).json({ error: "El usuario ya es miembro activo de esta organización" });
      }
      // Reactivate if suspended
      const { error } = await serviceClient
        .from("organization_members")
        .update({ status: "active", role })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      // Insert new membership
      const { error } = await serviceClient
        .from("organization_members")
        .insert({
          user_id: userId,
          organization_id: organizationId,
          role,
          status: "active",
        });
      if (error) throw error;
    }

    // Get org name for notification
    const { data: orgData } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    const orgDisplayName = orgData?.name || "una organización";
    const isReactivation = existing && existing.status !== "active";

    // Send in-app notification to the user
    await serviceClient.from("notifications").insert({
      organization_id: organizationId,
      user_id: userId,
      type: "assignment",
      title: isReactivation
        ? `Has sido reactivado en ${orgDisplayName}`
        : `Te han añadido a ${orgDisplayName}`,
      body: isReactivation
        ? `Tu acceso a ${orgDisplayName} ha sido restaurado con el rol de ${role}.`
        : `Has sido añadido como ${role} en ${orgDisplayName}. Ya puedes acceder a esta organización.`,
      entity_type: "task",
      entity_id: organizationId,
      is_read: false,
    });

    return res.json({
      data: { success: true, reactivated: !!isReactivation },
      error: null,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[super-admin/add-member] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
