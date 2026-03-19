import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { TransferItem, TransferItemStatus } from '@/types/transfers';

export function useTransferItems(requestId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async (data: Partial<TransferItem>) => {
      if (!profile?.organization_id || !requestId) throw new Error('Missing data');

      // Validate that the request still exists before creating item
      const { data: currentRequest, error: checkError } = await supabase
        .from('transfer_requests')
        .select('id')
        .eq('id', requestId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (checkError || !currentRequest) {
        throw new Error('La solicitud de transfer ya no existe o no tienes acceso');
      }

      const { data: result, error } = await supabase
        .from('transfer_items')
        .insert({
          request_id: requestId,
          organization_id: profile.organization_id,
          position: data.position ?? 1,
          transfer_date: data.transfer_date,
          pickup_enabled: data.pickup_enabled ?? true,
          pickup_location: data.pickup_location,
          pickup_time: data.pickup_time,
          dropoff_enabled: data.dropoff_enabled ?? true,
          dropoff_location: data.dropoff_location,
          dropoff_time: data.dropoff_time,
          has_return: data.has_return ?? false,
          return_pickup_enabled: data.return_pickup_enabled ?? false,
          return_pickup_location: data.return_pickup_location,
          return_pickup_time: data.return_pickup_time,
          return_dropoff_enabled: data.return_dropoff_enabled ?? false,
          return_dropoff_location: data.return_dropoff_location,
          return_dropoff_time: data.return_dropoff_time,
          pax_count: data.pax_count ?? 1,
          driver_name: data.driver_name,
          driver_phone: data.driver_phone,
          driver_pending: data.driver_pending ?? false,
          notes: data.notes,
          zone: data.zone,
          zone_address: data.zone_address,
          vehicle_type: data.vehicle_type ?? 'v_class',
          base_price: data.base_price,
          price_with_commission: data.price_with_commission,
          price_manually_set: data.price_manually_set ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear transfer: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TransferItem> & { id: string }) => {
      // Verify the item belongs to this request before updating
      const { data: existingItem, error: checkError } = await supabase
        .from('transfer_items')
        .select('id, request_id')
        .eq('id', id)
        .single();

      if (checkError || !existingItem) {
        throw new Error('El item ya no existe');
      }

      // Safety check: ensure item belongs to current request
      if (requestId && existingItem.request_id !== requestId) {
        throw new Error('El item no pertenece a esta solicitud');
      }

      const { error } = await supabase
        .from('transfer_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      return { id, ...data };
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['transfer-request', requestId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['transfer-request', requestId]);

      // Optimistically update cache in-place
      queryClient.setQueryData(['transfer-request', requestId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items?.map((item: any) =>
            item.id === variables.id ? { ...item, ...variables } : item
          ),
        };
      });

      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['transfer-request', requestId], context.previousData);
      }
      toast.error(`Error al actualizar transfer: ${error.message}`);
    },
    onSettled: () => {
      // Only invalidate the list view (lightweight), NOT the detail
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
    },
  });

  const updateItemStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TransferItemStatus }) => {
      const { error } = await supabase
        .from('transfer_items')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      toast.success('Estado del transfer actualizado');
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar estado: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transfer_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      toast.success('Transfer eliminado');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const createMultipleItems = useMutation({
    mutationFn: async (count: number) => {
      if (!profile?.organization_id || !requestId) throw new Error('Missing data');

      // Validate that the request exists before creating items
      const { data: currentRequest, error: checkError } = await supabase
        .from('transfer_requests')
        .select('id')
        .eq('id', requestId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (checkError || !currentRequest) {
        throw new Error('La solicitud de transfer ya no existe o no tienes acceso');
      }

      const items = Array.from({ length: count }, (_, i) => ({
        request_id: requestId,
        organization_id: profile.organization_id!,
        position: i + 1,
        pickup_enabled: true,
        dropoff_enabled: true,
        has_return: false,
        return_pickup_enabled: false,
        return_dropoff_enabled: false,
        driver_pending: false,
        pax_count: 1,
        vehicle_type: 'v_class',
        price_manually_set: false,
      }));

      const { error } = await supabase
        .from('transfer_items')
        .insert(items);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear transfers: ${error.message}`);
    },
  });

  return {
    createItem: createItem.mutateAsync,
    updateItem: updateItem.mutate,
    updateItemStatus: updateItemStatus.mutate,
    deleteItem: deleteItem.mutate,
    createMultipleItems: createMultipleItems.mutateAsync,
    isCreating: createItem.isPending || createMultipleItems.isPending,
    isUpdating: updateItem.isPending,
  };
}
