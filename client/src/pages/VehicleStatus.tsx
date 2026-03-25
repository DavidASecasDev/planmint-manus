import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { PageHeader } from '@/components/ui/page-header';
import { VehicleKanbanBoard } from '@/components/vehicles/VehicleKanbanBoard';
import { VehicleToolbar } from '@/components/vehicles/VehicleToolbar';
import { VehicleFilters } from '@/components/vehicles/VehicleFilters';
import { InactiveVehiclesAlert } from '@/components/vehicles/InactiveVehiclesAlert';
import { FleetCleanupDialog } from '@/components/vehicles/FleetCleanupDialog';
import { ArchivedVehiclesSheet } from '@/components/vehicles/ArchivedVehiclesSheet';
import { ImportVehicles } from '@/components/vehicles/ImportVehicles';
import { useVehicles } from '@/hooks/useVehicles';
import { useVehicleLocations } from '@/hooks/useVehicleLocations';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Car, Loader2, ShieldAlert } from 'lucide-react';
import type { VehicleFilters as VehicleFiltersType, VehicleStatus, VehicleWithTasks } from '@/types/vehicles';

export default function VehicleStatus() {
  const { 
    vehicles, 
    isLoading, 
    syncVehicles, 
    isSyncing,
    archivedVehicles,
    archivedCount,
    inactiveVehicles,
    inactiveCount,
    archiveMultiple,
    isArchivingMultiple,
    restoreVehicle,
    isRestoring,
    deleteVehicle,
    isDeleting,
    canView,
    canManage,
    canSync,
    canImport,
    canArchive,
    canManageLocations,
    permissionsLoading,
  } = useVehicles();

  const { locations } = useVehicleLocations();

  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [archivedSheetOpen, setArchivedSheetOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Filter state
  const [filters, setFilters] = usePersistedFilters<VehicleFiltersType>({
    search: '',
    locationId: 'all',
    cleaningStatus: 'all',
  });

  // Apply filters to vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          vehicle.matricula.toLowerCase().includes(searchLower) ||
          (vehicle.modelo?.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Location filter
      if (filters.locationId !== 'all') {
        if (filters.locationId === 'none') {
          if (vehicle.location_id) return false;
        } else {
          if (vehicle.location_id !== filters.locationId) return false;
        }
      }

      // Cleaning status filter
      if (filters.cleaningStatus !== 'all') {
        const completedTasks = (vehicle.cleaning_tasks || []).filter(t => t.completed).length;
        const totalTasks = 6; // Fixed number of tasks
        
        if (filters.cleaningStatus === 'none' && completedTasks > 0) return false;
        if (filters.cleaningStatus === 'partial' && (completedTasks === 0 || completedTasks === totalTasks)) return false;
        if (filters.cleaningStatus === 'complete' && completedTasks !== totalTasks) return false;
      }

      return true;
    });
  }, [vehicles, filters]);

  // Group filtered vehicles by status
  const filteredVehiclesByStatus = useMemo(() => {
    return filteredVehicles.reduce((acc, vehicle) => {
      const status = vehicle.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(vehicle);
      return acc;
    }, {} as Record<VehicleStatus, VehicleWithTasks[]>);
  }, [filteredVehicles]);

  // Loading state
  if (permissionsLoading) {
    return (
      <AppLayout title="Estado de Coches">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!canView) {
    return (
      <AppLayout title="Estado de Coches">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver el estado de vehículos</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Estado de Coches">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <PageHeader
            title="Estado de Coches"
            description="Gestiona el estado de limpieza de la flota de vehículos"
          />
          <VehicleToolbar
            archivedCount={archivedCount}
            onOpenArchived={() => setArchivedSheetOpen(true)}
            onSync={syncVehicles}
            isSyncing={isSyncing}
            onOpenImport={() => setImportDialogOpen(true)}
            canSync={canSync}
            canImport={canImport}
            canArchive={canArchive}
            canManageLocations={canManageLocations}
          />
        </div>

        {/* Filters */}
        {!isLoading && vehicles.length > 0 && (
          <VehicleFilters
            filters={filters}
            onFiltersChange={setFilters}
            locations={locations}
            totalCount={vehicles.length}
            filteredCount={filteredVehicles.length}
          />
        )}

        {/* Alert for inactive vehicles */}
        {!isLoading && inactiveCount > 0 && (
          <InactiveVehiclesAlert
            count={inactiveCount}
            onReview={() => setCleanupDialogOpen(true)}
          />
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No hay vehículos"
            description="Sincroniza los vehículos desde las reservas para comenzar a gestionar el estado de la flota."
            action={{
              label: 'Sincronizar vehículos',
              onClick: () => syncVehicles(),
            }}
          />
        ) : (
          <VehicleKanbanBoard vehiclesByStatus={filteredVehiclesByStatus} allVehicles={filteredVehicles} />
        )}

        {/* Fleet Cleanup Dialog */}
        <FleetCleanupDialog
          open={cleanupDialogOpen}
          onOpenChange={setCleanupDialogOpen}
          inactiveVehicles={inactiveVehicles}
          onArchive={archiveMultiple}
          isArchiving={isArchivingMultiple}
        />

        {/* Archived Vehicles Sheet */}
        <ArchivedVehiclesSheet
          open={archivedSheetOpen}
          onOpenChange={setArchivedSheetOpen}
          vehicles={archivedVehicles}
          onRestore={restoreVehicle}
          onDelete={deleteVehicle}
          isRestoring={isRestoring}
          isDeleting={isDeleting}
        />

        {/* Import Vehicles Dialog */}
        <ImportVehicles
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />
      </div>
    </AppLayout>
  );
}
