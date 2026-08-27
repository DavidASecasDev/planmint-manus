import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_KEYS, getDefaultPermissionsForRole } from '@shared/permissionDefaults';
import { PERMISSION_CATEGORIES } from './permissionDefinitions';

const SES_KEYS = [
  'ses_hospedajes.view',
  'ses_hospedajes.edit',
  'ses_hospedajes.export',
  'ses_hospedajes.manage_settings',
] as const;

describe('permisos SES.HOSPEDAJES', () => {
  it('mantiene las mismas cuatro claves en el catálogo central y en Administración', () => {
    const category = PERMISSION_CATEGORIES.find(item => item.id === 'ses_hospedajes');
    expect(category?.permissions.map(permission => permission.key)).toEqual(SES_KEYS);
    SES_KEYS.forEach(key => expect(ALL_PERMISSION_KEYS).toContain(key));
  });

  it('concede los cuatro permisos a owner y admin por defecto', () => {
    const owner = getDefaultPermissionsForRole('owner');
    const admin = getDefaultPermissionsForRole('admin');
    SES_KEYS.forEach(key => {
      expect(owner[key]).toBe(true);
      expect(admin[key]).toBe(true);
    });
  });

  it('no concede acceso SES a manager, member ni solo lectura sin asignación expresa', () => {
    for (const role of ['manager', 'member', 'read_only']) {
      const permissions = getDefaultPermissionsForRole(role);
      SES_KEYS.forEach(key => expect(permissions[key]).toBe(false));
    }
  });
});
