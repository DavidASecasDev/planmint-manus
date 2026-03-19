import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { OperationLeg, CreateOperationLegData, UpdateOperationLegData, LegStatus } from '@/types/operations';

export function useOperationLegs(taskId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id;

  const { data: legs = [], isLoading, error } = useQuery({
    queryKey: ['operation-legs', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('operation_legs')
        .select(`
          *,
          assignee:profiles!operation_legs_assignee_id_fkey(id, name)
        `)
        .eq('task_id', taskId)
        .order('leg_type', { ascending: true });

      if (error) throw error;
      return data as OperationLeg[];
    },
    enabled: !!taskId && !!organizationId,
  });

  const createLeg = useMutation({
    mutationFn: async (legData: CreateOperationLegData) => {
      if (!organizationId) throw new Error('No organization');

      const { data, error } = await supabase
        .from('operation_legs')
        .insert({
          organization_id: organizationId,
          ...legData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-legs', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear leg: ${error.message}`);
    },
  });

  const updateLeg = useMutation({
    mutationFn: async ({ legId, data }: { legId: string; data: UpdateOperationLegData }) => {
      const { data: updatedLeg, error } = await supabase
        .from('operation_legs')
        .update(data)
        .eq('id', legId)
        .select()
        .single();

      if (error) throw error;
      return updatedLeg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-legs', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar leg: ${error.message}`);
    },
  });

  const deleteLeg = useMutation({
    mutationFn: async (legId: string) => {
      const { error } = await supabase
        .from('operation_legs')
        .delete()
        .eq('id', legId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-legs', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Leg eliminado');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar leg: ${error.message}`);
    },
  });

  const startLeg = async (legId: string) => {
    return updateLeg.mutateAsync({
      legId,
      data: {
        status: 'en_route',
        started_at: new Date().toISOString(),
      },
    });
  };

  const completeLeg = async (legId: string) => {
    return updateLeg.mutateAsync({
      legId,
      data: {
        status: 'done',
        completed_at: new Date().toISOString(),
      },
    });
  };

  const reportIssue = async (legId: string, notes: string) => {
    return updateLeg.mutateAsync({
      legId,
      data: {
        status: 'issue',
        notes,
      },
    });
  };

  const updateChecklist = async (legId: string, key: string, value: boolean) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    const newChecklist = {
      ...leg.checklist_json,
      [key]: value,
    };

    return updateLeg.mutateAsync({
      legId,
      data: { checklist_json: newChecklist },
    });
  };

  const primaryLeg = legs.find(l => l.leg_type === 'primary');
  const supportLeg = legs.find(l => l.leg_type === 'support');

  return {
    legs,
    primaryLeg,
    supportLeg,
    isLoading,
    error,
    createLeg,
    updateLeg,
    deleteLeg,
    startLeg,
    completeLeg,
    reportIssue,
    updateChecklist,
  };
}
