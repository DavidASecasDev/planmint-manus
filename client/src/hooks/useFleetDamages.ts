import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { FleetVehicleDamage } from '@/types/fleet';

export function useFleetDamages(fleetVehicleId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: damages = [], isLoading, error } = useQuery({
    queryKey: ['fleet-damages', fleetVehicleId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .select('*')
        .eq('fleet_vehicle_id', fleetVehicleId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as FleetVehicleDamage[];
    },
    enabled: !!fleetVehicleId,
  });

  const createDamage = useMutation({
    mutationFn: async (damage: Omit<FleetVehicleDamage, 'id' | 'created_at' | 'resolved_at'>) => {
      const { data, error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .insert(damage as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-damages', fleetVehicleId] });
      toast.success('Daño registrado correctamente');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateDamage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetVehicleDamage> & { id: string }) => {
      const { data, error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-damages', fleetVehicleId] });
      toast.success('Daño actualizado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDamage = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .delete({ count: 'exact' })
        .eq('id', id);
      if (error) throw error;
      if (count === 0) throw new Error('No se pudo eliminar el daño. Verifica que tienes permisos suficientes.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-damages', fleetVehicleId] });
      toast.success('Daño eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pendingCount = damages.filter(d => d.status !== 'reparado').length;

  return { damages, isLoading, error, createDamage, updateDamage, deleteDamage, pendingCount };
}
