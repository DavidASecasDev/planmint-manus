/**
 * Super Admin Express endpoints.
 * These use the service_role client to bypass RLS for administrative operations.
 * All mutating actions are logged to audit_logs for traceability.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  extractBearerToken,
  AuthError,
} from "./supabaseAdmin";

// ─── Auth helper ────────────────────────────────────────────────────────────

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

// ─── Audit helper ───────────────────────────────────────────────────────────

interface AuditEntry {
  organizationId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
}

async function logAudit(entry: AuditEntry, req: Request) {
  try {
    const serviceClient = getServiceClient();
    await serviceClient.from("audit_logs").insert({
      organization_id: entry.organizationId || null,
      actor_user_id: entry.actorUserId,
      actor_role: "super_admin",
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      metadata_json: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ip_address: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
      user_agent: req.headers["user-agent"] || null,
    });
  } catch (err) {
    console.error("[audit-log] Failed to write audit entry:", err);
    // Never fail the main operation because of audit logging
  }
}

// ─── Error helper ───────────────────────────────────────────────────────────

function handleError(res: Response, err: any, context: string) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`[super-admin/${context}] Error:`, err);
  return res.status(500).json({ error: err.message || "Internal server error" });
}

// ─── Member endpoints ───────────────────────────────────────────────────────

/**
 * POST /api/super-admin/add-member
 * Body: { userId, organizationId, role }
 */
export async function handleSuperAdminAddMember(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
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

    let isReactivation = false;
    if (existing) {
      if (existing.status === "active") {
        return res.status(409).json({ error: "El usuario ya es miembro activo de esta organización" });
      }
      const { error } = await serviceClient
        .from("organization_members")
        .update({ status: "active", role })
        .eq("id", existing.id);
      if (error) throw error;
      isReactivation = true;
    } else {
      const { error } = await serviceClient
        .from("organization_members")
        .insert({ user_id: userId, organization_id: organizationId, role, status: "active" });
      if (error) throw error;
    }

    // Get org name for notification
    const { data: orgData } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();
    const orgDisplayName = orgData?.name || "una organización";

    // Get user name for audit
    const { data: userData } = await serviceClient
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .single();

    // Send notification
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

    // Audit log
    await logAudit({
      organizationId,
      actorUserId: admin.userId,
      action: isReactivation ? "update.member_reactivated" : "create.member",
      entityType: "organization_member",
      entityId: userId,
      metadata: {
        targetUserName: userData?.name || userId,
        orgName: orgDisplayName,
        role,
        reactivated: isReactivation,
      },
    }, req);

    return res.json({ data: { success: true, reactivated: isReactivation }, error: null });
  } catch (err: any) {
    return handleError(res, err, "add-member");
  }
}

/**
 * POST /api/super-admin/update-member-role
 * Body: { memberId, newRole }
 */
