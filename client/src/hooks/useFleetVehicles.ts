import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { FleetVehicle } from '@/types/fleet';

export function useFleetVehicles() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: vehicles = [], isLoading, error } = useQuery({
    queryKey: ['fleet-vehicles', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('organization_id', orgId!)
        .order('matricula');
      if (error) throw error;
      return data as FleetVehicle[];
    },
    enabled: !!orgId,
  });

  const createVehicle = useMutation({
    mutationFn: async (vehicle: Omit<FleetVehicle, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .insert({ ...vehicle, organization_id: orgId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      toast.success('Vehículo creado correctamente');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetVehicle> & { id: string }) => {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      toast.success('Vehículo actualizado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fleet_vehicles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      toast.success('Vehículo eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importVehicles = useMutation({
    mutationFn: async (vehicles: Array<{ matricula: string; modelo?: string; categoria?: string; proveedor?: string; numero_contrato?: string; fecha_inicio_contrato?: string; fecha_fin_contrato?: string; numero_bastidor?: string; marca?: string; color?: string; combustible?: string; hibrido?: boolean; motor?: string; cv?: number }>) => {
      const rows = vehicles.map(v => ({ ...v, matricula: v.matricula.trim().toUpperCase(), organization_id: orgId! }));
      const { error } = await supabase.from('fleet_vehicles').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      toast.success(`${vars.length} vehículos importados correctamente`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { vehicles, isLoading, error, createVehicle, updateVehicle, deleteVehicle, importVehicles };
}

export function useFleetVehicle(id: string | undefined) {
  return useQuery({
    queryKey: ['fleet-vehicle', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as FleetVehicle;
    },
    enabled: !!id,
  });
}
