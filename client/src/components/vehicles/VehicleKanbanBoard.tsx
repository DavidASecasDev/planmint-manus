import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { VehicleKanbanColumn } from './VehicleKanbanColumn';
import { VehicleDetailsSheet } from './VehicleDetailsSheet';
import { VehicleCard } from './VehicleCard';
import { VEHICLE_STATUS_COLUMNS, VehicleStatus, VehicleWithTasks } from '@/types/vehicles';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiClient';

interface VehicleKanbanBoardProps {
  vehiclesByStatus: Record<VehicleStatus, VehicleWithTasks[]>;
  allVehicles: VehicleWithTasks[];
}

export function VehicleKanbanBoard({ vehiclesByStatus, allVehicles }: VehicleKanbanBoardProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeVehicle, setActiveVehicle] = useState<VehicleWithTasks | null>(null);

  const { isAdmin, hasPermission } = usePermissions();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Admin/owner can drag vehicles between columns
  const canDrag = isAdmin && hasPermission('vehicles.change_status');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Find the selected vehicle from the full list (so it persists even if it moves columns)
  const selectedVehicle = selectedVehicleId 
    ? allVehicles.find(v => v.id === selectedVehicleId) || null
    : null;

  const handleSelectVehicle = useCallback((vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setSheetOpen(true);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      // Small delay before clearing selection to allow closing animation
      setTimeout(() => setSelectedVehicleId(null), 200);
    }
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const vehicle = event.active.data.current?.vehicle as VehicleWithTasks | undefined;
    if (vehicle) {
      setActiveVehicle(vehicle);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveVehicle(null);

    if (!over) return;

    const vehicle = active.data.current?.vehicle as VehicleWithTasks | undefined;
    const newStatus = over.id as VehicleStatus;

    if (!vehicle || !newStatus || vehicle.status === newStatus) return;

    // All transitions are allowed for admin/owner
    try {
      const { data, error } = await apiInvoke<{ success: boolean; from_status: string; to_status: string }>('change-vehicle-status', {
        body: {
          vehicle_id: vehicle.id,
          new_status: newStatus,
          reason: 'Cambio manual por drag & drop',
        },
      });

      if (error) throw new Error(error.message);

      // Invalidate vehicle queries
      queryClient.invalidateQueries({ queryKey: ['vehicles', profile?.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-for-preparation'] });
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });

      const statusLabel = VEHICLE_STATUS_COLUMNS.find(c => c.status === newStatus)?.label || newStatus;
      toast.success(`${vehicle.matricula} movido a "${statusLabel}"`);
    } catch (err: any) {
      console.error('[VehicleKanbanBoard] Drag status change error:', err);
      toast.error('Error al cambiar estado', {
        description: err?.message || 'No se pudo completar el cambio.',
      });
    }
  };

  // All columns are valid targets (all transitions allowed)
  const validDropTargets = useMemo(() => {
    if (!activeVehicle) return new Set<VehicleStatus>();
    // All statuses except current are valid
    return new Set(
      VEHICLE_STATUS_COLUMNS
        .map(c => c.status)
        .filter(s => s !== activeVehicle.status)
    );
  }, [activeVehicle]);

  const boardContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 h-[calc(100vh-280px)] min-h-0">
      {VEHICLE_STATUS_COLUMNS.map((column) => (
        <VehicleKanbanColumn
          key={column.status}
          status={column.status}
          label={column.label}
          color={column.color}
          vehicles={vehiclesByStatus[column.status] || []}
          onSelectVehicle={handleSelectVehicle}
          canDrag={canDrag}
          isValidTarget={activeVehicle ? validDropTargets.has(column.status) : undefined}
          isDragging={!!activeVehicle}
        />
      ))}
    </div>
  );

  return (
    <>
      {canDrag ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {boardContent}

          <DragOverlay dropAnimation={null}>
            {activeVehicle && (
              <div className="shadow-2xl rotate-2 opacity-90 w-[220px]">
                <VehicleCard
                  vehicle={activeVehicle}
                  onSelect={() => {}}
                  isDragOverlay
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        boardContent
      )}

      {/* Global Sheet - lives at board level, doesn't unmount when vehicles move columns */}
      <VehicleDetailsSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        vehicle={selectedVehicle}
      />
    </>
  );
}
