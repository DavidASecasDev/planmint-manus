import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { apiInvoke } from '@/lib/apiClient';
import type { Repair, RepairFormData, RepairStatus } from '@/types/garatech';

// ─── Rently service sync helper (best-effort, non-blocking) ─────────────────

type SyncAction = 'create' | 'update' | 'finish' | 'cancel';

async function syncRepairToRently(repairId: string, action: SyncAction) {
  try {
    const { data, error } = await apiInvoke<{ success: boolean; rentlyServiceId?: number }>(
      'repair-service-sync',
      { body: { repairId, action } }
    );
    if (error) {
      console.warn(`[Rently Sync] ${action} failed:`, error.message);
      toast.warning(`Rently: ${error.message}`, { duration: 5000 });
      return false;
    }
    if (data?.success) {
      toast.success(`Servicio Rently ${action === 'create' ? 'creado' : action === 'update' ? 'actualizado' : action === 'finish' ? 'finalizado' : 'cancelado'}`, { duration: 3000 });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Rently Sync] Error:', err);
    return false;
  }
}

/**
 * Determine what Rently sync action (if any) should fire based on the update.
 */
function determineSyncAction(
  data: Partial<RepairFormData & { status: RepairStatus }>,
  previousStatus?: RepairStatus
): { action: SyncAction; shouldSync: boolean } {
  // Status transitions that trigger sync
  if (data.status === 'en_taller' && previousStatus !== 'en_taller') {
    return { action: 'create', shouldSync: true };
  }
  if (data.status === 'finalizado' || data.status === 'listo_recoger') {
    return { action: 'finish', shouldSync: true };
  }

  // Date changes while already in taller → update service dates
  if (!data.status && (data.scheduled_date || data.started_at || data.completed_at)) {
    return { action: 'update', shouldSync: true };
  }

  return { action: 'update', shouldSync: false };
}

// ─── Main hook ──────────────────────────────────────────────────────────────

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
      const { data, error } = await supabaseQuery
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
      return data.map((r: any) => ({
        ...r,
        vehicle: r.vehicle ? { matricula: r.vehicle.matricula, modelo: r.vehicle.modelo } : null,
      })) as Repair[];
    },
    enabled: !!orgId,
  });

  const createRepair = useMutation({
    mutationFn: async (data: RepairFormData) => {
      if (!orgId || !profile?.id) throw new Error('No organization');
      const { data: result, error } = await supabaseQuery
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['repairs', orgId] });
      toast.success('Reparación creada');
      // If created directly as "en_taller", sync to Rently
      if (result?.status === 'en_taller' && result?.id) {
        syncRepairToRently(result.id, 'create');
      }
    },
    onError: () => toast.error('Error al crear reparación'),
  });

  const updateRepair = useMutation({
    mutationFn: async ({ id, data, previousStatus }: { id: string; data: Partial<RepairFormData & { status: RepairStatus }>; previousStatus?: RepairStatus }) => {
      const updates: any = { ...data };
      if (data.status === 'en_taller' && !updates.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (data.status === 'finalizado' && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabaseQuery.from('repairs').update(updates).eq('id', id);
      if (error) throw error;

      // When repair is finalized, mark all linked damages as repaired
      if (data.status === 'finalizado' && previousStatus !== 'finalizado') {
        await supabaseQuery
          .from('fleet_vehicle_damages')
          .update({ status: 'reparado', resolved_at: new Date().toISOString() } as any)
          .eq('repair_id', id);
      }

      return { id, data, previousStatus };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['repairs', orgId] });
      toast.success('Reparación actualizada');

      // Best-effort Rently sync (non-blocking)
      if (result) {
        const { action, shouldSync } = determineSyncAction(result.data, result.previousStatus);
        if (shouldSync) {
          syncRepairToRently(result.id, action);
        }
      }
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteRepair = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery.from('repairs').delete().eq('id', id);
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
