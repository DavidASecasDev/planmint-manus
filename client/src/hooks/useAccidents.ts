import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { Accident, AccidentFormData } from '@/types/garatech';

export function useAccidents() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = !permissionsLoading && hasPermission('garatech.view');
  const canManage = !permissionsLoading && hasPermission('garatech.manage');

  const { data: accidents = [], isLoading } = useQuery({
    queryKey: ['accidents', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabaseQuery
        .from('accidents')
        .select(`
          *,
          vehicle:vehicles(matricula, modelo),
          reported_by_profile:profiles!accidents_reported_by_fkey(name),
          linked_repair:repairs!accidents_linked_repair_id_fkey(id, repair_number, status)
        `)
        .eq('organization_id', orgId)
        .order('accident_date', { ascending: false });
      if (error) throw error;
      return data.map((a: any) => ({
        ...a,
        vehicle: a.vehicle ? { matricula: (a.vehicle as any).matricula, modelo: (a.vehicle as any).modelo } : null,
        linked_repair: a.linked_repair && typeof a.linked_repair === 'object' && 'id' in a.linked_repair
          ? { id: (a.linked_repair as any).id, repair_number: (a.linked_repair as any).repair_number, status: (a.linked_repair as any).status }
          : null,
        severity: a.severity || 'leve',
        status: a.status || 'reportado',
        fault_assessment: a.fault_assessment || 'pendiente',
      })) as Accident[];
    },
    enabled: !!orgId,
  });

  const createAccident = useMutation({
    mutationFn: async (data: AccidentFormData) => {
      if (!orgId || !profile?.id) throw new Error('No organization');
      const { linked_repair_id, ...rest } = data;
      const { data: result, error } = await supabaseQuery
        .from('accidents')
        .insert({ 
          ...rest, 
          organization_id: orgId,
          reported_by: profile.id,
          severity: data.severity || 'leve',
          status: 'reportado',
          linked_repair_id: linked_repair_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accidents', orgId] });
      toast.success('Accidente registrado');
    },
    onError: () => toast.error('Error al registrar accidente'),
  });

  const updateAccident = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AccidentFormData & { status: string }> }) => {
      const updateData = { ...data } as any;
      if ('linked_repair_id' in updateData) {
        updateData.linked_repair_id = updateData.linked_repair_id || null;
      }
      const { error } = await supabaseQuery.from('accidents').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accidents', orgId] });
      toast.success('Accidente actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteAccident = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery.from('accidents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accidents', orgId] });
      toast.success('Accidente eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  return { accidents, isLoading, createAccident, updateAccident, deleteAccident, canView, canManage, permissionsLoading };
}
