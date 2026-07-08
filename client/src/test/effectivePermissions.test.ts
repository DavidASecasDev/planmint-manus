/**
 * Tests for:
 * 1. permissionHelper.ts — the reusable server-side permission resolution helper
 * 2. EffectivePermissionsView — the admin panel component
 * 3. Endpoint permission checks — verifying all protected endpoints use permissionHelper
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('permissionHelper.ts — reusable permission resolution', () => {
  let helperCode: string;

  beforeAll(() => {
    helperCode = fs.readFileSync(path.join(ROOT, 'server', 'permissionHelper.ts'), 'utf-8');
  });

  it('exports checkUserPermission function', () => {
    expect(helperCode).toContain('export async function checkUserPermission');
  });

  it('accepts serviceClient, organizationId, userId, permissionKey parameters', () => {
    const sig = helperCode.match(/async function checkUserPermission\(([\s\S]*?)\)/);
    expect(sig).toBeTruthy();
    const params = sig![1];
    expect(params).toContain('serviceClient');
    expect(params).toContain('organizationId');
    expect(params).toContain('userId');
    expect(params).toContain('permissionKey');
  });

  it('returns { allowed, role, memberStatus } shape', () => {
    expect(helperCode).toContain('Promise<{ allowed: boolean; role: string | null; memberStatus: string | null }>');
  });

  it('owner always gets allowed=true', () => {
    expect(helperCode).toContain('if (role === "owner")');
    expect(helperCode).toContain('allowed: true, role, memberStatus: "active"');
  });

  it('checks role_permissions table for non-owner roles', () => {
    expect(helperCode).toContain('.from("role_permissions")');
    expect(helperCode).toContain('.eq("permission_key", permissionKey)');
  });

  it('handles custom roles by querying custom_roles.permissions_json', () => {
    expect(helperCode).toContain('.from("custom_roles")');
    expect(helperCode).toContain('flattenCustomRolePermissions');
  });

  it('applies user_permissions overrides as HIGHEST PRIORITY', () => {
    expect(helperCode).toContain('.from("user_permissions")');
    // The override section should be AFTER the role_permissions and custom_roles sections
    const rolePermIdx = helperCode.indexOf('.from("role_permissions")');
    const userPermIdx = helperCode.indexOf('.from("user_permissions")');
    expect(userPermIdx).toBeGreaterThan(rolePermIdx);
  });

  it('returns allowed=false for inactive members', () => {
    expect(helperCode).toContain('member.status !== "active"');
    expect(helperCode).toContain('allowed: false');
  });

  it('flattenCustomRolePermissions handles team→members mapping', () => {
    // The flattening logic is now in shared/permissionDefaults.ts (imported by permissionHelper)
    const sharedCode = fs.readFileSync(path.join(ROOT, 'shared', 'permissionDefaults.ts'), 'utf-8');
    expect(sharedCode).toContain('flat["members.invite"]');
    expect(sharedCode).toContain('flat["members.view"]');
  });

  it('flattenCustomRolePermissions handles security/integrations mapping', () => {
    const sharedCode = fs.readFileSync(path.join(ROOT, 'shared', 'permissionDefaults.ts'), 'utf-8');
    expect(sharedCode).toContain('flat["security.view_audit_logs"]');
    expect(sharedCode).toContain('flat["integrations.manage_api_keys"]');
  });
});

describe('Protected endpoints use checkUserPermission', () => {
  const endpointFiles = [
    { file: 'server/coreEndpoints.ts', expectedPermissions: ['tasks.create', 'areas.create'] },
    { file: 'server/createInvitation.ts', expectedPermissions: ['members.invite'] },
    { file: 'server/invitationEndpoints.ts', expectedPermissions: ['members.invite'] },
    { file: 'server/applyTemplate.ts', expectedPermissions: ['templates.apply'] },
  ];

  for (const { file, expectedPermissions } of endpointFiles) {
    describe(file, () => {
      let code: string;

      beforeAll(() => {
        code = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      });

      it('imports checkUserPermission from permissionHelper', () => {
        expect(code).toContain('import { checkUserPermission } from');
      });

      for (const perm of expectedPermissions) {
        it(`checks "${perm}" permission`, () => {
          expect(code).toContain(`"${perm}"`);
        });
      }

      it('does NOT have hardcoded role arrays for permission checks', () => {
        // Should not have patterns like: !["owner", "admin"].includes(role)
        // The only acceptable role check is for owner in the helper itself
        const hardcodedRoleChecks = code.match(/\["owner",\s*"admin"\]\.includes/g);
        expect(hardcodedRoleChecks).toBeNull();
      });
    });
  }
});

describe('EffectivePermissionsView component', () => {
  let viewCode: string;

  beforeAll(() => {
    viewCode = fs.readFileSync(
      path.join(ROOT, 'client', 'src', 'components', 'admin', 'EffectivePermissionsView.tsx'),
      'utf-8'
    );
  });

  it('exports EffectivePermissionsView component', () => {
    expect(viewCode).toContain('export function EffectivePermissionsView');
  });

  it('fetches all user_permissions for the organization via backend', () => {
    // Now uses apiInvoke('get-user-permission-overrides') backend endpoint
    expect(viewCode).toContain('get-user-permission-overrides');
    expect(viewCode).toContain('p_organization_id');
  });

  it('uses useOrganizationMembers to get member list', () => {
    expect(viewCode).toContain('useOrganizationMembers');
  });

  it('uses useRolePermissions to get role defaults', () => {
    expect(viewCode).toContain('useRolePermissions');
    expect(viewCode).toContain('getDefaultsForRole');
  });

  it('uses useCustomRoles to resolve custom role permissions', () => {
    expect(viewCode).toContain('useCustomRoles');
    expect(viewCode).toContain('mapCustomRoleToFlatPermissions');
  });

  it('computes effective permissions with correct priority: role < custom_role < override', () => {
    // Override should be checked AFTER role defaults
    const roleDefaultIdx = viewCode.indexOf('const roleDefault = isOwner ? true');
    const overrideIdx = viewCode.indexOf('if (overrideMap.has(key))');
    expect(roleDefaultIdx).toBeGreaterThan(-1);
    expect(overrideIdx).toBeGreaterThan(roleDefaultIdx);
  });

  it('owner always gets all permissions granted', () => {
    expect(viewCode).toContain('isOwner ? true');
  });

  it('tracks override count per member', () => {
    expect(viewCode).toContain('overrideCount');
    expect(viewCode).toContain('userOverrides.length');
  });

  it('displays permission source (role, custom_role, override)', () => {
    // Code uses assignment (=) for setting source, and type annotation (:) for the type
    expect(viewCode).toContain("source = 'override'");
    expect(viewCode).toContain("'custom_role'");
    expect(viewCode).toContain("'role'");
  });

  it('shows visual distinction for overrides (blue ring)', () => {
    expect(viewCode).toContain('ring-blue-500');
  });

  it('provides member filter dropdown', () => {
    expect(viewCode).toContain('selectedMemberId');
    expect(viewCode).toContain('Seleccionar miembro');
  });

  it('provides category/module filter', () => {
    expect(viewCode).toContain('categoryFilter');
    expect(viewCode).toContain('Todos los módulos');
  });

  it('provides search functionality', () => {
    expect(viewCode).toContain('searchQuery');
    expect(viewCode).toContain('Buscar permisos');
  });

  it('shows granted/denied badges with tooltips', () => {
    expect(viewCode).toContain('ShieldCheck');
    expect(viewCode).toContain('ShieldX');
    expect(viewCode).toContain('TooltipContent');
  });

  it('shows summary cards with granted/total counts', () => {
    expect(viewCode).toContain('grantedCount');
    expect(viewCode).toContain('totalCount');
  });

  it('displays legend explaining badge colors', () => {
    expect(viewCode).toContain('Concedido');
    expect(viewCode).toContain('Denegado');
    expect(viewCode).toContain('Override individual');
  });
});

describe('Admin.tsx integrates EffectivePermissionsView', () => {
  let adminCode: string;

  beforeAll(() => {
    adminCode = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Admin.tsx'), 'utf-8');
  });

  it('imports EffectivePermissionsView', () => {
    expect(adminCode).toContain("import { EffectivePermissionsView } from '@/components/admin/EffectivePermissionsView'");
  });

  it('has a "Permisos efectivos" tab trigger', () => {
    expect(adminCode).toContain('Permisos efectivos');
    expect(adminCode).toContain('value="effective"');
  });

  it('renders EffectivePermissionsView in the effective tab', () => {
    expect(adminCode).toContain('<EffectivePermissionsView />');
  });

  it('uses Eye icon for the effective permissions tab', () => {
    expect(adminCode).toContain('Eye');
  });
});

describe('Frontend permission gates use granular permissions', () => {
  it('Transfers.tsx uses transfers.create for create button', () => {
    const code = fs.readFileSync(
      path.join(ROOT, 'client', 'src', 'pages', 'transfers', 'Transfers.tsx'),
      'utf-8'
    );
    expect(code).toContain("transfers.create");
  });

  it('AppSidebar uses transfers.create for Nueva Solicitud', () => {
    const code = fs.readFileSync(
      path.join(ROOT, 'client', 'src', 'components', 'layout', 'AppSidebar.tsx'),
      'utf-8'
    );
    expect(code).toContain("transfers.create");
  });

  it('BrokerSelect uses transfers.manage_brokers', () => {
    const code = fs.readFileSync(
      path.join(ROOT, 'client', 'src', 'components', 'transfers', 'BrokerSelect.tsx'),
      'utf-8'
    );
    expect(code).toContain("transfers.manage_brokers");
  });

});
