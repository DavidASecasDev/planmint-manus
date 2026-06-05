import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { apiInvoke } from '@/lib/apiClient';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'read_only';

export type PermissionKey =
  // Tasks
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.update'
  | 'tasks.delete'
  | 'tasks.assign'
  | 'tasks.change_status'
  | 'tasks.manage_columns'
  // Areas
  | 'areas.view'
  | 'areas.create'
  | 'areas.update'
  | 'areas.delete'
  | 'areas.manage_visibility'
  | 'areas.manage_access_rules'
  // Tags
  | 'tags.view'
  | 'tags.create'
  | 'tags.update'
  | 'tags.delete'
  | 'tags.manage'
  // Templates
  | 'templates.view'
  | 'templates.apply'
  | 'templates.create'
  | 'templates.delete'
  // Teams
  | 'teams.view'
  // Automations
  | 'automations.view'
  | 'automations.create'
  | 'automations.manage'
  // Reports
  | 'reports.view'
  | 'reports.export'
  | 'reports.view_financial'
  // Billing
  | 'billing.view'
  | 'billing.manage'
  // Members
  | 'members.view'
  | 'members.create'
  | 'members.invite'
  | 'members.change_role'
  | 'members.manage_permissions'
  | 'members.suspend'
  // Security
  | 'security.view_audit_logs'
  // Integrations
  | 'integrations.manage_api_keys'
  // Reservations
  | 'reservations.view'
  | 'reservations.create'
  | 'reservations.manage'
  // Garatech
  | 'garatech.view'
  | 'garatech.create'
  | 'garatech.update'
  | 'garatech.change_status'
  | 'garatech.edit_dates'
  | 'garatech.manage_catalog'
  | 'garatech.manage_accidents'
  | 'garatech.manage'
  // Transfers
  | 'transfers.view'
  | 'transfers.create'
  | 'transfers.update'
  | 'transfers.change_status'
  | 'transfers.delete'
  | 'transfers.manage_pricing'
  | 'transfers.manage_brokers'
  | 'transfers.manage'
  // Forms
  | 'forms.view'
  | 'forms.create'
  | 'forms.update'
  | 'forms.delete'
  | 'forms.view_responses'
  | 'forms.manage'
  // Vehicles
  | 'vehicles.view'
  | 'vehicles.create'
  | 'vehicles.update'
  | 'vehicles.archive'
  | 'vehicles.manage_daily_tasks'
  | 'vehicles.change_status'
  | 'vehicles.complete_tasks'
  | 'vehicles.manage_locations'
  | 'vehicles.sync'
  | 'vehicles.import'
  | 'vehicles.manage'
  // Time Tracking
  | 'time_tracking.view'
  | 'time_tracking.view_team'
  | 'time_tracking.create'
  | 'time_tracking.manage'
  // Movements
  | 'movements.view'
  | 'movements.create'
  | 'movements.manage'
  | 'movements.delete'
  | 'movements.edit_photos'
  | 'movements.upload_receipt'
  // Daily Tasks
  | 'daily_tasks.view'
  | 'daily_tasks.view_other_days'
  | 'daily_tasks.complete'
  | 'daily_tasks.manage'
  // Fleet
  | 'fleet.view'
  | 'fleet.manage'
  | 'fleet.import'
  // Schedules (Horarios)
  | 'schedules.view'
  | 'schedules.assign'
  | 'schedules.manage_templates'
  | 'schedules.view_directiva'
  | 'schedules.manage_notes'
  | 'schedules.manage'
  // Preparation
  | 'preparation.view'
  | 'preparation.manage'
  // Lost & Found
  | 'lost_found.view'
  | 'lost_found.create'
  | 'lost_found.update'
  | 'lost_found.manage'
  // Rently (Bidirectional Sync)
  | 'rently.booking_confirm'
  | 'rently.booking_cancel'
  | 'rently.booking_uncancel'
  | 'rently.booking_update'
  | 'rently.booking_create'
  | 'rently.operations_delivery'
  | 'rently.operations_return'
  | 'rently.customer_manage'
  | 'rently.cars_relocate'
  | 'rently.manage';

