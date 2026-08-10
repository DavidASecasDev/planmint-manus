/**
 * Hook for broker portal transfer requests — simplified model
 * Brokers create requests, Azul Cars accepts/rejects and assigns drivers.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { toast } from 'sonner';
import type { TransferRequest, TransferRequestStatus, TransferItem, ClientType, VehicleType, TransferDirection } from '@/types/transfers';

export interface BrokerFilters {
  search?: string;
  status?: TransferRequestStatus | 'all';
  brokerId?: string | 'all';
}

export interface BrokerRequestItemData {
  direction: TransferDirection;
  transfer_date: string | null;
  transfer_time: string | null;
  pickup_location: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_place_id: string | null;
  dropoff_location: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_place_id: string | null;
  vehicle_type: VehicleType;
  pax_count: number | null;
  flight_number: string | null;
  notes: string | null;
  linked_item_id?: string | null;
  baby_seats_count?: number | null;
  baby_seats?: Array<{ age: number; weight: number }> | null;
  luggage_count?: number | null;
  vans_needed?: number | null;
}

export interface CreateBrokerRequestData {
  client_type: ClientType;
  client_name: string;
  client_phone: string;
  client_email?: string;
  villa_name?: string;
  boat_name?: string;
  berth_number?: string;
  captain_name?: string;
  captain_phone?: string;
  notes?: string;
  items: BrokerRequestItemData[];
}

export interface UpdateBrokerRequestData {
  id: string;
  client_type: ClientType;
  client_name: string;
  client_phone: string;
  client_email?: string;
  villa_name?: string;
  boat_name?: string;
  berth_number?: string;
  captain_name?: string;
  captain_phone?: string;
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

      let query = supabaseQuery
        .from('transfer_requests')
        .select(`
          *,
          items:transfer_items(id, transfer_date, transfer_time, status, pickup_location, dropoff_location, pax_count, vehicle_type, direction, driver_name, driver_phone, linked_item_id, pickup_place_id, dropoff_place_id, baby_seats_count, baby_seats, luggage_count, vans_needed)
        `)
        .eq('organization_id', broker.organization_id)
        .order('created_at', { ascending: false });

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

      return (data || []) as TransferRequest[];
    },
    enabled: !!broker?.organization_id,
  });

  // Stats
  const stats = useMemo(() => {
    const total = requests.length;
    const pendiente = requests.filter(r => r.status === 'pendiente').length;
    const aceptado = requests.filter(r => r.status === 'aceptado' || r.status === 'conductor_asignado').length;
    const en_curso = requests.filter(r => r.status === 'en_curso').length;
    const completado = requests.filter(r => r.status === 'completado').length;
    return { total, pendiente, aceptado, en_curso, completado };
  }, [requests]);

  // Brokers list (all brokers in the organization)
  const [brokers, setBrokers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!broker?.organization_id) return;
    supabaseQuery
      .from('transfer_brokers')
      .select('id, name')
      .eq('organization_id', broker.organization_id)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setBrokers(data);
      });
  }, [broker?.organization_id]);

  const [createStep, setCreateStep] = useState<string | null>(null);

  // Create request mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateBrokerRequestData) => {
      if (!broker?.id) throw new Error('Sesión de broker no válida. Cierra sesión y vuelve a iniciar.');
      if (!broker?.organization_id) throw new Error('Tu perfil no está vinculado a una organización. Contacta con tu administrador.');
      if (!broker?.broker_id) throw new Error('Tu perfil de broker no está correctamente configurado. Contacta con tu administrador para que vincule tu cuenta.');

      setCreateStep('Generando número...');
      // Generate request number
      const { count } = await supabaseQuery
        .from('transfer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', broker.organization_id);

      const requestNumber = `TRF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

      setCreateStep('Creando solicitud...');
      // Create parent request
      const { data: newRequest, error: reqError } = await supabaseQuery
        .from('transfer_requests')
        .insert({
          organization_id: broker.organization_id,
          request_number: requestNumber,
          broker_id: broker.id,
          broker_name: broker.name,
          status: 'pendiente',
          client_type: data.client_type,
          client_name: data.client_name,
          client_phone: data.client_phone || null,
          client_email: data.client_email || null,
          villa_name: data.client_type === 'villa' ? (data.villa_name || null) : null,
          boat_name: data.client_type === 'charter' ? (data.boat_name || null) : null,
          berth_number: data.client_type === 'charter' ? (data.berth_number || null) : null,
          captain_name: data.client_type === 'charter' ? (data.captain_name || null) : null,
          captain_phone: data.client_type === 'charter' ? (data.captain_phone || null) : null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (reqError || !newRequest) {
        throw new Error(reqError?.message || 'Error creating request');
      }

      setCreateStep('Añadiendo servicios...');
      // Create items
      const itemsToInsert = data.items.map((item, idx) => ({
        request_id: newRequest.id,
        organization_id: broker.organization_id,
        position: idx + 1,
        direction: item.direction,
        transfer_date: item.transfer_date || null,
        transfer_time: item.transfer_time || null,
        pickup_location: item.pickup_location || null,
        pickup_lat: item.pickup_lat,
        pickup_lng: item.pickup_lng,
        pickup_place_id: item.pickup_place_id || null,
        dropoff_location: item.dropoff_location || null,
        dropoff_lat: item.dropoff_lat,
        dropoff_lng: item.dropoff_lng,
        dropoff_place_id: item.dropoff_place_id || null,
        vehicle_type: item.vehicle_type,
        pax_count: item.pax_count,
        flight_number: item.flight_number || null,
        notes: item.notes || null,
        baby_seats_count: item.baby_seats_count || null,
        baby_seats: item.baby_seats ? JSON.stringify(item.baby_seats) : null,
        luggage_count: item.luggage_count || null,
        vans_needed: item.vans_needed || 1,
        status: 'pendiente',
      }));

      const { data: insertedItems, error: itemsError } = await supabaseQuery
        .from('transfer_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      setCreateStep('Vinculando servicios...');
      // Link return items to their outbound counterparts
      if (insertedItems && insertedItems.length > 1) {
        const outboundItems = insertedItems.filter((i: any) => i.direction === 'ida');
        const returnItems = insertedItems.filter((i: any) => i.direction === 'vuelta');
        
        for (const returnItem of returnItems) {
          // Find the corresponding outbound item (the one just before it in position)
          const outbound = outboundItems.find((o: any) => o.position === (returnItem as any).position - 1);
          if (outbound) {
            await supabaseQuery
              .from('transfer_items')
              .update({ linked_item_id: (outbound as any).id })
              .eq('id', (returnItem as any).id);
            // Also link the outbound to the return
            await supabaseQuery
              .from('transfer_items')
              .update({ linked_item_id: (returnItem as any).id })
              .eq('id', (outbound as any).id);
          }
        }
      }

      return newRequest;
    },
    onSuccess: () => {
      setCreateStep(null);
      queryClient.invalidateQueries({ queryKey: ['broker-requests'] });
      toast.success('Solicitud creada correctamente');
    },
    onError: (error: Error) => {
      setCreateStep(null);
      toast.error(`Error al crear solicitud: ${error.message}`);
    },
  });

  // Update request mutation (only when status is pendiente)
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateBrokerRequestData) => {
      if (!broker?.organization_id) throw new Error('Tu perfil no está vinculado a una organización. Contacta con tu administrador.');

      // Update parent request
      const { error: reqError } = await supabaseQuery
        .from('transfer_requests')
        .update({
          client_type: data.client_type,
          client_name: data.client_name,
          client_phone: data.client_phone || null,
          client_email: data.client_email || null,
          villa_name: data.client_type === 'villa' ? (data.villa_name || null) : null,
          boat_name: data.client_type === 'charter' ? (data.boat_name || null) : null,
          berth_number: data.client_type === 'charter' ? (data.berth_number || null) : null,
          captain_name: data.client_type === 'charter' ? (data.captain_name || null) : null,
          captain_phone: data.client_type === 'charter' ? (data.captain_phone || null) : null,
          notes: data.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .eq('status', 'pendiente');

      if (reqError) throw new Error(reqError.message);

      // Delete existing items and recreate
      await supabaseQuery
        .from('transfer_items')
        .delete()
        .eq('request_id', data.id);

      // Recreate items
      const itemsToInsert = data.items.map((item, idx) => ({
        request_id: data.id,
        organization_id: broker.organization_id,
        position: idx + 1,
        direction: item.direction,
        transfer_date: item.transfer_date || null,
        transfer_time: item.transfer_time || null,
        pickup_location: item.pickup_location || null,
        pickup_lat: item.pickup_lat,
        pickup_lng: item.pickup_lng,
        pickup_place_id: item.pickup_place_id || null,
        dropoff_location: item.dropoff_location || null,
        dropoff_lat: item.dropoff_lat,
        dropoff_lng: item.dropoff_lng,
        dropoff_place_id: item.dropoff_place_id || null,
        vehicle_type: item.vehicle_type,
        pax_count: item.pax_count,
        flight_number: item.flight_number || null,
        notes: item.notes || null,
        baby_seats_count: item.baby_seats_count || null,
        baby_seats: item.baby_seats ? JSON.stringify(item.baby_seats) : null,
        luggage_count: item.luggage_count || null,
        vans_needed: item.vans_needed || 1,
        status: 'pendiente',
      }));

      const { data: insertedItems, error: itemsError } = await supabaseQuery
        .from('transfer_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw new Error(itemsError.message);

      // Link return items
      if (insertedItems && insertedItems.length > 1) {
        const outboundItems = insertedItems.filter((i: any) => i.direction === 'ida');
        const returnItems = insertedItems.filter((i: any) => i.direction === 'vuelta');
        
        for (const returnItem of returnItems) {
          const outbound = outboundItems.find((o: any) => o.position === (returnItem as any).position - 1);
          if (outbound) {
            await supabaseQuery
              .from('transfer_items')
              .update({ linked_item_id: (outbound as any).id })
              .eq('id', (returnItem as any).id);
            await supabaseQuery
              .from('transfer_items')
              .update({ linked_item_id: (returnItem as any).id })
              .eq('id', (outbound as any).id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-requests'] });
      toast.success('Solicitud actualizada correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  // Cancel request mutation (broker can cancel at any status)
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabaseQuery
        .from('transfer_requests')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw new Error(error.message);

      // Also cancel all pending items
      await supabaseQuery
        .from('transfer_items')
        .update({ status: 'cancelado' })
        .eq('request_id', requestId)
        .in('status', ['pendiente', 'aceptado']);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-requests'] });
      toast.success('Solicitud cancelada');
    },
    onError: (error: Error) => {
      toast.error(`Error al cancelar: ${error.message}`);
    },
  });

  return {
    requests,
    brokers,
    stats,
    isLoading,
    error,
    refetch,
    createRequest: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createStep,
    createError: createMutation.error,
    resetCreateError: createMutation.reset,
    updateRequest: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    cancelRequest: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}
