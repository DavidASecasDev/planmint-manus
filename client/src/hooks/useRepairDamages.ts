import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { FleetVehicleDamage } from '@/types/fleet';

/**
 * Hook to manage the relationship between a repair and vehicle damages.
 * Given a repair's vehicle_id, it resolves the fleet_vehicle_id and fetches
 * all damages for that vehicle, allowing linking/unlinking damages to the repair.
 */
export function useRepairDamages(vehicleId: string | null | undefined, repairId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Step 1: Resolve fleet_vehicle_id from vehicle_id
  const { data: fleetVehicleId } = useQuery({
    queryKey: ['vehicle-fleet-id', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;
      const { data, error } = await supabaseQuery
        .from('vehicles')
        .select('fleet_vehicle_id')
        .eq('id', vehicleId)
        .single();
      if (error || !data) return null;
      return (data as any).fleet_vehicle_id as string | null;
    },
    enabled: !!vehicleId,
  });

  // Step 2: Fetch all damages for this fleet vehicle
  const { data: damages = [], isLoading } = useQuery({
    queryKey: ['repair-vehicle-damages', fleetVehicleId],
    queryFn: async () => {
      if (!fleetVehicleId) return [];
      const { data, error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .select('*')
        .eq('fleet_vehicle_id', fleetVehicleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as FleetVehicleDamage[];
    },
    enabled: !!fleetVehicleId,
  });

  // Damages linked to this specific repair
  const linkedDamages = damages.filter(d => d.repair_id === repairId);
  // Damages that are pending (not repaired) and not linked to another repair
  const availableDamages = damages.filter(d => d.status !== 'reparado' && (!d.repair_id || d.repair_id === repairId));

  // Link a damage to this repair
  const linkDamage = useMutation({
    mutationFn: async (damageId: string) => {
      const { error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .update({ repair_id: repairId, status: 'en_reparacion' } as any)
        .eq('id', damageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-vehicle-damages', fleetVehicleId] });
      toast.success('Daño vinculado a esta reparación');
    },
    onError: () => toast.error('Error al vincular daño'),
  });

  // Unlink a damage from this repair
  const unlinkDamage = useMutation({
    mutationFn: async (damageId: string) => {
      const { error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .update({ repair_id: null, status: 'pendiente' } as any)
        .eq('id', damageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-vehicle-damages', fleetVehicleId] });
      toast.success('Daño desvinculado de esta reparación');
    },
    onError: () => toast.error('Error al desvincular daño'),
  });

  // Mark all linked damages as repaired (called when repair is finalized)
  const markLinkedAsRepaired = useMutation({
    mutationFn: async () => {
      if (linkedDamages.length === 0) return;
      const ids = linkedDamages.map(d => d.id);
      const { error } = await supabaseQuery
        .from('fleet_vehicle_damages')
        .update({ status: 'reparado', resolved_at: new Date().toISOString() } as any)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-vehicle-damages', fleetVehicleId] });
      toast.success('Daños marcados como reparados');
    },
    onError: () => toast.error('Error al actualizar daños'),
  });

  return {
    damages,
    linkedDamages,
    availableDamages,
    isLoading: isLoading || !fleetVehicleId,
    hasFleetVehicle: !!fleetVehicleId,
    linkDamage,
    unlinkDamage,
    markLinkedAsRepaired,
  };
}
