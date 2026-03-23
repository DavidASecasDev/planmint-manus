# Root Cause Analysis v2 - Permissions System Deep Dive

## Symptoms
1. **Mikaela (manager)** cannot see Reservations
2. **Jordan (member with overrides)** still cannot see Transfers

## Architecture Overview

### Data Flow
1. User logs in → AuthContext loads `profile` from `profiles` table
2. `profile.organization_id` → used to load `organization` from `organizations` table
3. `usePermissions()` calls `apiInvoke('get-my-permissions', { p_organization_id: organizationId })`
4. Backend `handleGetMyPermissions`:
   - Verifies JWT token → gets `userId`
   - Queries `organization_members` for role + status
   - Builds permissions: base view → system role defaults → custom role → role_permissions table → user_permissions overrides
5. Frontend `hasPermission()` checks the returned permissions map
6. Sidebar uses `isModuleEnabled()` AND `hasPermission()` to show/hide items

### Key Observation from Logs
- Only `owner` (David Admin) requests are in the network logs
- Jordan and Mikaela's requests are NOT captured in the logs
- This means either:
  a) They haven't logged in recently, OR
  b) Their requests fail silently, OR  
  c) The endpoint is never called for them

## Potential Root Causes

### RC1: Custom role detection bug (CRITICAL)
Line 319: `const isCustomRole = role.startsWith("custom:") || !["owner", "admin", "manager", "member", "read_only"].includes(role);`

If Jordan's role in `organization_members` is literally "member" (a system role), then:
- `isCustomRole = false`
- The member defaults (line 442-453) are applied
- Member defaults do NOT include `transfers.view` — wait, they don't need to because line 379 already sets `transfers.view = true` for ALL roles

Wait — line 379: `permissions["transfers.view"] = true;` is set for ALL non-owner roles. And line 373: `permissions["reservations.view"] = true;` is also set.

So the backend SHOULD return `transfers.view = true` and `reservations.view = true` for ALL users regardless of role.

### RC2: The sidebar `isModuleEnabled()` gate (MOST LIKELY)
The sidebar at line 475:
```
{item.url === '/vehicles' && isModuleEnabled('transfers') && hasPermission('transfers.view') && ...}
```

`isModuleEnabled('transfers')` calls `useOrganizationModules()` which queries `organization_modules` table.

But `useOrganizationModules()` uses `profile?.organization_id` as the query key.

If `profile.organization_id` is null or wrong, it returns `DEFAULT_MODULES` which has:
- `reservations: false`
- `transfers: false`

### RC3: Profile organization_id mismatch
From diagnostic data:
- Azul Cars org ID: `a23a0d42-5af7-4cda-9955-569c10cc6714`
- Jordan and Mikaela are members of this org

If their `profiles.organization_id` doesn't match this org ID, then:
- `useOrganizationModules()` queries wrong org → gets DEFAULT_MODULES → reservations=false, transfers=false
- `usePermissions()` sends wrong org ID → gets wrong permissions

### RC4: The `reservations` menu item has NO module check in MENU_MODULE_MAP
Wait, line 44: `'/reservations': 'reservations'` IS in MENU_MODULE_MAP.
And line 113: `'/reservations': 'reservations.view'` IS in MENU_PERMISSION_MAP.
And `reservations` IS in OPTIONAL_MODULES.

So for Reservas to show in sidebar:
1. `hasPermission('reservations.view')` must be true ← backend always returns true for active members
2. `isModuleEnabled('reservations')` must be true ← depends on organization_modules table

For Transfers to show:
1. `hasPermission('transfers.view')` must be true ← backend always returns true
2. `isModuleEnabled('transfers')` must be true ← depends on organization_modules table

## CONCLUSION

The most likely root cause is that `useOrganizationModules()` is returning `DEFAULT_MODULES` (where reservations=false, transfers=false) because:
1. The query to `organization_modules` table is failing silently, OR
2. The RLS policies on `organization_modules` prevent non-owner users from reading the table

Since the diagnostic showed that the owner CAN see these modules (they're enabled in the DB), but Mikaela and Jordan cannot, the issue is almost certainly **Supabase RLS (Row Level Security)** on the `organization_modules` table preventing non-owner users from reading the module configuration.

## Action Plan
1. Add detailed logging to `useOrganizationModules` to capture what non-owner users actually receive
2. Move `organization_modules` query to the backend Express endpoint (bypasses RLS using service role key)
3. OR: Create a new endpoint `get-org-modules` that uses the service client
