# Permissions Bug Analysis: Jordan - Transfers

## Root Cause Identified

### Problem 1: Frontend uses `transfers.manage` instead of `transfers.create` for the "create" action

In `Transfers.tsx` (line 20), the "Nueva Solicitud" button is gated by:
```ts
const canManage = hasPermission('transfers.manage');
```

But it should also allow users with `transfers.create`:
```ts
const canCreate = hasPermission('transfers.create') || hasPermission('transfers.manage');
```

**Impact:** Jordan has `transfers.create` override enabled, but the button checks `transfers.manage` which he doesn't have. So he can see transfers but can't create them.

### Problem 2: Backend `handleGetMyPermissions` does NOT check custom roles

The endpoint (coreEndpoints.ts lines 367-398) fetches from `role_permissions` table:
```ts
const { data: rolePerms } = await serviceClient
  .from("role_permissions")
  .select("permission_key")
  .eq("organization_id", p_organization_id)
  .eq("role", role);
```

But if Jordan's role is stored as a custom role ID (e.g., "custom:abc123" or just the role name "Miembro"), the `role_permissions` table won't have entries for it. The endpoint then falls through to hardcoded defaults for "member" role, which don't include any transfers permissions.

**However**, the user overrides ARE correctly applied at lines 466-476:
```ts
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
```

### Problem 3: The backend doesn't resolve custom roles from `custom_roles` table

If Jordan's `organization_members.role` is a custom role (not owner/admin/manager/member/read_only), the backend doesn't look up the `custom_roles` table to get the `permissions_json` for that role. It only checks:
1. Hardcoded system role defaults (owner/admin/manager/member)
2. `role_permissions` table (which may not have entries for custom roles)
3. User overrides from `user_permissions`

The `custom_roles` table with its `permissions_json` is only used in the frontend `MemberPermissionsEditor.tsx` for display purposes.

## Fix Plan

1. **Transfers.tsx**: Change `canManage` to also check `transfers.create`
2. **Backend**: Add custom role resolution from `custom_roles` table
3. **All transfer UI gates**: Ensure `transfers.create` is checked alongside `transfers.manage` where appropriate
