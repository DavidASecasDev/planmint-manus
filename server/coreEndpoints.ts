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
import {
  ALL_PERMISSION_KEYS,
  getDefaultPermissionsForRole,
  flattenCustomRolePermissions,
} from "../shared/permissionDefaults";

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
    // Use the cached auth helper instead of direct auth.getUser()
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const serviceClient = getServiceClient();
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

    // Owner gets all permissions (from shared defaults)
    if (role === "owner") {
      return res.json({
        success: true,
        role: "owner",
        status: "active",
        permissions: getDefaultPermissionsForRole("owner"),
      });
    }

    // For system roles, start with shared defaults (base view + role-specific)
    // Then apply role_permissions table overrides (enabled/disabled)
    const permissions: Record<string, boolean> = isCustomRole
      ? {} // Custom roles start empty, resolved below
      : { ...getDefaultPermissionsForRole(role) };

    if (!isCustomRole) {
      // Fetch role_permissions table entries (global, no org_id filter)
      const { data: rolePerms } = await serviceClient
        .from("role_permissions")
        .select("permission_key, enabled")
        .eq("role", role);

      // Apply role_permissions table overrides (these can enable OR disable)
      if (rolePerms) {
        for (const rp of rolePerms) {
          permissions[rp.permission_key] = rp.enabled;
        }
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
        // Use shared flattening function (single source of truth)
        const flatMap = flattenCustomRolePermissions(pj);
        
        // Apply custom role permissions
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
