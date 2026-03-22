// Role hierarchy utilities for filtering members by role level

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'read_only';

export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
  read_only: 0,
};

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Manager',
  member: 'Miembro',
  read_only: 'Solo lectura',
};

export interface OrganizationMemberWithRole {
  id?: string;
  user_id?: string;
  name?: string | null;
  role?: string;
}

/**
 * Check if the current role can filter/view other members' tasks
 * Only owner, admin, and manager can filter subordinates
 */
export function canFilterOtherMembers(role: string | undefined): boolean {
  if (!role) return false;
  return ['owner', 'admin', 'manager'].includes(role);
}

/**
 * Get members that are below the current user's role in hierarchy
 * @param currentRole - The role of the current user
 * @param members - All organization members
 * @returns Members that the current user can supervise
 */
export function getMembersBelow<T extends OrganizationMemberWithRole>(
  currentRole: string | undefined,
  members: T[]
): T[] {
  if (!currentRole) return [];
  
  const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
  
  return members.filter(member => {
    const memberLevel = ROLE_HIERARCHY[member.role || 'member'] ?? 0;
    return memberLevel < currentLevel;
  });
}

/**
 * Get members that are at or below the current user's role in hierarchy
 * This allows managers to see other managers' tasks (same level + below)
 * @param currentRole - The role of the current user
 * @param members - All organization members
 * @returns Members at the same level or below that the current user can filter
 */
export function getMembersAtOrBelow<T extends OrganizationMemberWithRole>(
  currentRole: string | undefined,
  members: T[]
): T[] {
  if (!currentRole) return [];
  
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 0;
  
  return members.filter(member => {
    const memberLevel = ROLE_HIERARCHY[member.role || 'member'] ?? 0;
    return memberLevel <= currentLevel;
  });
}

/**
 * Get the display label for a role
 */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}
