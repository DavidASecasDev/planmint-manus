import { useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { VehicleMovement, MovementStatus } from '@/hooks/useMovements';
import { MovementKanbanCard } from './MovementKanbanCard';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { CircleDot, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';

const COLUMNS: { status: MovementStatus; label: string; icon: React.ElementType; colorClass: string }[] = [
  { status: 'en_curso', label: 'En curso', icon: CircleDot, colorClass: 'border-t-primary' },
  { status: 'completado', label: 'Completado', icon: CheckCircle2, colorClass: 'border-t-emerald-500' },
  { status: 'cancelado', label: 'Cancelado', icon: XCircle, colorClass: 'border-t-destructive' },
];

interface MovementsKanbanProps {
  movements: VehicleMovement[];
  isLoading: boolean;
  onUpdateStatus: (id: string, status: MovementStatus) => void;
}

function KanbanColumn({ status, label, icon: Icon, colorClass, items, canDrag }: {
  status: MovementStatus;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  items: VehicleMovement[];
  canDrag: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border-t-4 bg-muted/20 min-h-[300px]',
        colorClass,
        isOver && 'ring-2 ring-primary/30 bg-primary/5'
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border/50">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={items.map(m => m.id)} strategy={verticalListSortingStrategy}>
          {items.map((m) => (
            <MovementKanbanCard key={m.id} movement={m} canDrag={canDrag} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Sin movimientos
          </div>
        )}
      </div>
    </div>
  );
}

export function MovementsKanban({ movements, isLoading, onUpdateStatus }: MovementsKanbanProps) {
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const canDrag = !permLoading && hasPermission('movements.manage');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = useMemo(() => {
    const map: Record<MovementStatus, VehicleMovement[]> = {
      en_curso: [],
      completado: [],
      cancelado: [],
    };
    movements.forEach((m) => {
      if (map[m.status]) map[m.status].push(m);
    });
    return map;
  }, [movements]);

  const activeMovement = activeId ? movements.find(m => m.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const movementId = active.id as string;
    const movement = movements.find(m => m.id === movementId);
    if (!movement) return;

    // Determine target status: could be dropping on a column or on another card
    let targetStatus: MovementStatus | null = null;
    if (['en_curso', 'completado', 'cancelado'].includes(over.id as string)) {
      targetStatus = over.id as MovementStatus;
    } else {
      // Dropped on a card — find which column it belongs to
      const targetMovement = movements.find(m => m.id === over.id);
      if (targetMovement) targetStatus = targetMovement.status;
    }

    if (targetStatus && targetStatus !== movement.status) {
      onUpdateStatus(movementId, targetStatus);
    }
  };

  const kanbanSkeleton = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <div key={col.status} className={cn('flex flex-col rounded-xl border-t-4 bg-muted/20 min-h-[300px]', col.colorClass)}>
          <div className="p-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-5 w-5 rounded-full ml-auto" />
            </div>
          </div>
          <div className="p-2 space-y-2">
            {Array.from({ length: col.status === 'en_curso' ? 3 : col.status === 'completado' ? 2 : 1 }).map((_, j) => (
              <div key={j} className="rounded-lg border border-border/50 p-3 space-y-2" style={{ opacity: 1 - j * 0.15 }}>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <SkeletonTransition isLoading={isLoading} skeleton={kanbanSkeleton}>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            {...col}
            items={grouped[col.status]}
            canDrag={canDrag}
          />
        ))}
      </div>
      <DragOverlay>
        {activeMovement ? (
          <div className="opacity-90 rotate-2">
            <MovementKanbanCard movement={activeMovement} canDrag={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </SkeletonTransition>
  );
}
