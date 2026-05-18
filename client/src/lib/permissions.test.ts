import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY, ROLE_LABELS, getRoleLabel, canFilterOtherMembers, getMembersBelow, getMembersAtOrBelow, type OrgRole } from './roleHierarchy';
import { PERMISSION_CATEGORIES, type PermissionCategory } from './permissionDefinitions';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_LABELS, type RolePermissions } from '@/types/enterprise';

// ============================================================================
// 1. ROLE_HIERARCHY coherence
// ============================================================================
describe('ROLE_HIERARCHY coherence', () => {
  const expectedRoles: OrgRole[] = ['owner', 'admin', 'manager', 'member', 'read_only'];

  it('contains all 5 system roles', () => {
    expectedRoles.forEach(role => {
      expect(ROLE_HIERARCHY).toHaveProperty(role);
    });
  });

  it('has strictly descending hierarchy: owner > admin > manager > member > read_only', () => {
    expect(ROLE_HIERARCHY['owner']).toBeGreaterThan(ROLE_HIERARCHY['admin']);
    expect(ROLE_HIERARCHY['admin']).toBeGreaterThan(ROLE_HIERARCHY['manager']);
    expect(ROLE_HIERARCHY['manager']).toBeGreaterThan(ROLE_HIERARCHY['member']);
    expect(ROLE_HIERARCHY['member']).toBeGreaterThan(ROLE_HIERARCHY['read_only']);
  });

  it('read_only has the lowest hierarchy level (0)', () => {
    expect(ROLE_HIERARCHY['read_only']).toBe(0);
  });

  it('owner has the highest hierarchy level', () => {
    const maxLevel = Math.max(...Object.values(ROLE_HIERARCHY));
    expect(ROLE_HIERARCHY['owner']).toBe(maxLevel);
  });
});

// ============================================================================
// 2. ROLE_LABELS coherence
// ============================================================================
describe('ROLE_LABELS coherence', () => {
  it('has a label for every role in ROLE_HIERARCHY', () => {
    Object.keys(ROLE_HIERARCHY).forEach(role => {
      expect(ROLE_LABELS).toHaveProperty(role);
      expect(typeof ROLE_LABELS[role]).toBe('string');
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    });
  });

  it('getRoleLabel returns correct labels for all system roles', () => {
    expect(getRoleLabel('owner')).toBe('Propietario');
    expect(getRoleLabel('admin')).toBe('Administrador');
    expect(getRoleLabel('manager')).toBe('Manager');
    expect(getRoleLabel('member')).toBe('Miembro');
    expect(getRoleLabel('read_only')).toBe('Solo lectura');
  });
});

