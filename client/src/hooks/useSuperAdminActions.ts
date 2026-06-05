import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiClient';
import { toast } from 'sonner';

// Types
interface UpdateMemberRoleParams {
  memberId: string;
  newRole: string;
}

interface UpdateMemberStatusParams {
  memberId: string;
  status: 'active' | 'suspended';
}

interface DeleteMemberParams {
  memberId: string;
  memberName?: string;
}

interface AddMemberToOrgParams {
  userId: string;
  organizationId: string;
  role: string;
  userName?: string;
  orgName?: string;
}

interface UpdateOrgStatusParams {
  orgId: string;
  status: 'active' | 'suspended' | 'deleted';
}

interface DeleteOrgParams {
  orgId: string;
  orgName?: string;
}

interface UpdateOrgPlanParams {
  orgId: string;
  plan: string;
}

interface UpdateFeedbackParams {
  feedbackId: string;
  readAt?: string | null;
  resolvedAt?: string | null;
  internalNotes?: string;
}

interface DeleteFeedbackParams {
  feedbackId: string;
}

interface DeleteTaskParams {
  taskId: string;
}

interface DeleteAreaParams {
  areaId: string;
}

export function useSuperAdminActions() {
  const queryClient = useQueryClient();

  // ============ Member Actions ============

  const addMemberToOrg = useMutation({
    mutationFn: async ({ userId, organizationId, role }: AddMemberToOrgParams) => {
      const { data, error } = await apiInvoke<{ success: boolean; reactivated: boolean }>('super-admin/add-member', {
        body: { userId, organizationId, role },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { userName, orgName }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      toast.success(`${userName || 'Usuario'} añadido a ${orgName || 'la organización'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al añadir miembro');
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, newRole }: UpdateMemberRoleParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/update-member-role', {
        body: { memberId, newRole },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      toast.success('Rol actualizado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar rol: ' + error.message);
    },
  });

  const updateMemberStatus = useMutation({
    mutationFn: async ({ memberId, status }: UpdateMemberStatusParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/update-member-status', {
        body: { memberId, status },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      toast.success(status === 'active' ? 'Miembro reactivado' : 'Miembro suspendido');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar estado: ' + error.message);
    },
  });

  const deleteMember = useMutation({
    mutationFn: async ({ memberId }: DeleteMemberParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/remove-member', {
        body: { memberId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { memberName }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      toast.success(`Miembro ${memberName || ''} eliminado correctamente`);
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar miembro: ' + error.message);
    },
  });

  // ============ Organization Actions ============

  const updateOrgStatus = useMutation({
    mutationFn: async ({ orgId, status }: UpdateOrgStatusParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/update-org-status', {
        body: { orgId, status },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      const message = status === 'active' ? 'Organización reactivada' : 
                      status === 'suspended' ? 'Organización suspendida' : 'Organización marcada como eliminada';
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar organización: ' + error.message);
    },
  });

  const deleteOrganization = useMutation({
    mutationFn: async ({ orgId }: DeleteOrgParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/delete-organization', {
        body: { orgId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { orgName }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success(`Organización ${orgName || ''} eliminada permanentemente`);
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar organización: ' + error.message);
    },
  });

  const updateOrgPlan = useMutation({
    mutationFn: async ({ orgId, plan }: UpdateOrgPlanParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/update-org-plan', {
        body: { orgId, plan },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Plan actualizado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar plan: ' + error.message);
    },
  });

  // ============ Feedback Actions ============

  const updateFeedback = useMutation({
    mutationFn: async ({ feedbackId, readAt, resolvedAt, internalNotes }: UpdateFeedbackParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/update-feedback', {
        body: { feedbackId, readAt, resolvedAt, internalNotes },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      toast.success('Feedback actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar feedback: ' + error.message);
    },
  });

  const deleteFeedback = useMutation({
    mutationFn: async ({ feedbackId }: DeleteFeedbackParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/delete-feedback', {
        body: { feedbackId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Feedback eliminado');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar feedback: ' + error.message);
    },
  });

  // ============ Data Management Actions ============

  const deleteTask = useMutation({
    mutationFn: async ({ taskId }: DeleteTaskParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/delete-task', {
        body: { taskId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      toast.success('Tarea eliminada');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar tarea: ' + error.message);
    },
  });

  const deleteArea = useMutation({
    mutationFn: async ({ areaId }: DeleteAreaParams) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/delete-area', {
        body: { areaId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      toast.success('Área eliminada');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar área: ' + error.message);
    },
  });

  // ============ Auth User Management ============

  const resetUserPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/reset-password', {
        body: { userId, newPassword },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al resetear contraseña: ' + error.message);
    },
  });

  const createUser = useMutation({
    mutationFn: async ({ email, password, name, organizationId, role }: {
      email: string;
      password: string;
      name?: string;
      organizationId?: string;
      role?: string;
    }) => {
      const { data, error } = await apiInvoke<{ success: boolean; userId: string; email: string; name: string }>('super-admin/create-user', {
        body: { email, password, name, organizationId, role },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, { name, email }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['auth-users'] });
      toast.success(`Usuario ${name || email} creado correctamente`);
    },
    onError: (error: Error) => {
      toast.error('Error al crear usuario: ' + error.message);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await apiInvoke<{ success: boolean }>('super-admin/delete-user', {
        body: { userId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['auth-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-detail'] });
      toast.success('Usuario eliminado completamente del sistema');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar usuario: ' + error.message);
    },
  });

  return {
    // Member actions
    addMemberToOrg,
    updateMemberRole,
    updateMemberStatus,
    deleteMember,
    // Organization actions
    updateOrgStatus,
    deleteOrganization,
    updateOrgPlan,
    // Feedback actions
    updateFeedback,
    deleteFeedback,
    // Data actions
    deleteTask,
    deleteArea,
    // Auth user management
    resetUserPassword,
    createUser,
    deleteUser,
  };
}
