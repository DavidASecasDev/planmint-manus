/**
 * Tests for the permission override system.
 * Verifies that:
 * 1. User overrides take priority over role defaults
 * 2. Custom roles are resolved from custom_roles table
 * 3. Frontend permission checks use correct granular keys
 * 4. The permission merge order is: base view → system role → role_permissions → custom_role → user_overrides
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../..');

describe('Permission Override System', () => {
  describe('Backend: handleGetMyPermissions', () => {
    const coreEndpointsPath = path.join(projectRoot, 'server/coreEndpoints.ts');
    let coreEndpointsCode: string;

    beforeAll(() => {
      coreEndpointsCode = fs.readFileSync(coreEndpointsPath, 'utf-8');
    });

    it('should detect custom roles (not just system roles)', () => {
      // The backend must identify custom roles to resolve them from custom_roles table
      expect(coreEndpointsCode).toContain('isCustomRole');
      expect(coreEndpointsCode).toContain('custom:');
      expect(coreEndpointsCode).toContain('"owner", "admin", "manager", "member", "read_only"');
    });

    it('should query custom_roles table for non-system roles', () => {
      expect(coreEndpointsCode).toContain('.from("custom_roles")');
      expect(coreEndpointsCode).toContain('.select("permissions_json")');
    });

    it('should flatten custom role permissions_json to flat keys', () => {
      // Flattening is now done via shared flattenCustomRolePermissions function
      expect(coreEndpointsCode).toContain('flattenCustomRolePermissions');
      // The actual mapping is in shared/permissionDefaults.ts
      const sharedCode = fs.readFileSync(path.join(projectRoot, 'shared', 'permissionDefaults.ts'), 'utf-8');
      expect(sharedCode).toContain('flat["transfers.create"]');
      expect(sharedCode).toContain('flat["transfers.manage"]');
      expect(sharedCode).toContain('flat["transfers.manage_pricing"]');
      expect(sharedCode).toContain('flat["transfers.manage_brokers"]');
    });

    it('should apply user overrides AFTER role permissions (highest priority)', () => {
      // Search within handleGetMyPermissions function specifically
      const funcStart = coreEndpointsCode.indexOf('handleGetMyPermissions');
      const funcCode = coreEndpointsCode.substring(funcStart);
      
      const customRoleSection = funcCode.indexOf('Custom role: resolve permissions');
      const overridesSection = funcCode.indexOf('user-specific permission overrides');
      const returnSection = funcCode.indexOf('return res.json({', overridesSection);

      expect(customRoleSection).toBeGreaterThan(0);
      expect(overridesSection).toBeGreaterThan(customRoleSection);
      expect(returnSection).toBeGreaterThan(overridesSection);
    });

    it('should set override.enabled value (not just true) to support disabling permissions', () => {
      // Critical: overrides can be true OR false
      expect(coreEndpointsCode).toContain('permissions[override.permission_key] = override.enabled');
    });

    it('should query user_permissions with correct filters', () => {
      expect(coreEndpointsCode).toContain('.from("user_permissions")');
      expect(coreEndpointsCode).toContain('.select("permission_key, enabled")');
      expect(coreEndpointsCode).toContain('.eq("organization_id", p_organization_id)');
      expect(coreEndpointsCode).toContain('.eq("user_id", userId)');
    });

    it('should handle member role with basic defaults', () => {
      // Member role defaults are now in shared/permissionDefaults.ts
      expect(coreEndpointsCode).toContain('getDefaultPermissionsForRole');
      const sharedCode = fs.readFileSync(path.join(projectRoot, 'shared', 'permissionDefaults.ts'), 'utf-8');
      // Member role should get tasks.create, tasks.update, etc.
      expect(sharedCode).toContain('"tasks.create", "tasks.update"');
    });

    it('should NOT include transfers.create in member defaults', () => {
      // Member role should NOT have transfers.create by default (checked via shared defaults)
      const sharedCode = fs.readFileSync(path.join(projectRoot, 'shared', 'permissionDefaults.ts'), 'utf-8');
      // Find the member section in ROLE_DEFAULTS
      const memberIdx = sharedCode.indexOf('member: [');
      const memberEnd = sharedCode.indexOf('],', memberIdx);
      const memberDefaults = sharedCode.substring(memberIdx, memberEnd);
      expect(memberDefaults).not.toContain('transfers.create');
      expect(memberDefaults).not.toContain('transfers.manage');
    });
  });

  describe('Frontend: Transfers.tsx permission checks', () => {
    const transfersPath = path.join(projectRoot, 'client/src/pages/transfers/Transfers.tsx');
    let transfersCode: string;

    beforeAll(() => {
      transfersCode = fs.readFileSync(transfersPath, 'utf-8');
    });

    it('should check transfers.create for the create button, not just transfers.manage', () => {
      // The "Nueva Solicitud" button must be visible with transfers.create
      expect(transfersCode).toContain("hasPermission('transfers.create')");
    });

    it('should define canCreate using both transfers.create and transfers.manage', () => {
      expect(transfersCode).toContain("const canCreate = !permissionsLoading && (hasPermission('transfers.create') || hasPermission('transfers.manage'))");
    });

    it('should use canCreate for the create button, not canManage', () => {
      expect(transfersCode).toContain('{canCreate && (');
      // The button should reference canCreate
      const createButtonSection = transfersCode.indexOf('{canCreate && (');
      const buttonEnd = transfersCode.indexOf('</Button>', createButtonSection);
      const buttonSection = transfersCode.substring(createButtonSection, buttonEnd);
      expect(buttonSection).toContain('Nueva Solicitud');
    });
  });

  describe('Frontend: Sidebar permission checks', () => {
    const sidebarPath = path.join(projectRoot, 'client/src/components/layout/AppSidebar.tsx');
    let sidebarCode: string;

    beforeAll(() => {
      sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');
    });

    it('should gate Nueva Solicitud sidebar item with transfers.create', () => {
      expect(sidebarCode).toContain("permission: 'transfers.create'");
    });

    it('should gate Gestión Brokers sidebar item with transfers.manage_brokers', () => {
      expect(sidebarCode).toContain("permission: 'transfers.manage_brokers'");
    });
  });

  describe('Frontend: Transfer component permission checks', () => {
    it('BrokerSelect should use transfers.manage_brokers for adding brokers', () => {
      const code = fs.readFileSync(
        path.join(projectRoot, 'client/src/components/transfers/BrokerSelect.tsx'), 'utf-8'
      );
      expect(code).toContain("hasPermission('transfers.manage_brokers')");
    });

    it('ProviderSelect should use transfers.manage_brokers for adding providers', () => {
      const code = fs.readFileSync(
        path.join(projectRoot, 'client/src/components/transfers/ProviderSelect.tsx'), 'utf-8'
      );
      expect(code).toContain("hasPermission('transfers.manage_brokers')");
    });

    it('TransferItemBlock should use transfers.manage_pricing for price editing', () => {
      const code = fs.readFileSync(
        path.join(projectRoot, 'client/src/components/transfers/TransferItemBlock.tsx'), 'utf-8'
      );
      expect(code).toContain("hasPermission('transfers.manage_pricing')");
    });

    it('BrokerTable should use transfers.manage_brokers for broker deletion', () => {
      const code = fs.readFileSync(
        path.join(projectRoot, 'client/src/components/transfers/BrokerTable.tsx'), 'utf-8'
      );
      expect(code).toContain("hasPermission('transfers.manage_brokers')");
    });
  });

  describe('Backend: handleCreateAreaSecure respects user overrides', () => {
    let coreCode: string;
    let helperCode: string;

    beforeAll(() => {
      coreCode = fs.readFileSync(path.join(projectRoot, 'server/coreEndpoints.ts'), 'utf-8');
      helperCode = fs.readFileSync(path.join(projectRoot, 'server/permissionHelper.ts'), 'utf-8');
    });

    it('should use checkUserPermission helper for areas.create', () => {
      // The area creation endpoint must use the shared permission helper
      const areaSection = coreCode.indexOf('handleCreateAreaSecure');
      const areaEnd = coreCode.indexOf('handleCreateTaskSecure');
      const areaCode = coreCode.substring(areaSection, areaEnd);

      expect(areaCode).toContain('checkUserPermission');
      expect(areaCode).toContain('areas.create');
    });

    it('permissionHelper should apply user override as highest priority', () => {
      // In the helper, user_permissions must come AFTER role_permissions
      const roleCheck = helperCode.indexOf('.from("role_permissions")');
      const userOverrideCheck = helperCode.indexOf('.from("user_permissions")');
      expect(userOverrideCheck).toBeGreaterThan(roleCheck);

      // Must use userOverride.enabled (can be true or false)
      expect(helperCode).toContain('userOverride.enabled');
    });
  });

  describe('Permission merge order validation', () => {
    it('should follow the correct precedence: shared defaults → role_permissions table → custom_role → user_overrides', () => {
      const code = fs.readFileSync(
        path.join(projectRoot, 'server/coreEndpoints.ts'), 'utf-8'
      );

      const handleGetMyPerms = code.indexOf('handleGetMyPermissions');
      const endOfFunction = code.indexOf('} catch (err: any)', handleGetMyPerms);
      const funcCode = code.substring(handleGetMyPerms, endOfFunction);

      // 1. Shared defaults (getDefaultPermissionsForRole) come first
      const sharedDefaults = funcCode.indexOf('getDefaultPermissionsForRole');
      // 2. role_permissions table overrides
      const rolePermsTable = funcCode.indexOf('role_permissions table');
      // 3. Custom role resolution
      const customRole = funcCode.indexOf('Custom role: resolve permissions');
      // 4. User overrides (last = highest priority)
      const userOverrides = funcCode.indexOf('user-specific permission overrides');

      expect(sharedDefaults).toBeGreaterThan(0);
      expect(rolePermsTable).toBeGreaterThan(sharedDefaults);
      expect(customRole).toBeGreaterThan(rolePermsTable);
      expect(userOverrides).toBeGreaterThan(customRole);
    });
  });
});