// ============================================================================
// 3. Hierarchy filtering with read_only
// ============================================================================
describe('Hierarchy filtering includes read_only', () => {
  const MEMBERS = [
    { id: '1', user_id: 'u1', name: 'Owner', role: 'owner' },
    { id: '2', user_id: 'u2', name: 'Admin', role: 'admin' },
    { id: '3', user_id: 'u3', name: 'Manager', role: 'manager' },
    { id: '4', user_id: 'u4', name: 'Member', role: 'member' },
    { id: '5', user_id: 'u5', name: 'ReadOnly', role: 'read_only' },
  ];

  it('read_only cannot filter other members', () => {
    expect(canFilterOtherMembers('read_only')).toBe(false);
  });

  it('member sees read_only below', () => {
    const result = getMembersBelow('member', MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('read_only');
  });

  it('read_only sees nobody below', () => {
    const result = getMembersBelow('read_only', MEMBERS);
    expect(result).toHaveLength(0);
  });

  it('owner sees all 4 members below (including read_only)', () => {
    const result = getMembersBelow('owner', MEMBERS);
    expect(result).toHaveLength(4);
    expect(result.map(m => m.role)).toContain('read_only');
  });

  it('getMembersAtOrBelow for read_only returns only read_only', () => {
    const result = getMembersAtOrBelow('read_only', MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('read_only');
  });
});

// ============================================================================
// 4. PermissionKey completeness in PERMISSION_CATEGORIES
// ============================================================================
describe('PERMISSION_CATEGORIES completeness', () => {
  // All PermissionKey values that must appear somewhere in PERMISSION_CATEGORIES
  const ALL_PERMISSION_KEYS = [
    // Tasks
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign', 'tasks.change_status', 'tasks.manage_columns',
    // Areas
    'areas.view', 'areas.create', 'areas.update', 'areas.delete', 'areas.manage_visibility', 'areas.manage_access_rules',
    // Tags
    'tags.view', 'tags.create', 'tags.update', 'tags.delete', 'tags.manage',
    // Templates
    'templates.view', 'templates.apply', 'templates.create', 'templates.delete',
    // Teams
    'teams.view',
    // Automations
    'automations.view', 'automations.create', 'automations.manage',
    // Reports
    'reports.view', 'reports.export', 'reports.view_financial',
    // Billing
    'billing.view', 'billing.manage',
    // Members
    'members.view', 'members.invite', 'members.change_role', 'members.manage_permissions', 'members.suspend',
    // Security
    'security.view_audit_logs',
    // Integrations
    'integrations.manage_api_keys',
    // Reservations
    'reservations.view', 'reservations.create', 'reservations.manage',
    // Garatech
    'garatech.view', 'garatech.create', 'garatech.update', 'garatech.change_status', 'garatech.edit_dates', 'garatech.manage_catalog', 'garatech.manage_accidents', 'garatech.manage',
    // Transfers
    'transfers.view', 'transfers.create', 'transfers.update', 'transfers.change_status', 'transfers.delete', 'transfers.manage_pricing', 'transfers.manage_brokers', 'transfers.manage',
    // Forms
    'forms.view', 'forms.create', 'forms.update', 'forms.delete', 'forms.view_responses', 'forms.manage',
    // Vehicles
    'vehicles.view', 'vehicles.create', 'vehicles.update', 'vehicles.archive', 'vehicles.manage_daily_tasks', 'vehicles.change_status', 'vehicles.complete_tasks', 'vehicles.manage_locations', 'vehicles.sync', 'vehicles.import', 'vehicles.manage',
    // Time Tracking
    'time_tracking.view', 'time_tracking.view_team', 'time_tracking.create', 'time_tracking.manage',
    // Movements
    'movements.view', 'movements.create', 'movements.manage', 'movements.delete', 'movements.edit_photos', 'movements.upload_receipt',
    // Daily Tasks
    'daily_tasks.view', 'daily_tasks.view_other_days', 'daily_tasks.complete', 'daily_tasks.manage',
    // Fleet
    'fleet.view', 'fleet.manage', 'fleet.import',
    // Schedules (Horarios)
    'schedules.view', 'schedules.assign', 'schedules.manage_templates', 'schedules.view_directiva', 'schedules.manage_notes', 'schedules.manage',
  ];

  it('has at least 18 categories', () => {
    expect(PERMISSION_CATEGORIES.length).toBeGreaterThanOrEqual(18);
  });

  it('every PermissionKey appears in at least one category', () => {
    const allCategoryKeys = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.key));
    ALL_PERMISSION_KEYS.forEach(key => {
      expect(allCategoryKeys).toContain(key);
    });
  });

  it('no duplicate permission keys across categories', () => {
    const allKeys = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.key));
    const uniqueKeys = new Set(allKeys);
    expect(allKeys.length).toBe(uniqueKeys.size);
  });

  it('every category has an icon and label', () => {
    PERMISSION_CATEGORIES.forEach(cat => {
      expect(cat.icon).toBeDefined();
      expect(cat.label).toBeTruthy();
      expect(cat.id).toBeTruthy();
    });
  });

  it('every permission has a non-empty label and description', () => {
    PERMISSION_CATEGORIES.forEach(cat => {
      cat.permissions.forEach(perm => {
        expect(perm.label.length).toBeGreaterThan(0);
        expect(perm.description.length).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================================================
// 5. DEFAULT_ROLE_PERMISSIONS completeness
// ============================================================================
describe('DEFAULT_ROLE_PERMISSIONS completeness', () => {
  const expectedCategories = [
    'tasks', 'areas', 'tags', 'automations', 'integrations', 'billing',
    'audit_logs', 'templates', 'team', 'reports', 'reservations',
    'garatech', 'transfers', 'forms', 'vehicles', 'time_tracking',
    'movements', 'daily_tasks', 'fleet',
  ];

  it('contains all 19 expected categories', () => {
    expectedCategories.forEach(cat => {
      expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty(cat);
    });
  });

  it('movements category has correct structure', () => {
    const m = DEFAULT_ROLE_PERMISSIONS.movements;
    expect(m).toBeDefined();
    expect(m).toHaveProperty('view');
    expect(m).toHaveProperty('create');
    expect(m).toHaveProperty('manage');
    expect(m).toHaveProperty('delete');
    expect(m).toHaveProperty('edit_photos');
    expect(m).toHaveProperty('upload_receipt');
  });

  it('daily_tasks category has correct structure', () => {
    const dt = DEFAULT_ROLE_PERMISSIONS.daily_tasks;
    expect(dt).toBeDefined();
    expect(dt).toHaveProperty('view');
    expect(dt).toHaveProperty('view_other_days');
    expect(dt).toHaveProperty('complete');
    expect(dt).toHaveProperty('manage');
  });

  it('fleet category has correct structure', () => {
    const f = DEFAULT_ROLE_PERMISSIONS.fleet;
    expect(f).toBeDefined();
    expect(f).toHaveProperty('view');
    expect(f).toHaveProperty('manage');
    expect(f).toHaveProperty('import');
  });

  it('all boolean values are explicitly set (no undefined)', () => {
    Object.entries(DEFAULT_ROLE_PERMISSIONS).forEach(([category, perms]) => {
      Object.entries(perms).forEach(([action, value]) => {
        expect(typeof value).toBe('boolean');
      });
    });
  });
});

// ============================================================================
// 6. PERMISSION_LABELS coherence
// ============================================================================
describe('PERMISSION_LABELS coherence', () => {
  it('has labels for movements category', () => {
    expect(PERMISSION_LABELS).toHaveProperty('movements');
    expect(PERMISSION_LABELS.movements).toHaveProperty('view');
    expect(PERMISSION_LABELS.movements).toHaveProperty('create');
    expect(PERMISSION_LABELS.movements).toHaveProperty('manage');
    expect(PERMISSION_LABELS.movements).toHaveProperty('delete');
    expect(PERMISSION_LABELS.movements).toHaveProperty('edit_photos');
    expect(PERMISSION_LABELS.movements).toHaveProperty('upload_receipt');
  });

  it('has labels for daily_tasks category', () => {
    expect(PERMISSION_LABELS).toHaveProperty('daily_tasks');
    expect(PERMISSION_LABELS.daily_tasks).toHaveProperty('view');
    expect(PERMISSION_LABELS.daily_tasks).toHaveProperty('view_other_days');
    expect(PERMISSION_LABELS.daily_tasks).toHaveProperty('complete');
    expect(PERMISSION_LABELS.daily_tasks).toHaveProperty('manage');
  });

  it('has labels for fleet category', () => {
    expect(PERMISSION_LABELS).toHaveProperty('fleet');
    expect(PERMISSION_LABELS.fleet).toHaveProperty('view');
    expect(PERMISSION_LABELS.fleet).toHaveProperty('manage');
    expect(PERMISSION_LABELS.fleet).toHaveProperty('import');
  });

  it('every label in DEFAULT_ROLE_PERMISSIONS has a corresponding label in PERMISSION_LABELS', () => {
    Object.entries(DEFAULT_ROLE_PERMISSIONS).forEach(([category, perms]) => {
      expect(PERMISSION_LABELS).toHaveProperty(category);
      Object.keys(perms).forEach(action => {
        expect(PERMISSION_LABELS[category]).toHaveProperty(action);
        expect(typeof PERMISSION_LABELS[category][action]).toBe('string');
        expect(PERMISSION_LABELS[category][action].length).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================================================
// 7. mapCustomRoleToFlatPermissions coverage (import-free structural test)
// ============================================================================
describe('Permission mapping structural integrity', () => {
  // We test that the PermissionKey type covers all categories by checking
  // that PERMISSION_CATEGORIES keys match what we expect
  
  it('PERMISSION_CATEGORIES covers movements, daily_tasks, fleet, and schedules', () => {
    const categoryIds = PERMISSION_CATEGORIES.map(c => c.id);
    expect(categoryIds).toContain('movements');
    expect(categoryIds).toContain('daily_tasks');
    expect(categoryIds).toContain('fleet');
    expect(categoryIds).toContain('schedules');
  });

  it('movements category has 6 permissions', () => {
    const movements = PERMISSION_CATEGORIES.find(c => c.id === 'movements');
    expect(movements).toBeDefined();
    expect(movements!.permissions).toHaveLength(6);
  });

  it('daily_tasks category has 4 permissions', () => {
    const dt = PERMISSION_CATEGORIES.find(c => c.id === 'daily_tasks');
    expect(dt).toBeDefined();
    expect(dt!.permissions).toHaveLength(4);
  });

  it('fleet category has 3 permissions', () => {
    const fleet = PERMISSION_CATEGORIES.find(c => c.id === 'fleet');
    expect(fleet).toBeDefined();
    expect(fleet!.permissions).toHaveLength(3);
  });

  it('schedules category has 6 permissions', () => {
    const schedules = PERMISSION_CATEGORIES.find(c => c.id === 'schedules');
    expect(schedules).toBeDefined();
    expect(schedules!.permissions).toHaveLength(6);
  });

  it('total permission keys count is at least 97', () => {
    const totalKeys = PERMISSION_CATEGORIES.reduce((sum, cat) => sum + cat.permissions.length, 0);
    expect(totalKeys).toBeGreaterThanOrEqual(97);
  });
});
