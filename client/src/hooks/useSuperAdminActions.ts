import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      // Check if membership already exists
      const { data: existing } = await supabase
        .from('organization_members')
        .select('id, status')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          throw new Error('El usuario ya es miembro activo de esta organización');
        }
        // Reactivate if suspended
        const { error } = await supabase
          .from('organization_members')
          .update({ status: 'active', role })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }

      // Insert new membership
      const { error } = await supabase
        .from('organization_members')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          role,
          status: 'active',
        });

      if (error) throw error;
    },
    onSuccess: (_, { userName, orgName }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success(`${userName || 'Usuario'} añadido a ${orgName || 'la organización'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al añadir miembro');
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, newRole }: UpdateMemberRoleParams) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('Rol actualizado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar rol: ' + error.message);
    },
  });

  const updateMemberStatus = useMutation({
    mutationFn: async ({ memberId, status }: UpdateMemberStatusParams) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ status })
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success(status === 'active' ? 'Miembro reactivado' : 'Miembro suspendido');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar estado: ' + error.message);
    },
  });

  const deleteMember = useMutation({
    mutationFn: async ({ memberId }: DeleteMemberParams) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: (_, { memberName }) => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success(`Miembro ${memberName || ''} eliminado correctamente`);
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar miembro: ' + error.message);
    },
  });

  // ============ Organization Actions ============

  const updateOrgStatus = useMutation({
    mutationFn: async ({ orgId, status }: UpdateOrgStatusParams) => {
      const { error } = await supabase
        .from('organizations')
        .update({ status })
        .eq('id', orgId);
      
      if (error) throw error;
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
      // First delete related data
      await supabase.from('tasks').delete().eq('organization_id', orgId);
      await supabase.from('areas').delete().eq('organization_id', orgId);
      await supabase.from('organization_members').delete().eq('organization_id', orgId);
      await supabase.from('subscriptions').delete().eq('organization_id', orgId);
      
      // Then delete the organization
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);
      
      if (error) throw error;
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
      const { error } = await supabase
        .from('subscriptions')
        .update({ plan })
        .eq('organization_id', orgId);
      
      if (error) throw error;
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
      const updates: Record<string, any> = {};
      if (readAt !== undefined) updates.read_at = readAt;
      if (resolvedAt !== undefined) updates.resolved_at = resolvedAt;
      if (internalNotes !== undefined) updates.internal_notes = internalNotes;

      const { error } = await supabase
        .from('user_feedback')
        .update(updates)
        .eq('id', feedbackId);
      
      if (error) throw error;
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
      const { error } = await supabase
        .from('user_feedback')
        .delete()
        .eq('id', feedbackId);
      
      if (error) throw error;
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
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
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
      const { error } = await supabase
        .from('areas')
        .delete()
        .eq('id', areaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      toast.success('Área eliminada');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar área: ' + error.message);
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
  };
}
