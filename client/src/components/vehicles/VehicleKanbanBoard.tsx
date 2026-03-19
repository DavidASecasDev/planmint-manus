import { useState, useCallback } from 'react';
import { VehicleKanbanColumn } from './VehicleKanbanColumn';
import { VehicleDetailsSheet } from './VehicleDetailsSheet';
import { VEHICLE_STATUS_COLUMNS, VehicleStatus, VehicleWithTasks } from '@/types/vehicles';

interface VehicleKanbanBoardProps {
  vehiclesByStatus: Record<VehicleStatus, VehicleWithTasks[]>;
  allVehicles: VehicleWithTasks[];
}

export function VehicleKanbanBoard({ vehiclesByStatus, allVehicles }: VehicleKanbanBoardProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {VEHICLE_STATUS_COLUMNS.map((column) => (
          <VehicleKanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            color={column.color}
            vehicles={vehiclesByStatus[column.status] || []}
            onSelectVehicle={handleSelectVehicle}
          />
        ))}
      </div>

      {/* Global Sheet - lives at board level, doesn't unmount when vehicles move columns */}
      <VehicleDetailsSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        vehicle={selectedVehicle}
      />
    </>
  );
}
