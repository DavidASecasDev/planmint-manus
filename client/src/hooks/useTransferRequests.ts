/**
 * Hook for internal Azul Cars transfer request management — simplified model
 * Supports: list, accept, reject, assign driver, update status, delete, clone
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  TransferRequest,
  TransferRequestStatus,
  TransferItem,
  TransferFilters,
  ClientType,
  VehicleType,
} from '@/types/transfers';

export interface CreateInternalRequestData {
  broker_name: string;
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
  items: Array<{
    direction: 'ida' | 'vuelta';
    transfer_date: string | null;
    transfer_time: string | null;
    pickup_location: string | null;
    pickup_lat?: number | null;
    pickup_lng?: number | null;
    pickup_place_id?: string | null;
    dropoff_location: string | null;
    dropoff_lat?: number | null;
    dropoff_lng?: number | null;
    dropoff_place_id?: string | null;
    vehicle_type: VehicleType;
    pax_count: number | null;
    flight_number?: string | null;
    notes?: string | null;
    baby_seats_count?: number | null;
    baby_seats?: Array<{ age: number; weight: number }> | null;
  }>;
}

export function useTransferRequests(filters?: Partial<TransferFilters>) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transfer-requests', orgId, filters],
    queryFn: async (): Promise<TransferRequest[]> => {
      if (!orgId) return [];

      let query = supabaseQuery
        .from('transfer_requests')
        .select(`
          *,
          items:transfer_items(id, transfer_date, transfer_time, status, pickup_location, dropoff_location, pax_count, vehicle_type, direction, driver_name, driver_phone, linked_item_id, flight_number, pickup_place_id, dropoff_place_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, position, notes, baby_seats_count, baby_seats)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.status && filters.status !== 'all') {
          // "aceptado" filter should include both 'aceptado' and 'conductor_asignado'
          if (filters.status === 'aceptado') {
            query = query.in('status', ['aceptado', 'conductor_asignado']);
          } else {
            query = query.eq('status', filters.status);
          }
        }
        if (filters.broker) {
          query = query.ilike('broker_name', `%${filters.broker}%`);
        }
        if (filters.clientType && filters.clientType !== 'all') {
          query = query.eq('client_type', filters.clientType);
        }
        if (filters.search) {
          query = query.or(`client_name.ilike.%${filters.search}%,request_number.ilike.%${filters.search}%,broker_name.ilike.%${filters.search}%`);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo + 'T23:59:59');
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process data to add computed fields
      let processed = (data || []).map((request: any) => {
        const items = request.items || [];
        const dates = items.map((i: any) => i.transfer_date).filter(Boolean).sort();
        return {
          ...request,
          items_count: items.length,
          first_transfer_date: dates[0] || null,
        };
      }) as TransferRequest[];

      // Filter by baby seats if requested
      if (filters?.hasBabySeats) {
        processed = processed.filter((req: any) =>
          req.items?.some((item: any) => item.baby_seats_count && item.baby_seats_count > 0)
        );
      }

      // Sort by first_transfer_date
      return processed.sort((a, b) => {
        if (!a.first_transfer_date && !b.first_transfer_date) return 0;
        if (!a.first_transfer_date) return 1;
        if (!b.first_transfer_date) return -1;
        return new Date(a.first_transfer_date).getTime() - new Date(b.first_transfer_date).getTime();
      });
    },
    enabled: !!orgId,
  });

  // Accept request
  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // 1. Get the full request with items before updating
      const { data: requestData, error: fetchErr } = await supabaseQuery
        .from('transfer_requests')
        .select('*, items:transfer_items(*)')
        .eq('id', requestId)
        .single();

      if (fetchErr || !requestData) throw new Error(fetchErr?.message || 'Request not found');

      // 2. Update request status to accepted
      const { error } = await supabaseQuery
        .from('transfer_requests')
        .update({
          status: 'aceptado',
          accepted_by: profile?.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw new Error(error.message);

      // 3. Update all pending items to accepted
      await supabaseQuery
        .from('transfer_items')
        .update({ status: 'aceptado' })
        .eq('request_id', requestId)
        .eq('status', 'pendiente');

      // 4. Auto-create reservation entries in Programación for each item
      const items = (requestData as any).items || [];
      for (const item of items) {
        // Duplicate protection: skip if a reservation already exists for this transfer_item
        const { data: existingRes } = await supabaseQuery
          .from('reservations')
          .select('id')
          .eq('transfer_item_id', item.id)
          .limit(1);

        if (existingRes && existingRes.length > 0) {
          console.log(`[Transfer Accept] Reservation already exists for item ${item.id}, skipping`);
          continue;
        }

        // Build the transfer datetime from date + time
        let transferDatetime: string | null = null;
        if (item.transfer_date) {
          let timePart = item.transfer_time || '00:00';
          // Normalize time: if already has seconds (HH:MM:SS), use as-is; otherwise append :00
          const timeSegments = timePart.split(':');
          if (timeSegments.length === 2) {
            timePart = `${timePart}:00`;
          }
          transferDatetime = `${item.transfer_date}T${timePart}`;
        }

        // Build direction label for notes
        const dirLabel = item.direction === 'vuelta' ? '[VUELTA]' : '[IDA]';
        const itemNotes = [
          dirLabel,
          item.notes,
          requestData.villa_name ? `Villa: ${requestData.villa_name}` : null,
          requestData.boat_name ? `Barco: ${requestData.boat_name}` : null,
          requestData.berth_number ? `Amarre: ${requestData.berth_number}` : null,
          item.flight_number ? `Vuelo: ${item.flight_number}` : null,
          item.pax_count ? `${item.pax_count} pax` : null,
        ].filter(Boolean).join(' | ');

        // Map vehicle_type to human-readable modelo
        const vehicleTypeMap: Record<string, string> = {
          'mercedes_vito': 'Mercedes Vito',
          'vito': 'Mercedes Vito',
          'mercedes_v_class': 'Mercedes V-Class',
          'v_class': 'Mercedes V-Class',
          'v-class': 'Mercedes V-Class',
          'iv_class': 'Mercedes V-Class',
          'sprinter': 'Mercedes Sprinter',
        };
        const vehicleModel = item.vehicle_type ? (vehicleTypeMap[item.vehicle_type.toLowerCase()] || item.vehicle_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())) : null;

        const reservationData = {
          organization_id: orgId,
          external_reservation_id: `TRF-${item.id}`,
          tipo_actividad: 'Transfer',
          cliente_nombre: requestData.client_name || requestData.broker_name || 'Transfer',
          telefono: requestData.client_phone || null,
          email: requestData.client_email || null,
          contacto: requestData.client_phone || null,
          desde: transferDatetime,
          confirmed_entrega_datetime: transferDatetime,
          lugar_entrega: item.pickup_location || null,
          lugar_devolucion: item.dropoff_location || null,
          lugar_entrega_direccion: item.pickup_location || null,
          lugar_devolucion_direccion: item.dropoff_location || null,
          modelo: vehicleModel,
          notas: itemNotes || null,
          origen_reserva: 'Transfer Broker',
          es_transferencia: true,
          transfer_completado: false,
          transfer_item_id: item.id,
          transfer_request_id: requestId,
          imported_by: profile?.id || null,
          extras_contratados: item.baby_seats_count && item.baby_seats_count > 0
            ? JSON.stringify(Array.from({ length: item.baby_seats_count }, (_, i) => {
                const seats = item.baby_seats ? (typeof item.baby_seats === 'string' ? JSON.parse(item.baby_seats) : item.baby_seats) : [];
                const seat = seats[i];
                return { nombre: `Sillita bebé${seat ? ` (${seat.age} años, ${seat.weight} kg)` : ''}`, cantidad: 1 };
              }))
            : null,
        };

        const { error: resError } = await supabaseQuery
          .from('reservations')
          .insert(reservationData);

        if (resError) {
          console.error('[Transfer Accept] Failed to create reservation:', resError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-request'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Solicitud aceptada — transfers añadidos a Programación');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reject request
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabaseQuery
        .from('transfer_requests')
        .update({
          status: 'rechazado',
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw new Error(error.message);

      // Cancel all items
      await supabaseQuery
        .from('transfer_items')
        .update({ status: 'cancelado' })
        .eq('request_id', requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-request'] });
      toast.success('Solicitud rechazada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Assign driver to an item
  const assignDriverMutation = useMutation({
    mutationFn: async ({ itemId, driverName, driverPhone }: { itemId: string; driverName: string; driverPhone: string }) => {
      const { error } = await supabaseQuery
        .from('transfer_items')
        .update({ driver_name: driverName, driver_phone: driverPhone })
        .eq('id', itemId);

      if (error) throw new Error(error.message);

      // Check if all items in the request have drivers assigned
      const { data: item } = await supabaseQuery
        .from('transfer_items')
        .select('request_id')
        .eq('id', itemId)
        .single();

      if (item) {
        const { data: allItems } = await supabaseQuery
          .from('transfer_items')
          .select('driver_name, status')
          .eq('request_id', (item as any).request_id)
          .neq('status', 'cancelado');

        const allAssigned = allItems?.every((i: any) => i.driver_name);
        if (allAssigned) {
          await supabaseQuery
            .from('transfer_requests')
            .update({ status: 'conductor_asignado', updated_at: new Date().toISOString() })
            .eq('id', (item as any).request_id);
        }
      }

      // Try to match driver_name to a profile and update the reservation's asignado_rental_id
      try {
        const { data: matchedProfile } = await supabaseQuery
          .from('profiles')
          .select('id, name')
          .ilike('name', driverName.trim())
          .limit(1)
          .single();

        if (matchedProfile) {
          // Find the reservation linked to this transfer_item and assign the driver
          const { data: reservation } = await supabaseQuery
            .from('reservations')
            .select('id')
            .eq('transfer_item_id', itemId)
            .limit(1)
            .single();

          if (reservation) {
            await supabaseQuery
              .from('reservations')
              .update({ asignado_rental_id: (matchedProfile as any).id })
              .eq('id', (reservation as any).id);
          }
        }
      } catch {
        // Non-critical: if name doesn't match any profile, skip silently
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-request'] });
      toast.success('Conductor asignado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update request status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TransferRequestStatus }) => {
      const { error } = await supabaseQuery
        .from('transfer_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-request'] });
      toast.success('Estado actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update item status
  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { error } = await supabaseQuery
        .from('transfer_items')
        .update({ status })
        .eq('id', itemId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-request'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete request
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabaseQuery.from('transfer_items').delete().eq('request_id', id);
      const { error } = await supabaseQuery.from('transfer_requests').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      toast.success('Solicitud eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Create internal request (Azul Cars creates directly)
  const createMutation = useMutation({
    mutationFn: async (data: CreateInternalRequestData) => {
      if (!orgId || !profile?.id) throw new Error('No session');

      const { count } = await supabaseQuery
        .from('transfer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const requestNumber = `TRF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

      const { data: newRequest, error: reqError } = await supabaseQuery
        .from('transfer_requests')
        .insert({
          organization_id: orgId,
          request_number: requestNumber,
          broker_name: data.broker_name,
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
          created_by: profile.id,
        })
        .select()
        .single();

      if (reqError || !newRequest) throw new Error(reqError?.message || 'Error creating request');

      const itemsToInsert = data.items.map((item, idx) => ({
        request_id: newRequest.id,
        organization_id: orgId,
        position: idx + 1,
        direction: item.direction,
        transfer_date: item.transfer_date || null,
        transfer_time: item.transfer_time || null,
        pickup_location: item.pickup_location || null,
        pickup_lat: item.pickup_lat || null,
        pickup_lng: item.pickup_lng || null,
        pickup_place_id: item.pickup_place_id || null,
        dropoff_location: item.dropoff_location || null,
        dropoff_lat: item.dropoff_lat || null,
        dropoff_lng: item.dropoff_lng || null,
        dropoff_place_id: item.dropoff_place_id || null,
        vehicle_type: item.vehicle_type,
        pax_count: item.pax_count,
        flight_number: item.flight_number || null,
        notes: item.notes || null,
        baby_seats_count: item.baby_seats_count || null,
        baby_seats: item.baby_seats ? JSON.stringify(item.baby_seats) : null,
        status: 'pendiente',
      }));

      await supabaseQuery.from('transfer_items').insert(itemsToInsert);
      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      toast.success('Solicitud creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Clone request
  const cloneMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = requests.find(r => r.id === requestId);
      if (!request || !orgId || !profile?.id) throw new Error('Request not found');

      const { count } = await supabaseQuery
        .from('transfer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      const requestNumber = `TRF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

      const { data: newRequest, error: reqError } = await supabaseQuery
        .from('transfer_requests')
        .insert({
          organization_id: orgId,
          request_number: requestNumber,
          broker_id: request.broker_id,
          broker_name: request.broker_name,
          status: 'pendiente',
          client_type: request.client_type,
          client_name: request.client_name,
          client_phone: request.client_phone,
          client_email: request.client_email,
          villa_name: request.villa_name,
          boat_name: request.boat_name,
          berth_number: request.berth_number,
          captain_name: request.captain_name,
          captain_phone: request.captain_phone,
          notes: request.notes,
          created_by: profile.id,
        })
        .select()
        .single();

      if (reqError || !newRequest) throw new Error(reqError?.message || 'Error cloning');

      if (request.items && request.items.length > 0) {
        const clonedItems = request.items.map((item, idx) => ({
          request_id: newRequest.id,
          organization_id: orgId,
          position: idx + 1,
          direction: item.direction,
          transfer_date: item.transfer_date,
          transfer_time: item.transfer_time,
          pickup_location: item.pickup_location,
          pickup_lat: item.pickup_lat,
          pickup_lng: item.pickup_lng,
          pickup_place_id: item.pickup_place_id,
          dropoff_location: item.dropoff_location,
          dropoff_lat: item.dropoff_lat,
          dropoff_lng: item.dropoff_lng,
          dropoff_place_id: item.dropoff_place_id,
          vehicle_type: item.vehicle_type,
          pax_count: item.pax_count,
          flight_number: item.flight_number,
          notes: item.notes,
          baby_seats_count: item.baby_seats_count || null,
          baby_seats: item.baby_seats || null,
          status: 'pendiente',
        }));

        await supabaseQuery.from('transfer_items').insert(clonedItems);
      }

      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      toast.success('Solicitud clonada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    requests,
    isLoading,
    error,
    refetch,
    acceptRequest: acceptMutation.mutateAsync,
    rejectRequest: rejectMutation.mutateAsync,
    assignDriver: assignDriverMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutate,
    updateItemStatus: updateItemStatusMutation.mutateAsync,
    deleteRequest: deleteMutation.mutate,
    createRequest: createMutation.mutateAsync,
    cloneRequest: cloneMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

export function useTransferRequest(id: string | undefined) {
  const { profile } = useAuth();

  const query = useQuery({
    queryKey: ['transfer-request', id],
    queryFn: async (): Promise<TransferRequest | null> => {
      if (!id) return null;

      const { data, error } = await supabaseQuery
        .from('transfer_requests')
        .select(`
          *,
          items:transfer_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching transfer request:', error);
        throw error;
      }

      const items = (data.items || []).map((item: unknown) => item as TransferItem);

      return {
        ...data,
        items,
      } as TransferRequest;
    },
    enabled: !!id && !!profile?.organization_id,
  });

  return query;
}
