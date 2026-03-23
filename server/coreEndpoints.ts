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
import { checkUserPermission } from "./permissionHelper";

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

    // Check permission to create areas (respects role + custom role + user overrides)
    const { allowed: canCreate, memberStatus } = await checkUserPermission(
      serviceClient, organizationId, userId, "areas.create"
    );
    if (!memberStatus || memberStatus !== "active") {
      return res.status(403).json({ error: "Not an active member", code: "42501" });
    }
    if (!canCreate) {
      return res.status(403).json({ error: "No permission to create areas", code: "42501" });
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

    // Check permission to create tasks (respects role + custom role + user overrides)
    const { allowed: canCreate } = await checkUserPermission(
      serviceClient, organizationId, userId, "tasks.create"
    );
    if (!canCreate) {
      return res.status(403).json({ error: "No permission to create tasks", code: "42501" });
    }

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
    const isCustomRole = role.startsWith("custom:") || !["owner", "admin", "manager", "member", "read_only"].includes(role);

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

    // Custom role: resolve permissions from custom_roles table
    if (isCustomRole) {
      const customRoleId = role.startsWith("custom:") ? role.replace("custom:", "") : role;
      
      // Try to find the custom role by ID or by name
      let customRoleData: any = null;
      
      const { data: byId } = await serviceClient
        .from("custom_roles")
        .select("permissions_json")
        .eq("organization_id", p_organization_id)
        .eq("id", customRoleId)
        .single();
      
      if (byId) {
        customRoleData = byId;
      } else {
        // Fallback: try matching by name (case-insensitive)
        const { data: byName } = await serviceClient
          .from("custom_roles")
          .select("permissions_json")
          .eq("organization_id", p_organization_id)
          .ilike("name", customRoleId)
          .single();
        
        if (byName) {
          customRoleData = byName;
        }
      }
      
      if (customRoleData?.permissions_json) {
        const pj = customRoleData.permissions_json as Record<string, any>;
        // Flatten nested permissions_json to flat permission keys
        // Same mapping as MemberPermissionsEditor.mapCustomRoleToFlatPermissions
        const flatMap: Record<string, boolean> = {};
        // Tasks
        flatMap["tasks.view"] = pj?.tasks?.view ?? false;
        flatMap["tasks.create"] = pj?.tasks?.create ?? false;
        flatMap["tasks.update"] = pj?.tasks?.update ?? false;
        flatMap["tasks.delete"] = pj?.tasks?.delete ?? false;
        flatMap["tasks.assign"] = pj?.tasks?.update ?? false;
        flatMap["tasks.change_status"] = pj?.tasks?.change_status ?? pj?.tasks?.update ?? false;
        flatMap["tasks.manage_columns"] = pj?.tasks?.manage_columns ?? pj?.tasks?.delete ?? false;
        // Areas
        flatMap["areas.view"] = pj?.areas?.view ?? false;
        flatMap["areas.create"] = pj?.areas?.manage ?? false;
        flatMap["areas.update"] = pj?.areas?.manage ?? false;
        flatMap["areas.delete"] = pj?.areas?.manage ?? false;
        flatMap["areas.manage_visibility"] = pj?.areas?.manage ?? false;
        flatMap["areas.manage_access_rules"] = pj?.areas?.manage_access_rules ?? pj?.areas?.manage ?? false;
        // Tags
        flatMap["tags.view"] = pj?.tags?.view ?? false;
        flatMap["tags.create"] = pj?.tags?.create ?? false;
        flatMap["tags.update"] = pj?.tags?.manage ?? false;
        flatMap["tags.delete"] = pj?.tags?.manage ?? false;
        flatMap["tags.manage"] = pj?.tags?.manage ?? false;
        // Templates
        flatMap["templates.view"] = pj?.templates?.view ?? pj?.templates?.read ?? false;
        flatMap["templates.apply"] = pj?.templates?.read ?? false;
        flatMap["templates.create"] = pj?.templates?.manage ?? false;
        flatMap["templates.delete"] = pj?.templates?.manage ?? false;
        // Teams
        flatMap["teams.view"] = pj?.team?.read ?? false;
        // Automations
        flatMap["automations.view"] = pj?.automations?.view ?? pj?.automations?.read ?? false;
        flatMap["automations.create"] = pj?.automations?.manage ?? false;
        flatMap["automations.manage"] = pj?.automations?.manage ?? false;
        // Reports
        flatMap["reports.view"] = pj?.reports?.view ?? false;
        flatMap["reports.export"] = pj?.reports?.export ?? pj?.reports?.view ?? false;
        flatMap["reports.view_financial"] = pj?.reports?.view_financial ?? pj?.reports?.view ?? false;
        // Billing
        flatMap["billing.view"] = pj?.billing?.view ?? pj?.billing?.read ?? false;
        flatMap["billing.manage"] = pj?.billing?.manage ?? false;
        // Members
        flatMap["members.view"] = pj?.team?.read ?? false;
        flatMap["members.invite"] = pj?.team?.manage ?? false;
        flatMap["members.change_role"] = pj?.team?.manage ?? false;
        flatMap["members.manage_permissions"] = pj?.team?.manage ?? false;
        flatMap["members.suspend"] = pj?.team?.suspend ?? pj?.team?.manage ?? false;
        // Security
        flatMap["security.view_audit_logs"] = pj?.audit_logs?.read ?? false;
        flatMap["integrations.manage_api_keys"] = pj?.integrations?.manage ?? false;
        // Reservations
        flatMap["reservations.view"] = pj?.reservations?.view ?? false;
        flatMap["reservations.create"] = pj?.reservations?.create ?? false;
        flatMap["reservations.manage"] = pj?.reservations?.manage ?? false;
        // Garatech
        flatMap["garatech.view"] = pj?.garatech?.view ?? false;
        flatMap["garatech.create"] = pj?.garatech?.create ?? pj?.garatech?.manage ?? false;
        flatMap["garatech.update"] = pj?.garatech?.update ?? pj?.garatech?.manage ?? false;
        flatMap["garatech.change_status"] = pj?.garatech?.change_status ?? pj?.garatech?.manage ?? false;
        flatMap["garatech.edit_dates"] = pj?.garatech?.edit_dates ?? false;
        flatMap["garatech.manage_catalog"] = pj?.garatech?.manage_catalog ?? pj?.garatech?.manage ?? false;
        flatMap["garatech.manage_accidents"] = pj?.garatech?.manage_accidents ?? pj?.garatech?.manage ?? false;
        flatMap["garatech.manage"] = pj?.garatech?.manage ?? false;
        // Transfers
        flatMap["transfers.view"] = pj?.transfers?.view ?? false;
        flatMap["transfers.create"] = pj?.transfers?.create ?? pj?.transfers?.manage ?? false;
        flatMap["transfers.update"] = pj?.transfers?.update ?? pj?.transfers?.manage ?? false;
        flatMap["transfers.change_status"] = pj?.transfers?.change_status ?? pj?.transfers?.manage ?? false;
        flatMap["transfers.delete"] = pj?.transfers?.delete ?? false;
        flatMap["transfers.manage_pricing"] = pj?.transfers?.manage_pricing ?? pj?.transfers?.manage ?? false;
        flatMap["transfers.manage_brokers"] = pj?.transfers?.manage_brokers ?? pj?.transfers?.manage ?? false;
        flatMap["transfers.manage"] = pj?.transfers?.manage ?? false;
        // Forms
        flatMap["forms.view"] = pj?.forms?.view ?? false;
        flatMap["forms.create"] = pj?.forms?.create ?? false;
        flatMap["forms.update"] = pj?.forms?.update ?? pj?.forms?.manage ?? false;
        flatMap["forms.delete"] = pj?.forms?.delete ?? pj?.forms?.manage ?? false;
        flatMap["forms.view_responses"] = pj?.forms?.view_responses ?? pj?.forms?.view ?? false;
        flatMap["forms.manage"] = pj?.forms?.manage ?? false;
        // Vehicles
        flatMap["vehicles.view"] = pj?.vehicles?.view ?? false;
        flatMap["vehicles.create"] = pj?.vehicles?.create ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.update"] = pj?.vehicles?.update ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.archive"] = pj?.vehicles?.archive ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.manage_daily_tasks"] = pj?.vehicles?.manage_daily_tasks ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.change_status"] = pj?.vehicles?.change_status ?? false;
        flatMap["vehicles.complete_tasks"] = pj?.vehicles?.complete_tasks ?? false;
        flatMap["vehicles.manage_locations"] = pj?.vehicles?.manage_locations ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.sync"] = pj?.vehicles?.sync ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.import"] = pj?.vehicles?.import ?? pj?.vehicles?.manage ?? false;
        flatMap["vehicles.manage"] = pj?.vehicles?.manage ?? false;
        // Time Tracking
        flatMap["time_tracking.view"] = pj?.time_tracking?.view ?? false;
        flatMap["time_tracking.view_team"] = pj?.time_tracking?.view_team ?? pj?.time_tracking?.manage ?? false;
        flatMap["time_tracking.create"] = pj?.time_tracking?.create ?? pj?.time_tracking?.view ?? false;
        flatMap["time_tracking.manage"] = pj?.time_tracking?.manage ?? false;
        // Movements
        flatMap["movements.view"] = pj?.movements?.view ?? false;
        flatMap["movements.create"] = pj?.movements?.create ?? false;
        flatMap["movements.manage"] = pj?.movements?.manage ?? false;
        flatMap["movements.delete"] = pj?.movements?.delete ?? pj?.movements?.manage ?? false;
        flatMap["movements.edit_photos"] = pj?.movements?.edit_photos ?? pj?.movements?.manage ?? false;
        flatMap["movements.upload_receipt"] = pj?.movements?.upload_receipt ?? pj?.movements?.manage ?? false;
        // Daily Tasks
        flatMap["daily_tasks.view"] = pj?.daily_tasks?.view ?? false;
        flatMap["daily_tasks.view_other_days"] = pj?.daily_tasks?.view_other_days ?? pj?.daily_tasks?.manage ?? false;
        flatMap["daily_tasks.complete"] = pj?.daily_tasks?.complete ?? false;
        flatMap["daily_tasks.manage"] = pj?.daily_tasks?.manage ?? false;
        // Fleet
        flatMap["fleet.view"] = pj?.fleet?.view ?? false;
        flatMap["fleet.manage"] = pj?.fleet?.manage ?? false;
        flatMap["fleet.import"] = pj?.fleet?.import ?? pj?.fleet?.manage ?? false;
        
        // Apply custom role permissions (override base view permissions where custom role explicitly sets them)
        for (const [key, value] of Object.entries(flatMap)) {
          if (value) {
            permissions[key] = true;
          }
        }
      }
    }

    // Check for user-specific permission overrides (ALWAYS applied last - highest priority)
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
