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

function handleError(res: Response, err: any, context: string) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`[super-admin/${context}] Error:`, err);
  return res.status(500).json({ error: err.message || "Internal server error" });
}

/**
 * POST /api/super-admin/add-member
 * Body: { userId, organizationId, role }
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
    return handleError(res, err, "add-member");
  }
}

/**
 * POST /api/super-admin/update-member-role
 * Body: { memberId, newRole }
 */
export async function handleSuperAdminUpdateMemberRole(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { memberId, newRole } = req.body;
    if (!memberId || !newRole) {
      return res.status(400).json({ error: "memberId and newRole are required" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("organization_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-member-role");
  }
}

/**
 * POST /api/super-admin/update-member-status
 * Body: { memberId, status }
 */
export async function handleSuperAdminUpdateMemberStatus(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { memberId, status } = req.body;
    if (!memberId || !status) {
      return res.status(400).json({ error: "memberId and status are required" });
    }
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("organization_members")
      .update({ status })
      .eq("id", memberId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-member-status");
  }
}

/**
 * POST /api/super-admin/remove-member
 * Body: { memberId }
 */
export async function handleSuperAdminRemoveMember(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("organization_members")
      .delete()
      .eq("id", memberId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "remove-member");
  }
}

/**
 * POST /api/super-admin/update-org-status
 * Body: { orgId, status }
 */
export async function handleSuperAdminUpdateOrgStatus(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { orgId, status } = req.body;
    if (!orgId || !status) {
      return res.status(400).json({ error: "orgId and status are required" });
    }
    if (!["active", "suspended", "deleted"].includes(status)) {
      return res.status(400).json({ error: "status must be 'active', 'suspended', or 'deleted'" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("organizations")
      .update({ status })
      .eq("id", orgId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-org-status");
  }
}

/**
 * POST /api/super-admin/delete-organization
 * Body: { orgId }
 */
export async function handleSuperAdminDeleteOrganization(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { orgId } = req.body;
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }
    const serviceClient = getServiceClient();
    // Delete related data first
    await serviceClient.from("tasks").delete().eq("organization_id", orgId);
    await serviceClient.from("areas").delete().eq("organization_id", orgId);
    await serviceClient.from("organization_members").delete().eq("organization_id", orgId);
    await serviceClient.from("subscriptions").delete().eq("organization_id", orgId);
    // Then delete the organization
    const { error } = await serviceClient
      .from("organizations")
      .delete()
      .eq("id", orgId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-organization");
  }
}

/**
 * POST /api/super-admin/update-org-plan
 * Body: { orgId, plan }
 */
export async function handleSuperAdminUpdateOrgPlan(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { orgId, plan } = req.body;
    if (!orgId || !plan) {
      return res.status(400).json({ error: "orgId and plan are required" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("subscriptions")
      .update({ plan })
      .eq("organization_id", orgId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-org-plan");
  }
}

/**
 * POST /api/super-admin/update-feedback
 * Body: { feedbackId, readAt?, resolvedAt?, internalNotes? }
 */
export async function handleSuperAdminUpdateFeedback(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { feedbackId, readAt, resolvedAt, internalNotes } = req.body;
    if (!feedbackId) {
      return res.status(400).json({ error: "feedbackId is required" });
    }
    const updates: Record<string, any> = {};
    if (readAt !== undefined) updates.read_at = readAt;
    if (resolvedAt !== undefined) updates.resolved_at = resolvedAt;
    if (internalNotes !== undefined) updates.internal_notes = internalNotes;
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("user_feedback")
      .update(updates)
      .eq("id", feedbackId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-feedback");
  }
}

/**
 * POST /api/super-admin/delete-feedback
 * Body: { feedbackId }
 */
export async function handleSuperAdminDeleteFeedback(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { feedbackId } = req.body;
    if (!feedbackId) {
      return res.status(400).json({ error: "feedbackId is required" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("user_feedback")
      .delete()
      .eq("id", feedbackId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-feedback");
  }
}

/**
 * POST /api/super-admin/delete-task
 * Body: { taskId }
 */
export async function handleSuperAdminDeleteTask(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("tasks")
      .delete()
      .eq("id", taskId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-task");
  }
}

/**
 * POST /api/super-admin/delete-area
 * Body: { areaId }
 */
export async function handleSuperAdminDeleteArea(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { areaId } = req.body;
    if (!areaId) {
      return res.status(400).json({ error: "areaId is required" });
    }
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from("areas")
      .delete()
      .eq("id", areaId);
    if (error) throw error;
    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-area");
  }
}

/**
 * POST /api/super-admin/get-user-memberships
 * Body: { userId }
 * Returns all organization memberships for a given user.
 */
export async function handleSuperAdminGetUserMemberships(
  req: Request,
  res: Response
) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from("organization_members")
      .select("id, organization_id, role, status, created_at, organization:organizations!organization_members_organization_id_fkey(id, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ data, error: null });
  } catch (err: any) {
    return handleError(res, err, "get-user-memberships");
  }
}
