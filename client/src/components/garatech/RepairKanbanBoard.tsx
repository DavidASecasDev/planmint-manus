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
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { RepairKanbanColumn } from './RepairKanbanColumn';
import { RepairKanbanCard } from './RepairKanbanCard';
import {
  REPAIR_STATUS_COLUMNS,
  REPAIR_STATUS_LABELS,
  VALID_REPAIR_TRANSITIONS,
  type Repair,
  type RepairStatus,
} from '@/types/garatech';

interface RepairKanbanBoardProps {
  repairs: Repair[];
  onRepairClick: (repair: Repair) => void;
  onStatusChange: (repair: Repair, newStatus: RepairStatus) => Promise<void>;
}

// Snap drop animation config
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
  duration: 250,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
};

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

    // Resolve target status: if dropped on a card, get the card's parent column status;
    // if dropped on the column droppable itself, over.id IS the status.
    let newStatus: RepairStatus;
    const overRepair = over.data.current?.repair as Repair | undefined;
    if (overRepair) {
      // Dropped on another card — use that card's status as the target column
      newStatus = overRepair.status;
    } else {
      // Dropped on the column droppable area
      newStatus = over.id as RepairStatus;
    }

    if (!repair || !newStatus || repair.status === newStatus) return;

    // Validate the transition
    const allowedTransitions = VALID_REPAIR_TRANSITIONS[repair.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      const fromLabel = REPAIR_STATUS_LABELS[repair.status];
      const toLabel = REPAIR_STATUS_LABELS[newStatus];
      toast.error(`Transición no permitida`, {
        description: `No se puede pasar de "${fromLabel}" a "${toLabel}". ${
          allowedTransitions.length > 0
            ? `Transiciones válidas: ${allowedTransitions.map(s => REPAIR_STATUS_LABELS[s]).join(', ')}.`
            : 'Este estado no permite más cambios.'
        }`,
      });
      return;
    }

    // Show contextual toast for "En Taller" transition with workshop name
    if (newStatus === 'en_taller') {
      const workshopName = repair.workshop?.name;
      toast.success(
        `${repair.vehicle?.matricula || 'Vehículo'} enviado a taller`,
        {
          description: workshopName
            ? `Taller: ${workshopName}`
            : 'Sin taller asignado',
        }
      );
    }

    await onStatusChange(repair, newStatus);
  };

  // Compute valid drop targets for the currently dragged repair
  const validDropTargets = useMemo(() => {
    if (!activeRepair) return new Set<RepairStatus>();
    return new Set(VALID_REPAIR_TRANSITIONS[activeRepair.status] || []);
  }, [activeRepair]);

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
            isValidTarget={activeRepair ? validDropTargets.has(column.status as RepairStatus) : undefined}
            isDragging={!!activeRepair}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
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
