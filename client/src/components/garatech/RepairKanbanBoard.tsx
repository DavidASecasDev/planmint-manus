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
import { AlertTriangle, ArrowUpDown, Calendar, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RepairKanbanColumn } from './RepairKanbanColumn';
import { RepairKanbanCard } from './RepairKanbanCard';
import { FinalizarRepairDialog } from './FinalizarRepairDialog';
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
  onStatusChange: (repair: Repair, newStatus: RepairStatus, extraData?: { cost_final?: number | null }) => Promise<void>;
}

export type SortMode = 'default' | 'date' | 'stale';

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

// Stale thresholds (same as in RepairKanbanCard)
const STALE_THRESHOLDS: Record<string, number> = {
  pendiente_aprobacion: 3,
  listo_entregar_taller: 2,
  en_taller: 7,
  esperando_piezas: 5,
  listo_recoger: 2,
  finalizado: 999,
};

function isRepairStale(repair: Repair): boolean {
  const now = new Date();
  let referenceDate: Date;

  if (repair.status === 'en_taller' && repair.started_at) {
    referenceDate = new Date(repair.started_at);
  } else if (repair.status === 'finalizado' && repair.completed_at) {
    referenceDate = new Date(repair.completed_at);
  } else {
    referenceDate = new Date(repair.updated_at);
  }

  const days = differenceInDays(now, referenceDate);
  const threshold = STALE_THRESHOLDS[repair.status] ?? 5;
  return days >= threshold;
}

function sortRepairs(repairs: Repair[], mode: SortMode): Repair[] {
  if (mode === 'default') return repairs;

  return [...repairs].sort((a, b) => {
    if (mode === 'date') {
      // Sort by scheduled_date ascending (nulls last)
      const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : Infinity;
      const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : Infinity;
      return dateA - dateB;
    }
    if (mode === 'stale') {
      // Sort by days in status descending (most stale first)
      const getDaysInStatus = (r: Repair) => {
        const now = new Date();
        let ref: Date;
        if (r.status === 'en_taller' && r.started_at) ref = new Date(r.started_at);
        else if (r.status === 'finalizado' && r.completed_at) ref = new Date(r.completed_at);
        else ref = new Date(r.updated_at);
        return differenceInDays(now, ref);
      };
      return getDaysInStatus(b) - getDaysInStatus(a);
    }
    return 0;
  });
}

export function RepairKanbanBoard({
  repairs,
  onRepairClick,
  onStatusChange,
}: RepairKanbanBoardProps) {
  const [activeRepair, setActiveRepair] = useState<Repair | null>(null);
  const [showOnlyStale, setShowOnlyStale] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  // Finalization dialog state
  const [finalizarRepair, setFinalizarRepair] = useState<Repair | null>(null);
  const [finalizarLoading, setFinalizarLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Count stale repairs for the badge
  const staleCount = useMemo(() => repairs.filter(isRepairStale).length, [repairs]);

  // Filter repairs
  const visibleRepairs = useMemo(() => {
    if (showOnlyStale) {
      return repairs.filter(isRepairStale);
    }
    return repairs;
  }, [repairs, showOnlyStale]);

  // Group repairs by status with sorting applied
  const repairsByStatus = useMemo(() => {
    const grouped: Record<RepairStatus, Repair[]> = {
      pendiente_aprobacion: [],
      listo_entregar_taller: [],
      en_taller: [],
      esperando_piezas: [],
      listo_recoger: [],
      finalizado: [],
    };

    visibleRepairs.forEach((repair) => {
      if (grouped[repair.status]) {
        grouped[repair.status].push(repair);
      }
    });

    // Apply sort to each column
    for (const status of Object.keys(grouped) as RepairStatus[]) {
      grouped[status] = sortRepairs(grouped[status], sortMode);
    }

    return grouped;
  }, [visibleRepairs, sortMode]);

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

    // Resolve target status
    let newStatus: RepairStatus;
    const overRepair = over.data.current?.repair as Repair | undefined;
    if (overRepair) {
      newStatus = overRepair.status;
    } else {
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

    // If moving to "finalizado", show confirmation dialog
    if (newStatus === 'finalizado') {
      setFinalizarRepair(repair);
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

  const handleFinalizarConfirm = async (repair: Repair, costFinal: number | null) => {
    setFinalizarLoading(true);
    try {
      await onStatusChange(repair, 'finalizado', { cost_final: costFinal });
      toast.success(
        `${repair.vehicle?.matricula || 'Reparación'} finalizada`,
        {
          description: costFinal
            ? `Coste final: ${costFinal.toLocaleString('es-ES')}€`
            : 'Sin coste final registrado',
        }
      );
      setFinalizarRepair(null);
    } catch {
      toast.error('Error al finalizar la reparación');
    } finally {
      setFinalizarLoading(false);
    }
  };

  // Compute valid drop targets for the currently dragged repair
  const validDropTargets = useMemo(() => {
    if (!activeRepair) return new Set<RepairStatus>();
    return new Set(VALID_REPAIR_TRANSITIONS[activeRepair.status] || []);
  }, [activeRepair]);

  return (
    <>
      {/* Toolbar: filter + sort */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Stale filter toggle */}
        <Button
          variant={showOnlyStale ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOnlyStale(!showOnlyStale)}
          className={cn(
            'gap-1.5',
            showOnlyStale && 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Estancadas
          {staleCount > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-1 text-xs h-5 min-w-5 px-1',
                showOnlyStale && 'bg-amber-800/30 text-white'
              )}
            >
              {staleCount}
            </Badge>
          )}
        </Button>

        {/* Sort toggle */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>Ordenar:</span>
        </div>
        <ToggleGroup
          type="single"
          value={sortMode}
          onValueChange={(value) => value && setSortMode(value as SortMode)}
          className="border rounded-md"
          size="sm"
        >
          <ToggleGroupItem value="default" aria-label="Orden por defecto" className="text-xs px-2.5">
            Defecto
          </ToggleGroupItem>
          <ToggleGroupItem value="date" aria-label="Ordenar por fecha" className="text-xs px-2.5 gap-1">
            <Calendar className="h-3 w-3" />
            Fecha
          </ToggleGroupItem>
          <ToggleGroupItem value="stale" aria-label="Ordenar por antigüedad" className="text-xs px-2.5 gap-1">
            <Clock className="h-3 w-3" />
            Antigüedad
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

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

      {/* Finalization confirmation dialog */}
      <FinalizarRepairDialog
        open={!!finalizarRepair}
        onOpenChange={(open) => !open && setFinalizarRepair(null)}
        repair={finalizarRepair}
        onConfirm={handleFinalizarConfirm}
        loading={finalizarLoading}
      />
    </>
  );
}