export interface PermissionsData {
  success: boolean;
  error?: string;
  role: OrgRole | null;
  status?: string;
  permissions: Record<string, boolean>;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
  name: string | null; // Flattened from profile for easy access
  profile?: {
    id: string;
    name: string | null;
  };
}

export interface UserPermissionOverride {
  id: string;
  organization_id: string;
  user_id: string;
  permission_key: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
}

export function usePermissions() {
  const { profile, organization } = useAuth();
  const organizationId = organization?.id || profile?.organization_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permissions', organizationId],
    queryFn: async (): Promise<PermissionsData> => {
      if (!organizationId) {
        return { success: false, role: null, permissions: {} };
      }

      const { data, error } = await apiInvoke<PermissionsData>('get-my-permissions', {
        body: { p_organization_id: organizationId },
      });

      if (error) {
        console.error('Error fetching permissions:', error);
        return { success: false, role: null, permissions: {} };
      }

      return data as PermissionsData;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on auth errors — redirect to login is already in progress
      if (error instanceof Error && error.name === 'AuthExpiredError') return false;
      return failureCount < 2;
    },
  });

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!data?.success) return false;
    return data.permissions[permission] === true;
  };

  const isOwner = data?.role === 'owner';
  const isAdmin = data?.role === 'admin' || isOwner;
  const isManager = data?.role === 'manager' || isAdmin;
  const canAccessAdminPanel = hasPermission('members.change_role') || hasPermission('members.manage_permissions');

  // CRITICAL: effectiveLoading must be true while AuthContext is initializing
  // React Query returns isLoading=false when query is disabled (enabled: false)
  // This caused race conditions where hasPermission() returned false during initial load
  const authInitializing = !profile?.organization_id && !organization?.id;
  const effectiveLoading = isLoading || authInitializing;

  return {
    permissions: data?.permissions || {},
    role: data?.role,
    status: data?.status,
    isLoading: effectiveLoading,
    error,
    hasPermission,
    isOwner,
    isAdmin,
    isManager,
    canAccessAdminPanel,
    refetch,
  };
}

