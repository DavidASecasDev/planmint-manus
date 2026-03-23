/**
 * Reusable permission resolution helper for server endpoints.
 *
 * Resolution order (same as handleGetMyPermissions):
 *   1. System role defaults (owner gets all, admin gets most)
 *   2. role_permissions table entries for the member's role
 *   3. Custom role: flatten permissions_json from custom_roles table
 *   4. user_permissions overrides (HIGHEST PRIORITY — always wins)
 *
 * Usage:
 *   const allowed = await checkUserPermission(serviceClient, orgId, userId, "tasks.create");
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const SYSTEM_ROLES = ["owner", "admin", "manager", "member", "read_only"];

// Roles that get most permissions by default (before role_permissions table)
const PRIVILEGED_ROLES = ["owner", "admin", "manager"];

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

  // 3. Start with system role defaults
  let allowed = PRIVILEGED_ROLES.includes(role);

  // 4. Check role_permissions table (for system roles and custom roles)
  const isCustomRole =
    role.startsWith("custom:") || !SYSTEM_ROLES.includes(role);

  if (!allowed) {
    const { data: rolePerm } = await serviceClient
      .from("role_permissions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", role)
      .eq("permission_key", permissionKey)
      .single();

    if (rolePerm) allowed = true;
  }

  // 5. For custom roles, also check custom_roles.permissions_json
  if (isCustomRole) {
    const customRoleId = role.startsWith("custom:") ? role.replace("custom:", "") : role;
    const { data: customRole } = await serviceClient
      .from("custom_roles")
      .select("permissions_json")
      .eq("id", customRoleId)
      .eq("organization_id", organizationId)
      .single();

    if (customRole?.permissions_json) {
      const flatMap = flattenPermissionsJson(customRole.permissions_json);
      if (flatMap[permissionKey] === true) {
        allowed = true;
      } else if (flatMap[permissionKey] === false) {
        // Custom role explicitly denies this permission
        allowed = false;
      }
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
 * Flatten nested permissions_json from custom_roles into flat "module.action" keys.
 * This mirrors the frontend mapCustomRoleToFlatPermissions() logic.
 */
function flattenPermissionsJson(
  pj: Record<string, any>
): Record<string, boolean> {
  const flat: Record<string, boolean> = {};

  // Generic flattener for most modules
  const modules = [
    "tasks", "areas", "tags", "forms", "transfers", "garatech",
    "vehicles", "reservations", "time_tracking", "reports",
    "templates", "automations", "billing", "movements",
    "daily_tasks", "fleet",
  ];

  for (const mod of modules) {
    if (!pj[mod]) continue;
    for (const [action, value] of Object.entries(pj[mod])) {
      if (typeof value === "boolean") {
        flat[`${mod}.${action}`] = value;
      }
    }
  }

  // Special mappings for team → members/teams
  if (pj.team) {
    flat["teams.view"] = pj.team.read ?? false;
    flat["members.view"] = pj.team.read ?? false;
    flat["members.invite"] = pj.team.manage ?? false;
    flat["members.change_role"] = pj.team.manage ?? false;
    flat["members.manage_permissions"] = pj.team.manage ?? false;
    flat["members.suspend"] = pj.team.suspend ?? pj.team.manage ?? false;
  }

  // Security / integrations
  if (pj.audit_logs) {
    flat["security.view_audit_logs"] = pj.audit_logs.read ?? false;
  }
  if (pj.integrations) {
    flat["integrations.manage_api_keys"] = pj.integrations.manage ?? false;
  }

  return flat;
}
