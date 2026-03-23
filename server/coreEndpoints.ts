/**
 * Core Express endpoints replacing broken Supabase RPCs.
 * Batch 1: create_organization_with_owner, create_area_secure, create_task_secure, get_my_permissions
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  extractBearerToken,
  AuthError,
} from "./supabaseAdmin";

// ─── Helper: authenticate but allow users without organization ────────────────
async function authenticateUser(
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
  return {
    userId: userData.user.id,
    email: userData.user.email || "",
  };
}

// ─── 1. create_organization_with_owner ────────────────────────────────────────
export async function handleCreateOrganizationWithOwner(
  req: Request,
  res: Response
) {
  try {
    const { userId, email } = await authenticateUser(
      req.headers.authorization
    );
    const { p_name, p_vertical_preset } = req.body;

    if (!p_name || typeof p_name !== "string" || p_name.trim().length === 0) {
      return res.status(400).json({ error: "Organization name is required" });
    }

    const serviceClient = getServiceClient();

    // Check if user is super_admin
    const { data: superAdmin } = await serviceClient
      .from("super_admins")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (!superAdmin) {
      return res
        .status(403)
        .json({ error: "NOT_SUPER_ADMIN", message: "Only super admins can create organizations" });
    }

    // Check if user already has an organization
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (profile?.organization_id) {
      return res
        .status(400)
        .json({ error: "ALREADY_HAS_ORG", message: "User already belongs to an organization" });
    }

    // Create the organization
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert({
        name: p_name.trim(),
        vertical_preset: p_vertical_preset || null,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      console.error("[createOrganizationWithOwner] Org insert error:", orgError);
      return res.status(500).json({ error: "Failed to create organization" });
    }

    const orgId = org.id;

    // Update user profile with organization
    await serviceClient
      .from("profiles")
      .update({ organization_id: orgId, role: "owner" })
      .eq("id", userId);

    // Create organization_members entry
    await serviceClient.from("organization_members").upsert(
      {
        organization_id: orgId,
        user_id: userId,
        role: "owner",
        status: "active",
      },
      { onConflict: "organization_id,user_id" }
    );

    // Create default custom_roles for the organization
    const defaultRoles = [
      { name: "Admin", role_key: "admin" },
      { name: "Manager", role_key: "manager" },
      { name: "Member", role_key: "member" },
      { name: "Read Only", role_key: "read_only" },
    ];

    for (const r of defaultRoles) {
      await serviceClient.from("custom_roles").insert({
        organization_id: orgId,
        name: r.name,
        permissions: {},
      });
    }

    return res.json(orgId);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[createOrganizationWithOwner] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 2. create_area_secure ────────────────────────────────────────────────────
export async function handleCreateAreaSecure(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_name, p_description, p_color, p_icon, p_visibility } = req.body;

    if (!p_name || typeof p_name !== "string" || p_name.trim().length === 0) {
      return res.status(400).json({ error: "Area name is required" });
    }

    const serviceClient = getServiceClient();

    // Check user has permission to create areas
    const { data: member } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!member) {
      return res.status(403).json({ error: "Not an active member", code: "42501" });
    }

    // owner, admin, manager can create areas
    const canCreate = ["owner", "admin", "manager"].includes(member.role);

    // Also check role_permissions for the member's role
    if (!canCreate) {
      const { data: perm } = await serviceClient
        .from("role_permissions")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("role", member.role)
        .eq("permission_key", "areas.create")
        .single();

      if (!perm) {
        return res.status(403).json({ error: "No permission to create areas", code: "42501" });
      }
    }

    // Insert the area
    const { data: newArea, error: areaError } = await serviceClient
      .from("areas")
      .insert({
        organization_id: organizationId,
        name: p_name.trim(),
        description: p_description || null,
        color: p_color || "#6366f1",
        icon: p_icon || "folder",
        visibility: p_visibility || "org",
      })
      .select()
      .single();

    if (areaError) {
      console.error("[createAreaSecure] Insert error:", areaError);
      if (areaError.code === "23505") {
        return res.status(409).json({ error: "Duplicate area name", code: "23505" });
      }
      return res.status(500).json({ error: "Failed to create area" });
    }

    return res.json(newArea);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[createAreaSecure] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 3. create_task_secure ────────────────────────────────────────────────────
export async function handleCreateTaskSecure(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const {
      p_title,
      p_description,
      p_type,
      p_status,
      p_priority,
      p_assigned_to,
      p_due_date,
      p_goal_target_value,
      p_goal_unit,
      p_operation_type,
      p_scheduled_at,
      p_location_type,
      p_location_text,
      p_location_notes,
      p_reservation_ref,
      p_customer_name,
      p_customer_phone,
      p_vehicle_out_id,
      p_vehicle_in_id,
    } = req.body;

    if (!p_title || typeof p_title !== "string" || p_title.trim().length === 0) {
      return res.status(400).json({ error: "Task title is required" });
    }

    const serviceClient = getServiceClient();

    // Insert the task using service client (bypasses RLS)
    const { data: newTask, error: taskError } = await serviceClient
      .from("tasks")
      .insert({
        organization_id: organizationId,
        title: p_title.trim(),
        description: p_description || null,
        type: p_type || "task",
        status: p_status || "todo",
        priority: p_priority || "medium",
        assigned_to: p_assigned_to || null,
        due_date: p_due_date || null,
        created_by: userId,
        goal_target_value: p_goal_target_value || null,
        goal_unit: p_goal_unit || null,
        operation_type: p_operation_type || null,
        scheduled_at: p_scheduled_at || null,
        location_type: p_location_type || null,
        location_text: p_location_text || null,
        location_notes: p_location_notes || null,
        reservation_ref: p_reservation_ref || null,
        customer_name: p_customer_name || null,
        customer_phone: p_customer_phone || null,
        vehicle_out_id: p_vehicle_out_id || null,
        vehicle_in_id: p_vehicle_in_id || null,
      })
      .select()
      .single();

    if (taskError) {
      console.error("[createTaskSecure] Insert error:", taskError);
      return res.status(500).json({ error: "Failed to create task" });
    }

    return res.json(newTask);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[createTaskSecure] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 4. get_my_permissions ────────────────────────────────────────────────────
export async function handleGetMyPermissions(req: Request, res: Response) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const serviceClient = getServiceClient();
    const { data: userData, error: userError } =
      await serviceClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = userData.user.id;
    const { p_organization_id } = req.body;

    if (!p_organization_id) {
      return res.json({ success: false, role: null, permissions: {} });
    }

    // Get user's membership
    const { data: member } = await serviceClient
      .from("organization_members")
      .select("role, status")
      .eq("organization_id", p_organization_id)
      .eq("user_id", userId)
      .single();

    if (!member || member.status !== "active") {
      return res.json({
        success: false,
        role: null,
        status: member?.status || null,
        permissions: {},
      });
    }

    const role = member.role;

    // Owner gets all permissions
    if (role === "owner") {
      const allPermissions: Record<string, boolean> = {};
      const permissionKeys = [
        "tasks.view", "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.change_status", "tasks.manage_columns",
        "areas.view", "areas.create", "areas.update", "areas.delete", "areas.manage_visibility", "areas.manage_access_rules",
        "tags.view", "tags.create", "tags.update", "tags.delete", "tags.manage",
        "templates.view", "templates.apply", "templates.create", "templates.delete",
        "teams.view",
        "automations.view", "automations.create", "automations.manage",
        "reports.view", "reports.export", "reports.view_financial",
        "billing.view", "billing.manage",
        "members.view", "members.invite", "members.change_role", "members.manage_permissions", "members.suspend",
        "security.view_audit_logs",
        "integrations.manage_api_keys",
        "reservations.view", "reservations.create", "reservations.manage",
        "garatech.view", "garatech.create", "garatech.update", "garatech.change_status", "garatech.edit_dates", "garatech.manage_catalog", "garatech.manage_accidents", "garatech.manage",
        "transfers.view", "transfers.create", "transfers.update", "transfers.change_status", "transfers.delete", "transfers.manage_pricing", "transfers.manage_brokers", "transfers.manage",
        "forms.view", "forms.create", "forms.update", "forms.delete", "forms.view_responses", "forms.manage",
        "vehicles.view", "vehicles.create", "vehicles.update", "vehicles.archive", "vehicles.manage_daily_tasks", "vehicles.change_status", "vehicles.complete_tasks", "vehicles.manage_locations", "vehicles.sync", "vehicles.import", "vehicles.manage",
        "time_tracking.view", "time_tracking.view_team", "time_tracking.create", "time_tracking.manage",
        "movements.view", "movements.create", "movements.manage", "movements.delete", "movements.edit_photos", "movements.upload_receipt",
        "daily_tasks.view", "daily_tasks.view_other_days", "daily_tasks.complete", "daily_tasks.manage",
        "fleet.view", "fleet.manage", "fleet.import",
      ];
      for (const key of permissionKeys) {
        allPermissions[key] = true;
      }
      return res.json({
        success: true,
        role: "owner",
        status: "active",
        permissions: allPermissions,
      });
    }

    // For other roles, fetch from role_permissions table
    const { data: rolePerms } = await serviceClient
      .from("role_permissions")
      .select("permission_key")
      .eq("organization_id", p_organization_id)
      .eq("role", role);

    const permissions: Record<string, boolean> = {};

    // Base permissions for all active members
    permissions["tasks.view"] = true;
    permissions["areas.view"] = true;
    permissions["tags.view"] = true;
    permissions["templates.view"] = true;
    permissions["teams.view"] = true;
    permissions["members.view"] = true;
    permissions["reservations.view"] = true;
    permissions["vehicles.view"] = true;
    permissions["movements.view"] = true;
    permissions["daily_tasks.view"] = true;
    permissions["fleet.view"] = true;
    permissions["garatech.view"] = true;
    permissions["transfers.view"] = true;
    permissions["forms.view"] = true;
    permissions["time_tracking.view"] = true;

    // Add role-based permissions
    if (rolePerms) {
      for (const rp of rolePerms) {
        permissions[rp.permission_key] = true;
      }
    }

    // Admin gets most permissions by default
    if (role === "admin") {
      const adminDefaults = [
        "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.change_status", "tasks.manage_columns",
        "areas.create", "areas.update", "areas.delete", "areas.manage_visibility",
        "tags.create", "tags.update", "tags.delete", "tags.manage",
        "templates.apply", "templates.create", "templates.delete",
        "automations.view", "automations.create", "automations.manage",
        "reports.view", "reports.export", "reports.view_financial",
        "billing.view", "billing.manage",
        "members.invite", "members.change_role", "members.manage_permissions", "members.suspend",
        "security.view_audit_logs",
        "integrations.manage_api_keys",
        "reservations.create", "reservations.manage",
        "garatech.create", "garatech.update", "garatech.change_status", "garatech.edit_dates", "garatech.manage_catalog", "garatech.manage_accidents", "garatech.manage",
        "transfers.create", "transfers.update", "transfers.change_status", "transfers.delete", "transfers.manage_pricing", "transfers.manage_brokers", "transfers.manage",
        "forms.create", "forms.update", "forms.delete", "forms.view_responses", "forms.manage",
        "vehicles.create", "vehicles.update", "vehicles.archive", "vehicles.manage_daily_tasks", "vehicles.change_status", "vehicles.complete_tasks", "vehicles.manage_locations", "vehicles.sync", "vehicles.import", "vehicles.manage",
        "time_tracking.view_team", "time_tracking.create", "time_tracking.manage",
        "movements.create", "movements.manage", "movements.delete", "movements.edit_photos", "movements.upload_receipt",
        "daily_tasks.view_other_days", "daily_tasks.complete", "daily_tasks.manage",
        "fleet.manage", "fleet.import",
      ];
      for (const key of adminDefaults) {
        permissions[key] = true;
      }
    }

    // Manager gets operational permissions
    if (role === "manager") {
      const managerDefaults = [
        "tasks.create", "tasks.update", "tasks.assign", "tasks.change_status",
        "areas.create", "areas.update",
        "tags.create", "tags.update",
        "templates.apply",
        "automations.view",
        "reports.view",
        "reservations.create",
        "garatech.create", "garatech.update", "garatech.change_status",
        "transfers.create", "transfers.update", "transfers.change_status",
        "forms.create", "forms.update", "forms.view_responses",
        "vehicles.update", "vehicles.manage_daily_tasks", "vehicles.change_status", "vehicles.complete_tasks", "vehicles.manage_locations",
        "time_tracking.view_team", "time_tracking.create",
        "movements.create", "movements.manage", "movements.edit_photos", "movements.upload_receipt",
        "daily_tasks.view_other_days", "daily_tasks.complete", "daily_tasks.manage",
      ];
      for (const key of managerDefaults) {
        permissions[key] = true;
      }
    }

    // Member gets basic operational permissions
    if (role === "member") {
      const memberDefaults = [
        "tasks.create", "tasks.update",
        "vehicles.change_status", "vehicles.complete_tasks",
        "movements.create", "movements.upload_receipt",
        "daily_tasks.complete",
        "time_tracking.create",
      ];
      for (const key of memberDefaults) {
        permissions[key] = true;
      }
    }

    // Check for user-specific permission overrides
    const { data: overrides } = await serviceClient
      .from("user_permissions")
      .select("permission_key, enabled")
      .eq("organization_id", p_organization_id)
      .eq("user_id", userId);

    if (overrides) {
      for (const override of overrides) {
        permissions[override.permission_key] = override.enabled;
      }
    }

    return res.json({
      success: true,
      role,
      status: "active",
      permissions,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getMyPermissions] Error:", err);
    return res.json({ success: false, role: null, permissions: {} });
  }
}
