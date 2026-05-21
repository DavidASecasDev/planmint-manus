import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { VehicleLocation } from '@/types/vehicles';

export function useVehicleLocations() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Fetch all locations for the organization
  const { data: locations, isLoading } = useQuery({
    queryKey: ['vehicle-locations', orgId],
    queryFn: async (): Promise<VehicleLocation[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('vehicle_locations')
        .select('*')
        .eq('organization_id', orgId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as VehicleLocation[];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes - locations rarely change
  });

  // Create a new location
  const createLocationMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) throw new Error('No organization');

      const { data, error } = await supabase
        .from('vehicle_locations')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as VehicleLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-locations', orgId] });
      toast({
        title: 'Ubicación creada',
        description: 'La nueva ubicación está disponible.',
      });
    },
    onError: (error: Error) => {
      console.error('[useVehicleLocations] Create error:', error);
      const isDuplicate = error.message?.includes('duplicate') || error.message?.includes('unique');
      toast({
        title: 'Error',
        description: isDuplicate 
          ? 'Ya existe una ubicación con ese nombre.' 
          : 'No se pudo crear la ubicación.',
        variant: 'destructive',
      });
    },
  });

  // Delete a location (only non-default)
  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from('vehicle_locations')
        .delete()
        .eq('id', locationId)
        .eq('is_default', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-locations', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
      toast({
        title: 'Ubicación eliminada',
        description: 'La ubicación ha sido eliminada.',
      });
    },
    onError: (error) => {
      console.error('[useVehicleLocations] Delete error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la ubicación.',
        variant: 'destructive',
      });
    },
  });

  // Update vehicle location
  const updateVehicleLocationMutation = useMutation({
    mutationFn: async ({ vehicleId, locationId }: { vehicleId: string; locationId: string | null }) => {
      const { error } = await apiInvoke('update-vehicle-location', {
        body: {
          p_vehicle_id: vehicleId,
          p_location_id: locationId ?? undefined,
        },
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
    },
    onError: (error) => {
      console.error('[useVehicleLocations] Update vehicle location error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la ubicación del vehículo.',
        variant: 'destructive',
      });
    },
  });

  return {
    locations: locations || [],
    isLoading,
    createLocation: createLocationMutation.mutateAsync,
    isCreating: createLocationMutation.isPending,
    deleteLocation: deleteLocationMutation.mutate,
    isDeleting: deleteLocationMutation.isPending,
    updateVehicleLocation: updateVehicleLocationMutation.mutate,
    isUpdatingLocation: updateVehicleLocationMutation.isPending,
  };
}
