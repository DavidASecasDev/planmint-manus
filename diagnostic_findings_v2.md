# Diagnostic Findings v2 - Permission Bug Root Cause

## Key Data Points

### Organization Modules (Azul Cars)
- reservations: **true** ✅
- transfers: **true** ✅
- Both modules ARE enabled in the database

### Mikaela (role: "manager")
- Step 1 (base view): 15 permissions including transfers.view and reservations.view
- Step 2 (role_permissions table): **0 entries** (no org-specific role_permissions)
- Step 3 (hardcoded manager defaults): 35 permissions including:
  - reservations.create ✅
  - transfers.create ✅
  - transfers.update ✅
  - transfers.change_status ✅
- Step 5 (user overrides): **0 overrides**
- FINAL: transfers.view=true, transfers.create=true, reservations.view=true, reservations.create=true

### Jordan (role: "member")
- Step 1 (base view): 15 permissions including transfers.view and reservations.view
- Step 2 (role_permissions table): **0 entries**
- Step 3 (hardcoded member defaults): 8 permissions (does NOT include transfers.create)
- Step 5 (user overrides): **11 overrides** including:
  - transfers.view: true
  - transfers.create: true ✅
  - transfers.update: true
  - transfers.change_status: true
  - transfers.manage_pricing: true
  - reservations.create: true
  - reservations.manage: true
- FINAL: transfers.view=true, transfers.create=true, reservations.view=true, reservations.create=true

### Custom Roles
- All custom roles have `permissions_json` stored as ARRAY of numbers (0-427), NOT as nested object!
- This means the custom role flattening code in the backend is wrong - it expects `{transfers: {view: true}}` but gets `[0, 1, 2, ...]`
- However, Jordan and Mikaela are NOT on custom roles, so this isn't the immediate cause

## ROOT CAUSE ANALYSIS

The backend simulation shows that BOTH Mikaela and Jordan should have correct permissions.
The problem is NOT in the backend permission computation.

**The problem MUST be in the frontend layer:**
1. The `useOrganizationModules` hook was querying Supabase directly (RLS blocked)
2. When modules returned empty, DEFAULT_MODULES had reservations=false and transfers=false
3. The sidebar hides modules based on `isModuleEnabled()` which uses this data

**The fix we already applied** (moving to apiInvoke) should resolve this.
But we need to verify the new endpoint actually works correctly.

## ADDITIONAL FINDING: Custom Roles permissions_json Format
The `permissions_json` in custom_roles is stored as an ARRAY of numeric indices, NOT as a nested object.
The backend's flatMap code expects `{transfers: {view: true}}` but gets `[0, 1, 2, ...]`.
This means custom role resolution is completely broken for all custom roles.
This needs to be fixed separately.
