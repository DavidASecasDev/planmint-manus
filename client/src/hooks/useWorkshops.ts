import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { Workshop, WorkshopFormData } from '@/types/garatech';

export function useWorkshops() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = !permissionsLoading && hasPermission('garatech.view');
  const canManage = !permissionsLoading && hasPermission('garatech.manage');

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['workshops', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabaseQuery
        .from('workshops')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return data as Workshop[];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes - workshops rarely change
  });

  const activeWorkshops = workshops.filter(w => w.is_active);

  const createWorkshop = useMutation({
    mutationFn: async (data: WorkshopFormData) => {
      if (!orgId) throw new Error('No organization');
      const { data: result, error } = await supabaseQuery
        .from('workshops')
        .insert({ ...data, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops', orgId] });
      toast.success('Taller creado');
    },
    onError: () => toast.error('Error al crear taller'),
  });

  const updateWorkshop = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkshopFormData> }) => {
      const { error } = await supabaseQuery
        .from('workshops')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops', orgId] });
      toast.success('Taller actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteWorkshop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery.from('workshops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops', orgId] });
      toast.success('Taller eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const updateRating = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      const { error } = await supabaseQuery
        .from('workshops')
        .update({ rating })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops', orgId] });
      toast.success('Valoración actualizada');
    },
    onError: () => toast.error('Error al actualizar valoración'),
  });

  return { workshops, activeWorkshops, isLoading, createWorkshop, updateWorkshop, deleteWorkshop, updateRating, canView, canManage, permissionsLoading };
}
