import { describe, it, expect } from 'vitest';
import {
  ROLE_HIERARCHY,
  canFilterOtherMembers,
  getMembersBelow,
  getMembersAtOrBelow,
  getRoleLabel,
} from './roleHierarchy';

const MEMBERS = [
  { id: '1', user_id: 'u1', name: 'Owner User', role: 'owner' },
  { id: '2', user_id: 'u2', name: 'Admin User', role: 'admin' },
  { id: '3', user_id: 'u3', name: 'Manager User', role: 'manager' },
  { id: '4', user_id: 'u4', name: 'Member User', role: 'member' },
];

describe('ROLE_HIERARCHY', () => {
  it('defines correct hierarchy levels', () => {
    expect(ROLE_HIERARCHY['owner']).toBe(4);
    expect(ROLE_HIERARCHY['admin']).toBe(3);
    expect(ROLE_HIERARCHY['manager']).toBe(2);
    expect(ROLE_HIERARCHY['member']).toBe(1);
  });

  it('owner has highest level', () => {
    const levels = Object.values(ROLE_HIERARCHY);
    expect(Math.max(...levels)).toBe(ROLE_HIERARCHY['owner']);
  });
});

describe('canFilterOtherMembers', () => {
  it('returns true for owner, admin, and manager', () => {
    expect(canFilterOtherMembers('owner')).toBe(true);
    expect(canFilterOtherMembers('admin')).toBe(true);
    expect(canFilterOtherMembers('manager')).toBe(true);
  });

  it('returns false for member', () => {
    expect(canFilterOtherMembers('member')).toBe(false);
  });

  it('returns false for undefined or unknown roles', () => {
    expect(canFilterOtherMembers(undefined)).toBe(false);
    expect(canFilterOtherMembers('viewer')).toBe(false);
  });
});

describe('getMembersBelow', () => {
  it('owner sees admin, manager, and member below', () => {
    const result = getMembersBelow('owner', MEMBERS);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.role)).toEqual(['admin', 'manager', 'member']);
  });

  it('admin sees manager and member below', () => {
    const result = getMembersBelow('admin', MEMBERS);
    expect(result).toHaveLength(2);
    expect(result.map(m => m.role)).toEqual(['manager', 'member']);
  });

  it('manager sees only member below', () => {
    const result = getMembersBelow('manager', MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('member');
  });

  it('member sees nobody below', () => {
    const result = getMembersBelow('member', MEMBERS);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for undefined role', () => {
    expect(getMembersBelow(undefined, MEMBERS)).toEqual([]);
  });
});

describe('getMembersAtOrBelow', () => {
  it('owner sees everyone', () => {
    const result = getMembersAtOrBelow('owner', MEMBERS);
    expect(result).toHaveLength(4);
  });

  it('admin sees admin, manager, and member', () => {
    const result = getMembersAtOrBelow('admin', MEMBERS);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.role)).toEqual(['admin', 'manager', 'member']);
  });

  it('manager sees manager and member (same level + below)', () => {
    const result = getMembersAtOrBelow('manager', MEMBERS);
    expect(result).toHaveLength(2);
    expect(result.map(m => m.role)).toEqual(['manager', 'member']);
  });

  it('member sees only themselves', () => {
    const result = getMembersAtOrBelow('member', MEMBERS);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('member');
  });

  it('returns empty array for undefined role', () => {
    expect(getMembersAtOrBelow(undefined, MEMBERS)).toEqual([]);
  });
});

describe('getRoleLabel', () => {
  it('returns Spanish labels for known roles', () => {
    expect(getRoleLabel('owner')).toBe('Propietario');
    expect(getRoleLabel('admin')).toBe('Administrador');
    expect(getRoleLabel('manager')).toBe('Manager');
    expect(getRoleLabel('member')).toBe('Miembro');
  });

  it('returns the role key as-is for unknown roles', () => {
    expect(getRoleLabel('superadmin')).toBe('superadmin');
    expect(getRoleLabel('viewer')).toBe('viewer');
  });
});
