import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { toast } from 'sonner';
import type { TransferRequest, TransferRequestStatus, TransferItem } from '@/types/transfers';

export interface BrokerFilters {
  search?: string;
  status?: TransferRequestStatus | 'all';
  brokerId?: string | 'all';
}

export interface BrokerRequestItemData {
  transfer_date: string | null;
  pickup_enabled: boolean;
  pickup_location: string | null;
  pickup_time: string | null;
  dropoff_enabled: boolean;
  dropoff_location: string | null;
  dropoff_time: string | null;
  has_return: boolean;
  return_pickup_enabled?: boolean;
  return_pickup_location?: string | null;
  return_pickup_time?: string | null;
  return_dropoff_enabled?: boolean;
  return_dropoff_location?: string | null;
  return_dropoff_time?: string | null;
  pax_count: number | null;
  vehicle_type?: string | null;
  notes?: string | null;
}

export interface CreateBrokerRequestData {
  client_name: string;
  notes?: string;
  items: BrokerRequestItemData[];
}

export interface UpdateBrokerRequestData {
  id: string;
  client_name: string;
  notes?: string;
  items: BrokerRequestItemData[];
}

export function useBrokerRequests(filters?: BrokerFilters) {
  const { broker } = useBrokerAuth();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['broker-requests', broker?.organization_id, filters],
    queryFn: async (): Promise<TransferRequest[]> => {
      if (!broker?.organization_id) return [];

      let query = supabase
        .from('transfer_requests')
        .select(`
          *,
          items:transfer_items(id, transfer_date, status, price_with_commission, pickup_location, dropoff_location, pax_count)
        `)
        .eq('organization_id', broker.organization_id);

      // Apply filters
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.brokerId && filters.brokerId !== 'all') {
        query = query.eq('broker_id', filters.brokerId);
      }
      if (filters?.search) {
        query = query.or(`client_name.ilike.%${filters.search}%,request_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching broker requests:', error);
        throw error;
      }

      // Process data to add computed fields
      const processed = (data || []).map(request => {
        const items = request.items || [];
        const dates = items.map((i: { transfer_date: string | null }) => i.transfer_date).filter(Boolean).sort();
        const total_amount = items.reduce((sum: number, i: { price_with_commission: number | null }) => 
          sum + (i.price_with_commission || 0), 0);
        return {
          ...request,
          status: request.status as TransferRequestStatus,
          items_count: items.length,
          first_transfer_date: dates[0] || null,
          total_amount,
        };
      }) as TransferRequest[];

      // Sort by first_transfer_date
      return processed.sort((a, b) => {
        if (!a.first_transfer_date && !b.first_transfer_date) return 0;
        if (!a.first_transfer_date) return 1;
        if (!b.first_transfer_date) return -1;
        return new Date(a.first_transfer_date).getTime() - new Date(b.first_transfer_date).getTime();
      });
    },
    enabled: !!broker?.organization_id,
  });

  // Get all brokers in the organization for filter dropdown
  const { data: brokers = [] } = useQuery({
    queryKey: ['broker-list', broker?.organization_id],
    queryFn: async () => {
      if (!broker?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('transfer_brokers')
        .select('id, name')
        .eq('organization_id', broker.organization_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!broker?.organization_id,
  });

  const createRequest = useMutation({
    mutationFn: async (data: CreateBrokerRequestData) => {
      if (!broker?.organization_id || !broker?.id) {
        throw new Error('No broker session');
      }

      // Create the request
      const { data: requestResult, error: requestError } = await supabase
        .from('transfer_requests')
        .insert([{
          organization_id: broker.organization_id,
          broker_id: broker.id,
          broker_name: broker.name,
          client_name: data.client_name,
          notes: data.notes || null,
          status: 'pendiente',
          is_external_provider: false,
          request_number: '', // Will be auto-generated
        }])
        .select()
        .single();

      if (requestError) throw requestError;

      // Create the items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map((item, index) => ({
          request_id: requestResult.id,
          organization_id: broker.organization_id,
          position: index + 1,
          transfer_date: item.transfer_date,
          status: 'pendiente',
          pickup_enabled: item.pickup_enabled,
          pickup_location: item.pickup_location,
          pickup_time: item.pickup_time,
          dropoff_enabled: item.dropoff_enabled,
          dropoff_location: item.dropoff_location,
          dropoff_time: item.dropoff_time,
          has_return: item.has_return,
          return_pickup_enabled: item.return_pickup_enabled || false,
          return_pickup_location: item.return_pickup_location || null,
          return_pickup_time: item.return_pickup_time || null,
          return_dropoff_enabled: item.return_dropoff_enabled || false,
          return_dropoff_location: item.return_dropoff_location || null,
          return_dropoff_time: item.return_dropoff_time || null,
          pax_count: item.pax_count,
          vehicle_type: item.vehicle_type || null,
          notes: item.notes || null,
          driver_pending: true,
        }));

        const { error: itemsError } = await supabase
          .from('transfer_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return requestResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-requests'] });
      toast.success('Solicitud creada correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al crear solicitud: ${error.message}`);
    },
  });

  const updateRequest = useMutation({
    mutationFn: async (data: UpdateBrokerRequestData) => {
      if (!broker?.organization_id || !broker?.id) {
        throw new Error('No broker session');
      }

      // Update the request
      const { error: updateError } = await supabase
        .from('transfer_requests')
        .update({
          client_name: data.client_name,
          notes: data.notes || null,
        })
        .eq('id', data.id)
        .eq('status', 'pendiente');

      if (updateError) throw updateError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('transfer_items')
        .delete()
        .eq('request_id', data.id);

      if (deleteError) throw deleteError;

      // Re-insert items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map((item, index) => ({
          request_id: data.id,
          organization_id: broker.organization_id,
          position: index + 1,
          transfer_date: item.transfer_date,
          status: 'pendiente',
          pickup_enabled: item.pickup_enabled,
          pickup_location: item.pickup_location,
          pickup_time: item.pickup_time,
          dropoff_enabled: item.dropoff_enabled,
          dropoff_location: item.dropoff_location,
          dropoff_time: item.dropoff_time,
          has_return: item.has_return,
          return_pickup_enabled: item.return_pickup_enabled || false,
          return_pickup_location: item.return_pickup_location || null,
          return_pickup_time: item.return_pickup_time || null,
          return_dropoff_enabled: item.return_dropoff_enabled || false,
          return_dropoff_location: item.return_dropoff_location || null,
          return_dropoff_time: item.return_dropoff_time || null,
          pax_count: item.pax_count,
          vehicle_type: item.vehicle_type || null,
          notes: item.notes || null,
          driver_pending: true,
        }));

        const { error: itemsError } = await supabase
          .from('transfer_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-requests'] });
      queryClient.invalidateQueries({ queryKey: ['broker-request-detail'] });
      toast.success('Solicitud actualizada correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar solicitud: ${error.message}`);
    },
  });

  const updateRequestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'confirmado' | 'en_gestion' }) => {
      if (!broker?.organization_id) throw new Error('No broker session');

      const { error } = await supabase
        .from('transfer_requests')
        .update({ status })
        .eq('id', id)
        .eq('status', 'presupuesto_enviado');

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broker-requests'] });
      queryClient.invalidateQueries({ queryKey: ['broker-request-detail'] });
      toast.success(
        variables.status === 'confirmado'
          ? 'Presupuesto aceptado correctamente'
          : 'Solicitud de cambios enviada'
      );
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Stats calculation
  const stats = {
    total: requests.length,
    pendiente: requests.filter(r => r.status === 'pendiente').length,
    en_gestion: requests.filter(r => r.status === 'en_gestion').length,
    presupuesto_enviado: requests.filter(r => r.status === 'presupuesto_enviado').length,
    confirmado: requests.filter(r => r.status === 'confirmado').length,
    completado: requests.filter(r => r.status === 'completado').length,
    cancelado: requests.filter(r => r.status === 'cancelado').length,
  };

  return {
    requests,
    brokers,
    stats,
    isLoading,
    error,
    refetch,
    createRequest: createRequest.mutateAsync,
    isCreating: createRequest.isPending,
    updateRequest: updateRequest.mutateAsync,
    isUpdating: updateRequest.isPending,
    updateRequestStatus: updateRequestStatus.mutateAsync,
    isUpdatingStatus: updateRequestStatus.isPending,
  };
}

export function useBrokerRequestDetail(id: string | undefined) {
  const { broker } = useBrokerAuth();

  return useQuery({
    queryKey: ['broker-request-detail', id],
    queryFn: async (): Promise<TransferRequest | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('transfer_requests')
        .select(`
          *,
          items:transfer_items(*),
          documents:transfer_documents(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching request detail:', error);
        throw error;
      }

      return {
        ...data,
        status: data.status as TransferRequestStatus,
        items: (data.items || []) as TransferItem[],
        documents: (data.documents || []) as unknown as TransferRequest['documents'],
      } as unknown as TransferRequest;
    },
    enabled: !!id && !!broker?.organization_id,
  });
}