export async function handleSuperAdminUpdateMemberRole(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { memberId, newRole } = req.body;
    if (!memberId || !newRole) {
      return res.status(400).json({ error: "memberId and newRole are required" });
    }
    const serviceClient = getServiceClient();

    // Get current member info for audit
    const { data: member } = await serviceClient
      .from("organization_members")
      .select("user_id, role, organization_id, profiles:user_id(name), organizations:organization_id(name)")
      .eq("id", memberId)
      .single();

    const { error } = await serviceClient
      .from("organization_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) throw error;

    await logAudit({
      organizationId: member?.organization_id,
      actorUserId: admin.userId,
      action: "update.member_role",
      entityType: "organization_member",
      entityId: memberId,
      metadata: {
        targetUserName: (member?.profiles as any)?.name || member?.user_id,
        orgName: (member?.organizations as any)?.name,
        oldRole: member?.role,
        newRole,
      },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-member-role");
  }
}

/**
 * POST /api/super-admin/update-member-status
 * Body: { memberId, status }
 */
export async function handleSuperAdminUpdateMemberStatus(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { memberId, status } = req.body;
    if (!memberId || !status) {
      return res.status(400).json({ error: "memberId and status are required" });
    }
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
    }
    const serviceClient = getServiceClient();

    // Get current member info for audit
    const { data: member } = await serviceClient
      .from("organization_members")
      .select("user_id, status, organization_id, profiles:user_id(name), organizations:organization_id(name)")
      .eq("id", memberId)
      .single();

    const { error } = await serviceClient
      .from("organization_members")
      .update({ status })
      .eq("id", memberId);
    if (error) throw error;

    await logAudit({
      organizationId: member?.organization_id,
      actorUserId: admin.userId,
      action: status === "active" ? "update.member_reactivated" : "update.member_suspended",
      entityType: "organization_member",
      entityId: memberId,
      metadata: {
        targetUserName: (member?.profiles as any)?.name || member?.user_id,
        orgName: (member?.organizations as any)?.name,
        oldStatus: member?.status,
        newStatus: status,
      },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-member-status");
  }
}

/**
 * POST /api/super-admin/remove-member
 * Body: { memberId }
 */
export async function handleSuperAdminRemoveMember(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }
    const serviceClient = getServiceClient();

    // Get member info before deletion for audit
    const { data: member } = await serviceClient
      .from("organization_members")
      .select("user_id, role, organization_id, profiles:user_id(name), organizations:organization_id(name)")
      .eq("id", memberId)
      .single();

    const { error } = await serviceClient
      .from("organization_members")
      .delete()
      .eq("id", memberId);
    if (error) throw error;

    await logAudit({
      organizationId: member?.organization_id,
      actorUserId: admin.userId,
      action: "delete.member",
      entityType: "organization_member",
      entityId: memberId,
      metadata: {
        targetUserName: (member?.profiles as any)?.name || member?.user_id,
        targetUserId: member?.user_id,
        orgName: (member?.organizations as any)?.name,
        role: member?.role,
      },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "remove-member");
  }
}

// ─── Organization endpoints ─────────────────────────────────────────────────

/**
 * POST /api/super-admin/update-org-status
 * Body: { orgId, status }
 */
export async function handleSuperAdminUpdateOrgStatus(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { orgId, status } = req.body;
    if (!orgId || !status) {
      return res.status(400).json({ error: "orgId and status are required" });
    }
    if (!["active", "suspended", "deleted"].includes(status)) {
      return res.status(400).json({ error: "status must be 'active', 'suspended', or 'deleted'" });
    }
    const serviceClient = getServiceClient();

    // Get current org info for audit
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name, status")
      .eq("id", orgId)
      .single();

    const { error } = await serviceClient
      .from("organizations")
      .update({ status })
      .eq("id", orgId);
    if (error) throw error;

    await logAudit({
      organizationId: orgId,
      actorUserId: admin.userId,
      action: `update.org_status`,
      entityType: "organization",
      entityId: orgId,
      metadata: {
        orgName: org?.name,
        oldStatus: org?.status,
        newStatus: status,
      },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-org-status");
  }
}

/**
 * POST /api/super-admin/delete-organization
 * Body: { orgId }
 */
export async function handleSuperAdminDeleteOrganization(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { orgId } = req.body;
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }
    const serviceClient = getServiceClient();

    // Get org info before deletion for audit
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name, status")
      .eq("id", orgId)
      .single();

    // Count related data for audit metadata
    const { count: memberCount } = await serviceClient
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    const { count: taskCount } = await serviceClient
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    const { count: areaCount } = await serviceClient
      .from("areas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);

    // Delete related data first
    await serviceClient.from("tasks").delete().eq("organization_id", orgId);
    await serviceClient.from("areas").delete().eq("organization_id", orgId);
    await serviceClient.from("organization_members").delete().eq("organization_id", orgId);
    await serviceClient.from("subscriptions").delete().eq("organization_id", orgId);

    const { error } = await serviceClient
      .from("organizations")
      .delete()
      .eq("id", orgId);
    if (error) throw error;

    // Log audit AFTER deletion (org_id won't have FK, but that's fine for history)
    // We use null for organization_id since the org no longer exists
    await logAudit({
      organizationId: null,
      actorUserId: admin.userId,
      action: "delete.organization",
      entityType: "organization",
      entityId: orgId,
      metadata: {
        orgName: org?.name,
        deletedMembers: memberCount || 0,
        deletedTasks: taskCount || 0,
        deletedAreas: areaCount || 0,
      },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-organization");
  }
}

/**
 * POST /api/super-admin/update-org-plan
 * Body: { orgId, plan }
 */
export async function handleSuperAdminUpdateOrgPlan(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { orgId, plan } = req.body;
    if (!orgId || !plan) {
      return res.status(400).json({ error: "orgId and plan are required" });
    }
    const serviceClient = getServiceClient();

    // Get current plan for audit
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("plan")
      .eq("organization_id", orgId)
      .single();

    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const { error } = await serviceClient
      .from("subscriptions")
      .update({ plan })
      .eq("organization_id", orgId);
    if (error) throw error;

    await logAudit({
      organizationId: orgId,
      actorUserId: admin.userId,
      action: "update.org_plan",
      entityType: "subscription",
      entityId: orgId,
      metadata: {
        orgName: org?.name,
        oldPlan: sub?.plan,
        newPlan: plan,
      },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-org-plan");
  }
}

// ─── Feedback endpoints ─────────────────────────────────────────────────────

/**
 * POST /api/super-admin/update-feedback
 * Body: { feedbackId, readAt?, resolvedAt?, internalNotes? }
 */
export async function handleSuperAdminUpdateFeedback(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { feedbackId, readAt, resolvedAt, internalNotes } = req.body;
    if (!feedbackId) {
      return res.status(400).json({ error: "feedbackId is required" });
    }
    const updates: Record<string, any> = {};
    if (readAt !== undefined) updates.read_at = readAt;
    if (resolvedAt !== undefined) updates.resolved_at = resolvedAt;
    if (internalNotes !== undefined) updates.internal_notes = internalNotes;

    const serviceClient = getServiceClient();

    // Get feedback info for audit
    const { data: feedback } = await serviceClient
      .from("user_feedback")
      .select("organization_id, type")
      .eq("id", feedbackId)
      .single();

    const { error } = await serviceClient
      .from("user_feedback")
      .update(updates)
      .eq("id", feedbackId);
    if (error) throw error;

    await logAudit({
      organizationId: feedback?.organization_id,
      actorUserId: admin.userId,
      action: "update.feedback",
      entityType: "user_feedback",
      entityId: feedbackId,
      metadata: { updatedFields: Object.keys(updates), feedbackType: feedback?.type },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "update-feedback");
  }
}

/**
 * POST /api/super-admin/delete-feedback
 * Body: { feedbackId }
 */
export async function handleSuperAdminDeleteFeedback(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { feedbackId } = req.body;
    if (!feedbackId) {
      return res.status(400).json({ error: "feedbackId is required" });
    }
    const serviceClient = getServiceClient();

    // Get feedback info before deletion for audit
    const { data: feedback } = await serviceClient
      .from("user_feedback")
      .select("organization_id, type, content")
      .eq("id", feedbackId)
      .single();

    const { error } = await serviceClient
      .from("user_feedback")
      .delete()
      .eq("id", feedbackId);
    if (error) throw error;

    await logAudit({
      organizationId: feedback?.organization_id,
      actorUserId: admin.userId,
      action: "delete.feedback",
      entityType: "user_feedback",
      entityId: feedbackId,
      metadata: { feedbackType: feedback?.type },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-feedback");
  }
}

// ─── Data management endpoints ──────────────────────────────────────────────

/**
 * POST /api/super-admin/delete-task
 * Body: { taskId }
 */
export async function handleSuperAdminDeleteTask(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }
    const serviceClient = getServiceClient();

    // Get task info before deletion for audit
    const { data: task } = await serviceClient
      .from("tasks")
      .select("organization_id, title")
      .eq("id", taskId)
      .single();

    const { error } = await serviceClient
      .from("tasks")
      .delete()
      .eq("id", taskId);
    if (error) throw error;

    await logAudit({
      organizationId: task?.organization_id,
      actorUserId: admin.userId,
      action: "delete.task",
      entityType: "task",
      entityId: taskId,
      metadata: { taskTitle: task?.title },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-task");
  }
}

/**
 * POST /api/super-admin/delete-area
 * Body: { areaId }
 */
export async function handleSuperAdminDeleteArea(req: Request, res: Response) {
  try {
    const admin = await authenticateAsSuperAdmin(req.headers.authorization);
    const { areaId } = req.body;
    if (!areaId) {
      return res.status(400).json({ error: "areaId is required" });
    }
    const serviceClient = getServiceClient();

    // Get area info before deletion for audit
    const { data: area } = await serviceClient
      .from("areas")
      .select("organization_id, name")
      .eq("id", areaId)
      .single();

    const { error } = await serviceClient
      .from("areas")
      .delete()
      .eq("id", areaId);
    if (error) throw error;

    await logAudit({
      organizationId: area?.organization_id,
      actorUserId: admin.userId,
      action: "delete.area",
      entityType: "area",
      entityId: areaId,
      metadata: { areaName: area?.name },
    }, req);

    return res.json({ data: { success: true }, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-area");
  }
}

// ─── Query endpoints ────────────────────────────────────────────────────────

/**
 * POST /api/super-admin/get-user-memberships
 * Body: { userId }
 */
export async function handleSuperAdminGetUserMemberships(req: Request, res: Response) {
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

/**
 * POST /api/super-admin/get-user-detail
 * Body: { userId }
 * Returns: profile, email, memberships with org info, user_permissions per org, recent audit_logs
 */
export async function handleSuperAdminGetUserDetail(req: Request, res: Response) {
  try {
    await authenticateAsSuperAdmin(req.headers.authorization);
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const serviceClient = getServiceClient();

    // 1. Get profile
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, name, avatar_url, role, theme_pref, organization_id, created_at")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;

    // 2. Get email from auth.admin
    let email: string | null = null;
    try {
      const { data: authUser } = await serviceClient.auth.admin.getUserById(userId);
      email = authUser?.user?.email || null;
    } catch {
      // If auth admin fails, email stays null
    }

    // 3. Get memberships with org info
    const { data: memberships, error: membershipsError } = await serviceClient
      .from("organization_members")
      .select("id, organization_id, role, status, created_at, updated_at, organization:organizations!organization_members_organization_id_fkey(id, name, status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (membershipsError) throw membershipsError;

    // 4. Get user_permissions (custom overrides) per org
    const { data: userPermissions, error: permError } = await serviceClient
      .from("user_permissions")
      .select("id, organization_id, permission_key, enabled, created_at")
      .eq("user_id", userId)
      .order("organization_id", { ascending: true });
    if (permError) throw permError;

    // 5. Get role_permissions for each role the user has (to show effective permissions)
    const uniqueRoles = Array.from(new Set((memberships || []).map((m: any) => m.role)));
    const rolePermissionsMap: Record<string, any[]> = {};
    for (const role of uniqueRoles) {
      const { data: rolePerms } = await serviceClient
        .from("role_permissions")
        .select("permission_key, enabled")
        .eq("role", role);
      rolePermissionsMap[role] = rolePerms || [];
    }

    // 6. Get recent audit_logs for this user (as actor)
    const { data: recentActivity, error: activityError } = await serviceClient
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_role, created_at, organization_id, metadata_json, organization:organizations!audit_logs_organization_id_fkey(name)")
      .eq("actor_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (activityError) throw activityError;

    return res.json({
      data: {
        profile: { ...profile, email },
        memberships: memberships || [],
        userPermissions: userPermissions || [],
        rolePermissions: rolePermissionsMap,
        recentActivity: recentActivity || [],
      },
      error: null,
    });
  } catch (err: any) {
    return handleError(res, err, "get-user-detail");
  }
}


// ─── Reset User Password ───────────────────────────────────────────────────
export async function handleSuperAdminResetPassword(req: Request, res: Response) {
  try {
    const { userId, email } = await authenticateAsSuperAdmin(req.headers.authorization);
    const { userId: targetUserId, newPassword } = req.body;

    if (!targetUserId || !newPassword) {
      return res.status(400).json({ error: "userId and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const serviceClient = getServiceClient();

    // Update the user's password via admin API
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );
    if (updateError) throw updateError;

    // Get target user info for audit log
    const { data: targetProfile } = await serviceClient
      .from("profiles")
      .select("name, email")
      .eq("id", targetUserId)
      .single();

    // Log the action
    await serviceClient.from("audit_logs").insert({
      action: "reset_password",
      entity_type: "user",
      entity_id: targetUserId,
      actor_user_id: userId,
      actor_role: "super_admin",
      metadata_json: JSON.stringify({
        target_email: targetProfile?.email || "unknown",
        target_name: targetProfile?.name || "unknown",
      }),
    });

    return res.json({ success: true, error: null });
  } catch (err: any) {
    return handleError(res, err, "reset-password");
  }
}

// ─── Create User ───────────────────────────────────────────────────────────
export async function handleSuperAdminCreateUser(req: Request, res: Response) {
  try {
    const { userId, email: adminEmail } = await authenticateAsSuperAdmin(req.headers.authorization);
    const { email, password, name, organizationId, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const serviceClient = getServiceClient();

    // 1. Create the auth user
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });
    if (authError) throw authError;

    const newUserId = authData.user.id;

    // 2. Create the profile
    await serviceClient.from("profiles").upsert({
      id: newUserId,
      email,
      name: name || email.split("@")[0],
      role: "member",
      organization_id: organizationId && organizationId !== "none" ? organizationId : null,
    });

    // 3. If organization specified, add as member
    if (organizationId && organizationId !== "none") {
      await serviceClient.from("organization_members").insert({
        user_id: newUserId,
        organization_id: organizationId,
        role: role || "member",
        status: "active",
      });
    }

    // 4. Audit log
    await serviceClient.from("audit_logs").insert({
      action: "create_user",
      entity_type: "user",
      entity_id: newUserId,
      actor_user_id: userId,
      actor_role: "super_admin",
      metadata_json: JSON.stringify({
        new_user_email: email,
        new_user_name: name || email.split("@")[0],
        organization_id: organizationId || null,
      }),
    });

    return res.json({ success: true, userId: newUserId, error: null });
  } catch (err: any) {
    return handleError(res, err, "create-user");
  }
}

// ─── Delete User ───────────────────────────────────────────────────────────
export async function handleSuperAdminDeleteUser(req: Request, res: Response) {
  try {
    const { userId, email: adminEmail } = await authenticateAsSuperAdmin(req.headers.authorization);
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Prevent self-deletion
    if (targetUserId === userId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const serviceClient = getServiceClient();

    // Get target user info before deletion for audit
    const { data: targetProfile } = await serviceClient
      .from("profiles")
      .select("name, email")
      .eq("id", targetUserId)
      .single();

    // 1. Remove from all organizations
    await serviceClient
      .from("organization_members")
      .delete()
      .eq("user_id", targetUserId);

    // 2. Remove custom permissions
    await serviceClient
      .from("user_permissions")
      .delete()
      .eq("user_id", targetUserId);

    // 3. Delete profile
    await serviceClient
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    // 4. Delete auth user
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) throw deleteAuthError;

    // 5. Audit log
    await serviceClient.from("audit_logs").insert({
      action: "delete_user",
      entity_type: "user",
      entity_id: targetUserId,
      actor_user_id: userId,
      actor_role: "super_admin",
      metadata_json: JSON.stringify({
        deleted_email: targetProfile?.email || "unknown",
        deleted_name: targetProfile?.name || "unknown",
      }),
    });

    return res.json({ success: true, error: null });
  } catch (err: any) {
    return handleError(res, err, "delete-user");
  }
}
