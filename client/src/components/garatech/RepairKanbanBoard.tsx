import { useState, useMemo } from 'react';
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
import { RepairKanbanColumn } from './RepairKanbanColumn';
import { RepairKanbanCard } from './RepairKanbanCard';
import { REPAIR_STATUS_COLUMNS, type Repair, type RepairStatus } from '@/types/garatech';

interface RepairKanbanBoardProps {
  repairs: Repair[];
  onRepairClick: (repair: Repair) => void;
  onStatusChange: (repair: Repair, newStatus: RepairStatus) => Promise<void>;
}

export function RepairKanbanBoard({
  repairs,
  onRepairClick,
  onStatusChange,
}: RepairKanbanBoardProps) {
  const [activeRepair, setActiveRepair] = useState<Repair | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group repairs by status
  const repairsByStatus = useMemo(() => {
    const grouped: Record<RepairStatus, Repair[]> = {
      pendiente_aprobacion: [],
      listo_entregar_taller: [],
      en_taller: [],
      esperando_piezas: [],
      listo_recoger: [],
      finalizado: [],
    };

    repairs.forEach((repair) => {
      if (grouped[repair.status]) {
        grouped[repair.status].push(repair);
      }
    });

    return grouped;
  }, [repairs]);

  const handleDragStart = (event: DragStartEvent) => {
    const repair = event.active.data.current?.repair as Repair | undefined;
    if (repair) {
      setActiveRepair(repair);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveRepair(null);

    if (!over) return;

    const repair = active.data.current?.repair as Repair | undefined;
    const newStatus = over.id as RepairStatus;

    if (repair && newStatus && repair.status !== newStatus) {
      await onStatusChange(repair, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {REPAIR_STATUS_COLUMNS.map((column) => (
          <RepairKanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            color={column.color}
            repairs={repairsByStatus[column.status] || []}
            onRepairClick={onRepairClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeRepair && (
          <div className="shadow-2xl rotate-2">
            <RepairKanbanCard
              repair={activeRepair}
              onClick={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
