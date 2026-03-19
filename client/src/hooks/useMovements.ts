import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type MovementType = 'entrega' | 'recogida' | 'escoba' | 'limpieza';
export type MovementStatus = 'en_curso' | 'completado' | 'cancelado';

export interface VehicleMovement {
  id: string;
  organization_id: string;
  vehicle_id: string | null;
  matricula: string;
  movement_type: MovementType;
  driver_id: string;
  reservation_id: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  started_at: string;
  ended_at: string | null;
  status: MovementStatus;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  driver?: { id: string; name: string | null };
}

export function useMovements(filters?: {
  status?: MovementStatus;
  movement_type?: MovementType;
  search?: string;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const movementsQuery = useQuery({
    queryKey: ['vehicle-movements', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('vehicle_movements')
        .select('*, driver:profiles!vehicle_movements_driver_id_fkey(id, name)')
        .eq('organization_id', profile.organization_id)
        .order('started_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.movement_type) {
        query = query.eq('movement_type', filters.movement_type);
      }
      if (filters?.search) {
        query = query.ilike('matricula', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as VehicleMovement[];
    },
    enabled: !!profile?.organization_id,
  });

  const startMovement = useMutation({
    mutationFn: async (input: {
      matricula: string;
      movement_type: MovementType;
      start_photo_url?: string;
      start_lat?: number;
      start_lng?: number;
      reservation_id?: string;
      vehicle_id?: string;
      notes?: string;
    }) => {
      if (!profile?.organization_id || !profile?.id) throw new Error('No auth');

      const { data, error } = await supabase
        .from('vehicle_movements')
        .insert({
          organization_id: profile.organization_id,
          matricula: input.matricula,
          movement_type: input.movement_type,
          driver_id: profile.id,
          start_photo_url: input.start_photo_url,
          start_lat: input.start_lat,
          start_lng: input.start_lng,
          reservation_id: input.reservation_id,
          vehicle_id: input.vehicle_id,
          notes: input.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-movements'] });
      toast({ title: 'Movimiento iniciado', description: 'El movimiento se ha registrado correctamente.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const endMovement = useMutation({
    mutationFn: async (input: {
      id: string;
      end_photo_url?: string;
      end_lat?: number;
      end_lng?: number;
    }) => {
      const { data, error } = await supabase
        .from('vehicle_movements')
        .update({
          end_photo_url: input.end_photo_url,
          end_lat: input.end_lat,
          end_lng: input.end_lng,
          ended_at: new Date().toISOString(),
          status: 'completado' as MovementStatus,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-movements'] });
      toast({ title: 'Movimiento finalizado', description: 'El movimiento se ha completado.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const cancelMovement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicle_movements')
        .update({ status: 'cancelado' as MovementStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-movements'] });
      toast({ title: 'Movimiento cancelado' });
    },
  });

  const deleteMovement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicle_movements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-movements'] });
      toast({ title: 'Movimiento eliminado', description: 'El movimiento se ha eliminado correctamente.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMovement = useMutation({
    mutationFn: async (input: {
      id: string;
      matricula?: string;
      movement_type?: MovementType;
      notes?: string | null;
      status?: MovementStatus;
      start_photo_url?: string;
      end_photo_url?: string;
      receipt_url?: string | null;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('vehicle_movements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-movements'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-movement'] });
      toast({ title: 'Movimiento actualizado' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    movements: movementsQuery.data || [],
    isLoading: movementsQuery.isLoading,
    error: movementsQuery.error,
    startMovement,
    endMovement,
    cancelMovement,
    deleteMovement,
    updateMovement,
    refetch: movementsQuery.refetch,
  };
}

export async function uploadMovementPhoto(file: Blob, orgId: string): Promise<string> {
  const filename = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from('movement-photos')
    .upload(filename, file, { contentType: 'image/jpeg' });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('movement-photos')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

export async function uploadMovementFile(file: File, orgId: string): Promise<string> {
  const ext = file.name.split('.').pop() || (file.type.includes('pdf') ? 'pdf' : 'jpg');
  const filename = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('movement-photos')
    .upload(filename, file, { contentType: file.type });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('movement-photos')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

export async function ocrPlate(imageBase64: string): Promise<{ plate: string; success: boolean }> {
  const { data, error } = await supabase.functions.invoke('ocr-plate', {
    body: { image_base64: imageBase64 },
  });
  if (error) throw error;
  return data;
}
