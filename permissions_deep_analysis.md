# Deep Root Cause Analysis: Permissions System

## The REAL Problem

The permissions system has **TWO INDEPENDENT LAYERS** that BOTH must pass for a user to access a module:

### Layer 1: Module Enablement (`useOrganizationModules`)
- Reads `organization_modules` table to check if a module is enabled for the org
- DEFAULT for `reservations`: **false**
- DEFAULT for `transfers`: **false**
- If the org has NO rows in `organization_modules` for these modules, they default to **false**
- This means the sidebar HIDES these modules entirely, regardless of user permissions

### Layer 2: Granular Permissions (`usePermissions` → `get-my-permissions` endpoint)
- Reads role defaults → role_permissions → custom_roles → user_permissions overrides
- Even if a user has `transfers.view = true` or `reservations.view = true`, 
  if Layer 1 says the MODULE is disabled, the sidebar item is HIDDEN

### The Sidebar Logic (AppSidebar.tsx)
```
// Line 475: Transfers menu only shows if BOTH conditions pass:
item.url === '/vehicles' && isModuleEnabled('transfers') && hasPermission('transfers.view')

// Line 113: Reservations menu only shows if permission passes:
'/reservations': 'reservations.view'

// BUT Line 176-184: filteredMenuItems also checks isModuleEnabled:
if (moduleKey && OPTIONAL_MODULES.includes(moduleKey)) return isModuleEnabled(moduleKey);
```

So for Reservations:
1. `isModuleEnabled('reservations')` must be true (from organization_modules table)
2. `hasPermission('reservations.view')` must be true (from permissions system)

For Transfers:
1. `isModuleEnabled('transfers')` must be true (from organization_modules table)  
2. `hasPermission('transfers.view')` must be true (from permissions system)

## Why Mikaela (Manager) Can't See Reservations

Possible causes:
1. The `organization_modules` table may not have `reservations = true` for her org
2. OR the manager role doesn't have `reservations.view` in role_permissions or defaults
3. OR the `get-my-permissions` endpoint is not returning `reservations.view = true` for managers

## Why Jordan (Member + Overrides) Still Can't See Transfers

Possible causes:
1. The `organization_modules` table may not have `transfers = true` for the org
2. OR the `get-my-permissions` endpoint is not correctly resolving overrides
3. OR there's a bug in how the backend computes permissions for non-system roles

## Backend Permission Resolution Bug Analysis

Looking at `handleGetMyPermissions` in coreEndpoints.ts:

### Step 1: Get member role
```
SELECT role FROM organization_members WHERE org_id = X AND user_id = Y
```

### Step 2: System role defaults
For `manager`: PRIVILEGED_ROLES includes manager, so `allowed = true` for ALL permissions initially.
Wait... this means managers get ALL permissions by default? That seems wrong.

Actually looking more carefully at the code:
- Line ~430: `let basePermissions: Record<string, boolean> = {};`
- Line ~435: For owner: all permissions = true
- Line ~440: For admin: all permissions = true  
- Line ~445: For manager/member/read_only: `basePermissions = {};` (empty!)

Then it reads role_permissions table to add specific permissions.

So for MANAGER: base is EMPTY, then role_permissions adds what's configured.
If role_permissions has no entries for manager + reservations.view, then manager gets NO reservations.

### The permissionHelper.ts has a DIFFERENT logic:
```
let allowed = PRIVILEGED_ROLES.includes(role);  // manager → true
```
This gives managers ALL permissions by default in the helper, but the main endpoint
gives them NOTHING by default. **INCONSISTENCY!**

## Critical Finding: Backend Inconsistency

The `handleGetMyPermissions` endpoint (returns ALL permissions to frontend) and 
`checkUserPermission` helper (checks ONE permission for server endpoints) use 
**DIFFERENT default logic** for managers:

- `handleGetMyPermissions`: manager starts with EMPTY permissions, only gets what's in role_permissions
- `checkUserPermission`: manager starts with `allowed = true` (all permissions)

This means:
- Frontend shows manager has NO permissions (from handleGetMyPermissions)
- But server endpoints ALLOW manager to do everything (from checkUserPermission)

## Root Cause Summary

1. **Module enablement**: reservations/transfers may be disabled at org level
2. **Permission defaults inconsistency**: handleGetMyPermissions gives managers empty defaults,
   while checkUserPermission gives them all permissions
3. **The frontend is the bottleneck**: even if backend would allow it, the frontend hides UI elements

## Fix Required

1. Align permission defaults between handleGetMyPermissions and checkUserPermission
2. Ensure organization_modules has correct values for the org
3. The manager role should have sensible defaults (view permissions at minimum)
