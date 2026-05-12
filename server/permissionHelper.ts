/**
 * Reusable permission resolution helper for server endpoints.
 *
 * Resolution order (aligned with handleGetMyPermissions):
 *   1. Base view permissions (granted to ALL active members)
 *   2. System role defaults (admin/manager/member specific permissions)
 *   3. role_permissions table entries (can override defaults with enabled=true/false)
 *   4. Custom role: flatten permissions_json from custom_roles table
 *   5. user_permissions overrides (HIGHEST PRIORITY — always wins)
 *
 * Usage:
 *   const allowed = await checkUserPermission(serviceClient, orgId, userId, "tasks.create");
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDefaultPermissionsForRole,
  flattenCustomRolePermissions,
  BASE_VIEW_PERMISSIONS,
} from "../shared/permissionDefaults";

const SYSTEM_ROLES = ["owner", "admin", "manager", "member", "read_only"];

/**
 * Check if a user has a specific permission, respecting the full resolution chain.
 * Returns { allowed: boolean, role: string | null, memberStatus: string | null }
 */
export async function checkUserPermission(
  serviceClient: SupabaseClient,
  organizationId: string,
  userId: string,
  permissionKey: string
): Promise<{ allowed: boolean; role: string | null; memberStatus: string | null }> {
  // 1. Get member record
  const { data: member } = await serviceClient
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single();

  if (!member || member.status !== "active") {
    return { allowed: false, role: member?.role ?? null, memberStatus: member?.status ?? null };
  }

  const role = member.role;

  // 2. Owner always has all permissions
  if (role === "owner") {
    return { allowed: true, role, memberStatus: "active" };
  }

  // 3. Determine if this is a custom role
  const isCustomRole = role.startsWith("custom:") || !SYSTEM_ROLES.includes(role);

  let allowed = false;

  if (isCustomRole) {
    // ─── Custom Role Resolution ─────────────────────────────────────────────
    // For custom roles, resolve from custom_roles.permissions_json
    const customRoleId = role.startsWith("custom:") ? role.replace("custom:", "") : role;

    // Try by ID first, then by name
    let customRoleData: any = null;
    const { data: byId } = await serviceClient
      .from("custom_roles")
      .select("permissions_json")
      .eq("id", customRoleId)
      .eq("organization_id", organizationId)
      .single();

    if (byId) {
      customRoleData = byId;
    } else {
      const { data: byName } = await serviceClient
        .from("custom_roles")
        .select("permissions_json")
        .eq("organization_id", organizationId)
        .ilike("name", customRoleId)
        .single();
      if (byName) customRoleData = byName;
    }

    if (customRoleData?.permissions_json) {
      const flatMap = flattenCustomRolePermissions(customRoleData.permissions_json);
      allowed = flatMap[permissionKey] === true;
    }
  } else {
    // ─── System Role Resolution ─────────────────────────────────────────────
    // Start with the computed defaults for this role (base view + role-specific)
    const roleDefaults = getDefaultPermissionsForRole(role);
    allowed = roleDefaults[permissionKey] ?? false;

    // Check role_permissions table for overrides
    // The table stores explicit enabled/disabled per role+permission_key
    const { data: rolePerm } = await serviceClient
      .from("role_permissions")
      .select("enabled")
      .eq("role", role)
      .eq("permission_key", permissionKey)
      .single();

    if (rolePerm !== null && rolePerm !== undefined) {
      // role_permissions table explicitly sets this permission
      allowed = rolePerm.enabled;
    }
  }

  // 6. User-specific overrides (HIGHEST PRIORITY — always wins)
  const { data: userOverride } = await serviceClient
    .from("user_permissions")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("permission_key", permissionKey)
    .single();

  if (userOverride !== null && userOverride !== undefined) {
    allowed = userOverride.enabled;
  }

  return { allowed, role, memberStatus: "active" };
}

/**
 * Require a specific permission for the authenticated user.
 * Throws an error with status 403 if the user doesn't have the permission.
 * Returns the user's role and member status for further use.
 */
export async function requirePermission(
  serviceClient: SupabaseClient,
  organizationId: string,
  userId: string,
  permissionKey: string
): Promise<{ role: string }> {
  const { allowed, role, memberStatus } = await checkUserPermission(
    serviceClient,
    organizationId,
    userId,
    permissionKey
  );

  if (!allowed) {
    const error: any = new Error(
      `Permission denied: ${permissionKey} (role: ${role}, status: ${memberStatus})`
    );
    error.status = 403;
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  return { role: role! };
}
