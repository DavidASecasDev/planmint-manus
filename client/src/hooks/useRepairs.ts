import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { Repair, RepairFormData, RepairStatus } from '@/types/garatech';

export function useRepairs() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = !permissionsLoading && hasPermission('garatech.view');
  const canManage = !permissionsLoading && hasPermission('garatech.manage');

  const { data: repairs = [], isLoading } = useQuery({
    queryKey: ['repairs', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('repairs')
        .select(`
          *,
          vehicle:vehicles(matricula, modelo),
          workshop:workshops(name),
          created_by_profile:profiles!repairs_created_by_fkey(name)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({
        ...r,
        vehicle: r.vehicle ? { matricula: r.vehicle.matricula, modelo: r.vehicle.modelo } : null,
      })) as Repair[];
    },
    enabled: !!orgId,
  });

  const createRepair = useMutation({
    mutationFn: async (data: RepairFormData) => {
      if (!orgId || !profile?.id) throw new Error('No organization');
      const { data: result, error } = await supabase
        .from('repairs')
        .insert({ 
          ...data, 
          organization_id: orgId,
          created_by: profile.id,
          status: data.status || 'pendiente_aprobacion',
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', orgId] });
      toast.success('Reparación creada');
    },
    onError: () => toast.error('Error al crear reparación'),
  });

  const updateRepair = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RepairFormData & { status: RepairStatus }> }) => {
      const updates: any = { ...data };
      if (data.status === 'en_taller' && !updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (data.status === 'finalizado' && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('repairs').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', orgId] });
      toast.success('Reparación actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteRepair = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('repairs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', orgId] });
      toast.success('Reparación eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  return { repairs, isLoading, createRepair, updateRepair, deleteRepair, canView, canManage, permissionsLoading };
}