// Hook for managing organization members — uses backend endpoints to bypass RLS
export function useOrganizationMembers() {
  const { profile, organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id || profile?.organization_id;

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async (): Promise<OrganizationMember[]> => {
      if (!organizationId) return [];

      const result = await apiInvoke<{ data: OrganizationMember[]; error: string | null }>('get-org-members', {
        body: { p_organization_id: organizationId },
      });

      if (result.error || !result.data) {
        console.error('Error fetching members:', result.error?.message);
        return [];
      }

      return result.data.data as OrganizationMember[];
    },
    enabled: !!organizationId,
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: OrgRole }) => {
      const result = await apiInvoke('update-member-role', {
        body: { p_member_id: memberId, p_role: role },
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast({ title: 'Rol actualizado', description: 'El rol del miembro ha sido actualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMemberStatus = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: string; status: 'active' | 'suspended' }) => {
      const result = await apiInvoke('update-member-status', {
        body: { p_member_id: memberId, p_status: status },
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast({ title: 'Estado actualizado', description: 'El estado del miembro ha sido actualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await apiInvoke('remove-member', {
        body: { p_member_id: memberId },
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast({ title: 'Miembro eliminado', description: 'El miembro ha sido eliminado de la organización' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetMemberPassword = useMutation({
    mutationFn: async ({ targetUserId, newPassword }: { targetUserId: string; newPassword: string }) => {
      const result = await apiInvoke<{ success: boolean; error?: string }>('reset-member-password', {
        body: { targetUserId, newPassword },
      });
      if (result.error) throw new Error(result.error.message);
      if (result.data && !result.data.success) {
        throw new Error(result.data.error || 'Error desconocido');
      }
    },
    onSuccess: () => {
      toast({ title: 'Contraseña actualizada', description: 'La contraseña del miembro ha sido cambiada correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error al cambiar contraseña', description: error.message, variant: 'destructive' });
    },
  });

  return {
    members,
    isLoading,
    refetch,
    updateMemberRole: updateMemberRole.mutate,
    updateMemberStatus: updateMemberStatus.mutate,
    removeMember: removeMember.mutate,
    resetMemberPassword: resetMemberPassword.mutate,
    isResettingPassword: resetMemberPassword.isPending,
    isUpdating: updateMemberRole.isPending || updateMemberStatus.isPending || removeMember.isPending,
  };
}

// Hook for managing user permission overrides — uses backend endpoints to bypass RLS
export function useUserPermissionOverrides(userId?: string) {
  const { profile, organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id || profile?.organization_id;

  const { data: overrides = [], isLoading, refetch } = useQuery({
    queryKey: ['user-permissions', organizationId, userId],
    queryFn: async (): Promise<UserPermissionOverride[]> => {
      if (!organizationId || !userId) return [];

      const result = await apiInvoke<{ data: UserPermissionOverride[]; error: string | null }>('get-user-permission-overrides', {
        body: { p_organization_id: organizationId, p_user_id: userId },
      });

      if (result.error || !result.data) {
        console.error('Error fetching user permissions:', result.error?.message);
        return [];
      }

      return result.data.data as UserPermissionOverride[];
    },
    enabled: !!organizationId && !!userId,
  });

  const setPermissionOverride = useMutation({
    mutationFn: async ({ permissionKey, enabled }: { permissionKey: string; enabled: boolean }) => {
      if (!organizationId || !userId) throw new Error('Missing organizationId or userId');

      const result = await apiInvoke('set-user-permission-override', {
        body: {
          p_organization_id: organizationId,
          p_user_id: userId,
          p_permission_key: permissionKey,
          p_enabled: enabled,
        },
      });

      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', organizationId, userId] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast({ title: 'Permiso actualizado', description: 'El permiso ha sido actualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeOverride = useMutation({
    mutationFn: async (permissionKey: string) => {
      if (!organizationId || !userId) throw new Error('Missing organizationId or userId');

      const result = await apiInvoke('remove-user-permission-override', {
        body: {
          p_organization_id: organizationId,
          p_user_id: userId,
          p_permission_key: permissionKey,
        },
      });

      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', organizationId, userId] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast({ title: 'Override eliminado', description: 'El permiso volverá a su valor por defecto' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetAllOverrides = useMutation({
    mutationFn: async () => {
      if (!organizationId || !userId) throw new Error('Missing organizationId or userId');

      const result = await apiInvoke('reset-user-permission-overrides', {
        body: {
          p_organization_id: organizationId,
          p_user_id: userId,
        },
      });

      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', organizationId, userId] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast({ title: 'Overrides eliminados', description: 'Todos los permisos volverán a sus valores por defecto' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    overrides,
    isLoading,
    refetch,
    setPermissionOverride: setPermissionOverride.mutate,
    removeOverride: removeOverride.mutate,
    resetAllOverrides: resetAllOverrides.mutate,
    isUpdating: setPermissionOverride.isPending || removeOverride.isPending || resetAllOverrides.isPending,
  };
}

// Hook to get role default permissions — uses backend endpoint to bypass RLS
export function useRolePermissions() {
  const queryClient = useQueryClient();

  const { data: rolePermissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const result = await apiInvoke<{ data: Array<{ id?: string; role: string; permission_key: string; enabled: boolean }>; error: string | null }>('get-role-permissions', {
        body: {},
      });

      if (result.error || !result.data) {
        console.error('Error fetching role permissions:', result.error?.message);
        return [];
      }

      return result.data.data || [];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - these rarely change
  });

  const updateMutation = useMutation({
    mutationFn: async ({ role, permissionKey, enabled }: { role: string; permissionKey: string; enabled: boolean }) => {
      const result = await apiInvoke('toggle-role-permission', {
        body: { p_role: role, p_permission_key: permissionKey, p_enabled: enabled },
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
  });

  const getDefaultsForRole = (role: OrgRole): Record<string, boolean> => {
    const defaults: Record<string, boolean> = {};
    rolePermissions
      .filter(rp => rp.role === role)
      .forEach(rp => {
        defaults[rp.permission_key] = rp.enabled;
      });
    return defaults;
  };

  const toggleRolePermission = (role: string, permissionKey: string, currentValue: boolean) => {
    return updateMutation.mutateAsync({ role, permissionKey, enabled: !currentValue });
  };

  return {
    rolePermissions,
    isLoading,
    getDefaultsForRole,
    toggleRolePermission,
    isUpdating: updateMutation.isPending,
  };
}
