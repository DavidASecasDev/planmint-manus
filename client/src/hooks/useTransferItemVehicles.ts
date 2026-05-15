import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { TransferItemVehicle } from '@/types/transfers';

export function useTransferItemVehicles(transferItemId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['transfer-item-vehicles', transferItemId];

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!transferItemId || !profile?.organization_id) return [];
      const { data, error } = await supabaseQuery
        .from('transfer_item_vehicles')
        .select('*')
        .eq('transfer_item_id', transferItemId)
        .eq('organization_id', profile.organization_id)
        .order('position');
      if (error) throw error;
      return (data ?? []) as TransferItemVehicle[];
    },
    enabled: !!transferItemId && !!profile?.organization_id,
  });

  const addVehicle = useMutation({
    mutationFn: async (data: Partial<TransferItemVehicle>) => {
      if (!profile?.organization_id || !transferItemId) throw new Error('Missing data');
      const { data: result, error } = await supabaseQuery
        .from('transfer_item_vehicles')
        .insert({
          transfer_item_id: transferItemId,
          organization_id: profile.organization_id,
          vehicle_type: data.vehicle_type || 'v_class',
          vehicle_label: data.vehicle_label ?? null,
          driver_name: data.driver_name ?? null,
          driver_phone: data.driver_phone ?? null,
          notes: data.notes ?? null,
          position: data.position ?? vehicles.length,
        })
        .select()
        .single();
      if (error) throw error;
      return result as TransferItemVehicle;
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic: TransferItemVehicle = {
        id: `temp-${Date.now()}`,
        transfer_item_id: transferItemId!,
        organization_id: profile!.organization_id!,
        vehicle_type: data.vehicle_type || 'v_class',
        vehicle_label: data.vehicle_label ?? null,
        driver_name: data.driver_name ?? null,
        driver_phone: data.driver_phone ?? null,
        notes: data.notes ?? null,
        position: data.position ?? vehicles.length,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKey, (old: TransferItemVehicle[] | undefined) => [...(old || []), optimistic]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error('Error al añadir vehículo');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TransferItemVehicle> & { id: string }) => {
      const { error } = await supabaseQuery
        .from('transfer_item_vehicles')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      return { id, ...data };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: TransferItemVehicle[] | undefined) =>
        (old || []).map((v) => (v.id === variables.id ? { ...v, ...variables } : v))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error('Error al actualizar vehículo');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('transfer_item_vehicles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: TransferItemVehicle[] | undefined) =>
        (old || []).filter((v) => v.id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error('Error al eliminar vehículo');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    vehicles,
    isLoading,
    addVehicle: addVehicle.mutate,
    updateVehicle: updateVehicle.mutate,
    deleteVehicle: deleteVehicle.mutate,
    isAdding: addVehicle.isPending,
  };
}
