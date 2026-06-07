import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';
import { apiInvoke } from '@/lib/apiClient';
import type { Vehicle, VehicleWithTasks, VehicleCleaningTask, VehicleStatus, CleaningTaskKey, InactiveVehicle, ServiceType } from '@/types/vehicles';

export function useVehicles() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = !permissionsLoading && hasPermission('vehicles.view');
  const canManage = !permissionsLoading && hasPermission('vehicles.manage');
  const canChangeStatus = !permissionsLoading && hasPermission('vehicles.change_status');
  const canCompleteTasks = !permissionsLoading && hasPermission('vehicles.complete_tasks');
  const canManageLocations = !permissionsLoading && hasPermission('vehicles.manage_locations');
  const canSync = !permissionsLoading && hasPermission('vehicles.sync');
  const canImport = !permissionsLoading && hasPermission('vehicles.import');
  const canArchive = !permissionsLoading && hasPermission('vehicles.archive');
  const canUpdate = !permissionsLoading && hasPermission('vehicles.update');

  // Fetch all non-archived vehicles with their cleaning tasks
  const { data: vehicles, isLoading, error, refetch } = useQuery({
    queryKey: ['vehicles', orgId],
    queryFn: async (): Promise<VehicleWithTasks[]> => {
      if (!orgId) return [];

      // Fetch only non-archived vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('organization_id', orgId)
        .or('is_archived.eq.false,is_archived.is.null')
        .order('matricula', { ascending: true });

      if (vehiclesError) throw vehiclesError;
      if (!vehiclesData || vehiclesData.length === 0) return [];

      // Fetch cleaning tasks for all vehicles with profile names for completed_by
      const vehicleIds = vehiclesData.map(v => v.id);
      const { data: tasksData, error: tasksError } = await supabase
        .from('vehicle_cleaning_tasks')
        .select(`
          *,
          completed_by_profile:profiles!vehicle_cleaning_tasks_completed_by_fkey(name)
        `)
        .in('vehicle_id', vehicleIds);

      if (tasksError) throw tasksError;

      // Fetch current reservations for vehicles that are rented
      const rentedVehicles = vehiclesData.filter(v => v.current_reservation_id);
      let reservationsMap: Record<string, { cliente_nombre: string | null; cliente_apellido: string | null }> = {};
      
      if (rentedVehicles.length > 0) {
        const reservationIds = rentedVehicles.map(v => v.current_reservation_id).filter(Boolean) as string[];
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select('id, cliente_nombre, cliente_apellido')
          .in('id', reservationIds);
        
        if (reservationsData) {
          reservationsMap = reservationsData.reduce((acc, r) => {
            acc[r.id] = { cliente_nombre: r.cliente_nombre, cliente_apellido: r.cliente_apellido };
            return acc;
          }, {} as Record<string, { cliente_nombre: string | null; cliente_apellido: string | null }>);
        }
      }

      // Fetch locations for vehicles that have location_id
      const locationIds = vehiclesData.map(v => v.location_id).filter(Boolean) as string[];
      let locationsMap: Record<string, { id: string; name: string }> = {};
      
      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('vehicle_locations')
          .select('id, name')
          .in('id', locationIds);
        
        if (locationsData) {
          locationsMap = locationsData.reduce((acc, l) => {
            acc[l.id] = l;
            return acc;
          }, {} as Record<string, { id: string; name: string }>);
        }
      }

      // Fetch cleaned_by profiles
      const cleanedByIds = vehiclesData.map(v => v.cleaned_by).filter(Boolean) as string[];
      let cleanedByMap: Record<string, { name: string | null }> = {};
      
      if (cleanedByIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', cleanedByIds);
        
        if (profilesData) {
          cleanedByMap = profilesData.reduce((acc, p) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {} as Record<string, { name: string | null }>);
        }
      }

      // Fetch fleet vehicle info for linked vehicles
      const fleetVehicleIds = vehiclesData.map(v => (v as any).fleet_vehicle_id).filter(Boolean) as string[];
      let fleetInfoMap: Record<string, any> = {};

      if (fleetVehicleIds.length > 0) {
        const { data: fleetData } = await supabase
          .from('fleet_vehicles')
          .select('id, marca, color, combustible, numero_bastidor, numero_contrato, proveedor, fecha_inicio_contrato, fecha_fin_contrato, km_recogida, km_devolucion, photo_url')
          .in('id', fleetVehicleIds);

        if (fleetData) {
          fleetInfoMap = fleetData.reduce((acc, f) => {
            acc[f.id] = f;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Fetch active repairs for vehicles in repair
      const repairVehicleIds = vehiclesData
        .filter(v => (v as any).is_in_repair && (v as any).current_repair_id)
        .map(v => (v as any).current_repair_id) as string[];
      let repairsMap: Record<string, any> = {};

      if (repairVehicleIds.length > 0) {
        const { data: repairsData } = await supabase
          .from('repairs')
          .select('id, repair_type, description, status')
          .in('id', repairVehicleIds);

        if (repairsData) {
          repairsMap = repairsData.reduce((acc, r) => {
            acc[r.id] = r;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Map tasks to vehicles
      const vehiclesWithTasks: VehicleWithTasks[] = vehiclesData.map(vehicle => {
        const v = vehicle as any;
        return {
          ...vehicle,
          status: vehicle.status as VehicleStatus,
          service_type: vehicle.service_type as ServiceType | null,
          fleet_vehicle_id: v.fleet_vehicle_id || null,
          is_in_repair: v.is_in_repair || false,
          current_repair_id: v.current_repair_id || null,
          cleaning_tasks: (tasksData || [])
            .filter(t => t.vehicle_id === vehicle.id)
            .map(t => ({
              ...t,
              task_key: t.task_key as CleaningTaskKey,
              completed_by_profile: t.completed_by_profile || null,
            })),
          current_reservation: vehicle.current_reservation_id 
            ? reservationsMap[vehicle.current_reservation_id] || null
            : null,
          location: vehicle.location_id 
            ? locationsMap[vehicle.location_id] as VehicleWithTasks['location']
            : null,
          cleaned_by_profile: vehicle.cleaned_by
            ? cleanedByMap[vehicle.cleaned_by] || null
            : null,
          fleet_info: v.fleet_vehicle_id
            ? fleetInfoMap[v.fleet_vehicle_id] || null
            : null,
          active_repair: v.current_repair_id
            ? repairsMap[v.current_repair_id] || null
            : null,
        };
      });

      return vehiclesWithTasks;
    },
    enabled: !!orgId,
  });

  // Fetch archived vehicles
  const { data: archivedVehicles, isLoading: isLoadingArchived } = useQuery({
    queryKey: ['vehicles-archived', orgId],
    queryFn: async (): Promise<Vehicle[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Vehicle[];
    },
    enabled: !!orgId,
  });

  // Fetch inactive vehicles candidates
  const { data: inactiveVehicles, isLoading: isLoadingInactive, refetch: refetchInactive } = useQuery({
    queryKey: ['vehicles-inactive', orgId],
    queryFn: async (): Promise<InactiveVehicle[]> => {
      if (!orgId) return [];

      const { data, error } = await apiInvoke<InactiveVehicle[]>('get-inactive-vehicles', {
        body: { p_org_id: orgId },
      });

      if (error) throw new Error(error.message);
      return (data || []) as InactiveVehicle[];
    },
    enabled: !!orgId,
  });

  // Sync vehicles from reservations
  const syncVehiclesMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization');
      
      const { data, error } = await apiInvoke<{ vehicles_created: number; vehicles_updated: number; vehicles_released: number }>('sync-rently', {
        body: { action: 'sync_vehicles' },
      });

      if (error) throw new Error(error.message);
      const result = data;
      const totals = result || { vehicles_created: 0, vehicles_updated: 0, vehicles_released: 0 };
      return totals.vehicles_created + totals.vehicles_updated + totals.vehicles_released;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-inactive', orgId] });
      toast({
        title: 'Sincronización completada',
        description: `Se procesaron ${count} vehículos desde las reservas.`,
      });
    },
    onError: (error) => {
      console.error('[useVehicles] Sync error:', error);
      toast({
        title: 'Error al sincronizar',
        description: 'No se pudieron sincronizar los vehículos.',
        variant: 'destructive',
      });
    },
  });

  // Toggle a cleaning task - with optimistic update to avoid Sheet closing
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed, vehicleId, taskKey }: { taskId: string; completed: boolean; vehicleId?: string; taskKey?: string }) => {
      // Verify we have the user profile before proceeding
      if (!profile?.id) {
        throw new Error('No se pudo identificar el usuario');
      }
      
      const { error } = await supabase
        .from('vehicle_cleaning_tasks')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? profile.id : null,
        })
        .eq('id', taskId);

      if (error) throw error;

      // Record in cleaning history when completing a task
      if (completed && vehicleId && taskKey && orgId) {
        await supabase
          .from('vehicle_cleaning_history')
          .insert({
            organization_id: orgId,
            vehicle_id: vehicleId,
            task_key: taskKey,
            completed_by: profile.id,
            completed_at: new Date().toISOString(),
          });
      }

      // Auto-transition to 'limpio' is handled by DB trigger (auto_transition_vehicle_to_clean)
      
      return { taskId, completed, vehicleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
      // Vehicle may transition to 'limpio' via DB trigger, refresh preparation lists
      queryClient.invalidateQueries({ queryKey: ['vehicles-for-preparation'] });
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
    },
    onError: (error) => {
      console.error('[useVehicles] Toggle task error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la tarea.',
        variant: 'destructive',
      });
      // Refetch on error to sync with server state
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
    },
  });

  // Archive a vehicle
  const archiveVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('vehicles')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: profile.id,
        })
        .eq('id', vehicleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-archived', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-inactive', orgId] });
      toast({
        title: 'Vehículo archivado',
        description: 'El vehículo se ha movido a archivados.',
      });
    },
    onError: (error) => {
      console.error('[useVehicles] Archive error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo archivar el vehículo.',
        variant: 'destructive',
      });
    },
  });

  // Archive multiple vehicles
  const archiveMultipleMutation = useMutation({
    mutationFn: async (vehicleIds: string[]) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('vehicles')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: profile.id,
        })
        .in('id', vehicleIds);

      if (error) throw error;
      return vehicleIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-archived', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-inactive', orgId] });
      toast({
        title: 'Vehículos archivados',
        description: `Se archivaron ${count} vehículos correctamente.`,
      });
    },
    onError: (error) => {
      console.error('[useVehicles] Archive multiple error:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron archivar los vehículos.',
        variant: 'destructive',
      });
    },
  });

  // Restore a vehicle
  const restoreVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase
        .from('vehicles')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
        })
        .eq('id', vehicleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-archived', orgId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-inactive', orgId] });
      toast({
        title: 'Vehículo restaurado',
        description: 'El vehículo ha vuelto a la flota activa.',
      });
    },
    onError: (error) => {
      console.error('[useVehicles] Restore error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo restaurar el vehículo.',
        variant: 'destructive',
      });
    },
  });

  // Update task notes (for maintenance alerts)
  const updateTaskNotesMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      const { error } = await supabase
        .from('vehicle_cleaning_tasks')
        .update({ notes })
        .eq('id', taskId);

      if (error) throw error;
      return { taskId, notes };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
    },
    onError: (error) => {
      console.error('[useVehicles] Update notes error:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las notas.',
        variant: 'destructive',
      });
    },
  });

  // Delete a vehicle permanently (only archived ones)
  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      // First delete cleaning tasks
      await supabase
        .from('vehicle_cleaning_tasks')
        .delete()
        .eq('vehicle_id', vehicleId);

      // Then delete the vehicle
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId)
        .eq('is_archived', true); // Safety: only delete archived

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles-archived', orgId] });
      toast({
        title: 'Vehículo eliminado',
        description: 'El vehículo ha sido eliminado permanentemente.',
      });
    },
    onError: (error) => {
      console.error('[useVehicles] Delete error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el vehículo.',
        variant: 'destructive',
      });
    },
  });

  // Get vehicles grouped by status
  const vehiclesByStatus = (vehicles || []).reduce((acc, vehicle) => {
    const status = vehicle.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(vehicle);
    return acc;
  }, {} as Record<VehicleStatus, VehicleWithTasks[]>);

  return {
    vehicles: vehicles || [],
    vehiclesByStatus,
    archivedVehicles: archivedVehicles || [],
    archivedCount: archivedVehicles?.length || 0,
    inactiveVehicles: inactiveVehicles || [],
    inactiveCount: inactiveVehicles?.length || 0,
    isLoading,
    isLoadingArchived,
    isLoadingInactive,
    error,
    refetch,
    refetchInactive,
    syncVehicles: syncVehiclesMutation.mutate,
    isSyncing: syncVehiclesMutation.isPending,
    toggleTask: toggleTaskMutation.mutate,
    isTogglingTask: toggleTaskMutation.isPending,
    archiveVehicle: archiveVehicleMutation.mutate,
    isArchiving: archiveVehicleMutation.isPending,
    archiveMultiple: archiveMultipleMutation.mutate,
    isArchivingMultiple: archiveMultipleMutation.isPending,
    restoreVehicle: restoreVehicleMutation.mutate,
    isRestoring: restoreVehicleMutation.isPending,
    deleteVehicle: deleteVehicleMutation.mutate,
    isDeleting: deleteVehicleMutation.isPending,
    updateTaskNotes: updateTaskNotesMutation.mutate,
    isUpdatingNotes: updateTaskNotesMutation.isPending,
    canView,
    canManage,
    canChangeStatus,
    canCompleteTasks,
    canManageLocations,
    canSync,
    canImport,
    canArchive,
    canUpdate,
    permissionsLoading,
  };
}
