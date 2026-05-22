/**
 * Organization Data Express endpoints.
 * These replace direct Supabase frontend queries that fail due to RLS policies.
 * All queries use serviceClient (service role key) to bypass RLS.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { requirePermission } from "./permissionHelper";

// ─── 1. get-org-modules ──────────────────────────────────────────────────────
// Returns organization_modules for the authenticated user's org
export async function handleGetOrgModules(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!orgId) {
      return res.json({ data: [], error: null });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("organization_modules")
      .select("module_key, enabled")
      .eq("organization_id", orgId);

    if (error) {
      console.error("[getOrgModules] Query error:", error);
      return res.json({ data: [], error: error.message });
    }

    return res.json({ data: data || [], error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getOrgModules] Error:", err);
    return res.json({ data: [], error: "Internal server error" });
  }
}

// ─── 2. get-org-custom-roles ─────────────────────────────────────────────────
// Returns custom_roles for the specified organization
export async function handleGetOrgCustomRoles(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!orgId) {
      return res.json({ data: [], error: null });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("custom_roles")
      .select("*")
      .eq("organization_id", orgId)
      .order("is_system", { ascending: false })
      .order("name");

    if (error) {
      console.error("[getOrgCustomRoles] Query error:", error);
      return res.json({ data: [], error: error.message });
    }

    return res.json({ data: data || [], error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getOrgCustomRoles] Error:", err);
    return res.json({ data: [], error: "Internal server error" });
  }
}

// ─── 3. get-role-permissions ────────────────────────────────────────────────
// Returns role_permissions (global table, not org-scoped)
export async function handleGetRolePermissions(req: Request, res: Response) {
  try {
    await authenticateSupabaseRequest(req.headers.authorization);

    const serviceClient = getServiceClient();

    // role_permissions table is global (no organization_id column)
    const { data, error } = await serviceClient
      .from("role_permissions")
      .select("*")
      .order("role", { ascending: true });

    if (error) {
      console.error("[getRolePermissions] Query error:", error);
      return res.json({ data: [], error: error.message });
    }

    return res.json({ data: data || [], error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getRolePermissions] Error:", err);
    return res.json({ data: [], error: "Internal server error" });
  }
}

// ─── 4. get-user-permission-overrides ────────────────────────────────────────
// Returns user_permissions overrides for a specific user or all users in an organization
export async function handleGetUserPermissionOverrides(req: Request, res: Response) {
  try {
    await authenticateSupabaseRequest(req.headers.authorization);
    const { p_organization_id, p_user_id } = req.body;

    if (!p_organization_id) {
      return res.json({ data: [], error: null });
    }

    const serviceClient = getServiceClient();

    let query = serviceClient
      .from("user_permissions")
      .select("*")
      .eq("organization_id", p_organization_id);

    // If p_user_id is provided, filter by user; otherwise return all org overrides
    if (p_user_id) {
      query = query.eq("user_id", p_user_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getUserPermissionOverrides] Query error:", error);
      return res.json({ data: [], error: error.message });
    }

    return res.json({ data: data || [], error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getUserPermissionOverrides] Error:", err);
    return res.json({ data: [], error: "Internal server error" });
  }
}

// ─── 5. set-user-permission-override ─────────────────────────────────────────
// Upsert a user permission override
export async function handleSetUserPermissionOverride(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_organization_id, p_user_id, p_permission_key, p_enabled } = req.body;

    if (!p_organization_id || !p_user_id || !p_permission_key || p_enabled === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.manage_permissions
    await requirePermission(serviceClient, p_organization_id, userId, "members.manage_permissions");

    const { error } = await serviceClient
      .from("user_permissions")
      .upsert({
        organization_id: p_organization_id,
        user_id: p_user_id,
        permission_key: p_permission_key,
        enabled: p_enabled,
        created_by: userId,
      }, {
        onConflict: "organization_id,user_id,permission_key",
      });

    if (error) {
      console.error("[setUserPermissionOverride] Upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[setUserPermissionOverride] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 6. remove-user-permission-override ──────────────────────────────────────
// Delete a specific user permission override
export async function handleRemoveUserPermissionOverride(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_organization_id, p_user_id, p_permission_key } = req.body;

    if (!p_organization_id || !p_user_id || !p_permission_key) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.manage_permissions
    await requirePermission(serviceClient, p_organization_id, userId, "members.manage_permissions");

    const { error } = await serviceClient
      .from("user_permissions")
      .delete()
      .eq("organization_id", p_organization_id)
      .eq("user_id", p_user_id)
      .eq("permission_key", p_permission_key);

    if (error) {
      console.error("[removeUserPermissionOverride] Delete error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[removeUserPermissionOverride] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 7. reset-user-permission-overrides ──────────────────────────────────────
// Delete ALL user permission overrides for a user in an organization
export async function handleResetUserPermissionOverrides(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_organization_id, p_user_id } = req.body;

    if (!p_organization_id || !p_user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.manage_permissions
    await requirePermission(serviceClient, p_organization_id, userId, "members.manage_permissions");

    const { error } = await serviceClient
      .from("user_permissions")
      .delete()
      .eq("organization_id", p_organization_id)
      .eq("user_id", p_user_id);

    if (error) {
      console.error("[resetUserPermissionOverrides] Delete error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[resetUserPermissionOverrides] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 8. get-org-members ──────────────────────────────────────────────────────
// Returns organization members with profile data
export async function handleGetOrgMembers(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!orgId) {
      return res.json({ data: [], error: null });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("organization_members")
      .select(`
        *,
        profile:profiles!organization_members_user_id_fkey(id, name)
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getOrgMembers] Query error:", error);
      return res.json({ data: [], error: error.message });
    }

    // Flatten profile data
    const members = (data || []).map((m: any) => {
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return {
        ...m,
        name: profile?.name || null,
        profile,
      };
    });

    return res.json({ data: members, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getOrgMembers] Error:", err);
    return res.json({ data: [], error: "Internal server error" });
  }
}

// ─── 9. update-member-role ───────────────────────────────────────────
export async function handleUpdateMemberRole(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_member_id, p_role, p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!p_member_id || !p_role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.change_role
    await requirePermission(serviceClient, orgId, userId, "members.change_role");

    // Resolve custom:uuid to the custom role name for cleaner storage
    let resolvedRole = p_role;
    if (p_role.startsWith("custom:")) {
      const customRoleId = p_role.replace("custom:", "");
      const { data: customRole } = await serviceClient
        .from("custom_roles")
        .select("name")
        .eq("id", customRoleId)
        .eq("organization_id", orgId)
        .single();
      if (customRole) {
        resolvedRole = customRole.name;
      }
    }

    const { error } = await serviceClient
      .from("organization_members")
      .update({ role: resolvedRole })
      .eq("id", p_member_id);

    if (error) {
      console.error("[updateMemberRole] Update error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[updateMemberRole] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 10. update-member-status ────────────────────────────────────────
export async function handleUpdateMemberStatus(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_member_id, p_status, p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!p_member_id || !p_status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.suspend
    await requirePermission(serviceClient, orgId, userId, "members.suspend");

    const { error } = await serviceClient
      .from("organization_members")
      .update({ status: p_status })
      .eq("id", p_member_id);

    if (error) {
      console.error("[updateMemberStatus] Update error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[updateMemberStatus] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 11. remove-member ─────────────────────────────────────────────
export async function handleRemoveMember(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_member_id, p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!p_member_id) {
      return res.status(400).json({ error: "Missing member ID" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.suspend (remove is a stronger action)
    await requirePermission(serviceClient, orgId, userId, "members.suspend");

    const { error } = await serviceClient
      .from("organization_members")
      .delete()
      .eq("id", p_member_id);

    if (error) {
      console.error("[removeMember] Delete error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[removeMember] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 12. manage-custom-role (create/update/delete) ───────────────────
export async function handleManageCustomRole(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { action, p_organization_id, p_role_id, p_name, p_description, p_permissions_json } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing action" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.manage_permissions to manage custom roles
    if (p_organization_id) {
      await requirePermission(serviceClient, p_organization_id, userId, "members.manage_permissions");
    }

    if (action === "create") {
      if (!p_organization_id || !p_name) {
        return res.status(400).json({ error: "Missing required fields for create" });
      }

      const { error } = await serviceClient.from("custom_roles").insert({
        organization_id: p_organization_id,
        name: p_name,
        description: p_description || null,
        permissions_json: p_permissions_json || {},
        is_system: false,
      });

      if (error) {
        console.error("[manageCustomRole] Create error:", error);
        return res.status(500).json({ error: error.message, code: error.code });
      }

      return res.json({ success: true });
    }

    if (action === "update") {
      if (!p_role_id) {
        return res.status(400).json({ error: "Missing role ID for update" });
      }

      const updates: any = {};
      if (p_name !== undefined) updates.name = p_name;
      if (p_description !== undefined) updates.description = p_description;
      if (p_permissions_json !== undefined) updates.permissions_json = p_permissions_json;

      const { error } = await serviceClient
        .from("custom_roles")
        .update(updates)
        .eq("id", p_role_id);

      if (error) {
        console.error("[manageCustomRole] Update error:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ success: true });
    }

    if (action === "delete") {
      if (!p_role_id) {
        return res.status(400).json({ error: "Missing role ID for delete" });
      }

      const { error } = await serviceClient
        .from("custom_roles")
        .delete()
        .eq("id", p_role_id);

      if (error) {
        console.error("[manageCustomRole] Delete error:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[manageCustomRole] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 13. toggle-role-permission ──────────────────────────────────────
export async function handleToggleRolePermission(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { p_role, p_permission_key, p_enabled, p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    if (!p_role || !p_permission_key || p_enabled === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const serviceClient = getServiceClient();

    // Permission check: caller must have members.manage_permissions to toggle role permissions
    await requirePermission(serviceClient, orgId, userId, "members.manage_permissions");

    // Use upsert to handle both existing and new permission keys
    const { error } = await serviceClient
      .from("role_permissions")
      .upsert(
        { role: p_role, permission_key: p_permission_key, enabled: p_enabled },
        { onConflict: "role,permission_key" }
      );

    if (error) {
      console.error("[toggleRolePermission] Update error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[toggleRolePermission] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
