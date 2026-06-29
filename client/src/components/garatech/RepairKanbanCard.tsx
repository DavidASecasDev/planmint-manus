import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Car, Wrench, Calendar, Euro, Building, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { REPAIR_TYPE_LABELS, REPAIR_STATUS_LABELS, type Repair, type RepairType } from '@/types/garatech';

interface RepairKanbanCardProps {
  repair: Repair;
  onClick: () => void;
}

const getRepairTypeBadgeColors = (type: RepairType) => {
  switch (type) {
    case 'mantenimiento':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
    case 'reparacion':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    case 'revision':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    case 'itv':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    case 'accidente':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

/**
 * Calculate how long a repair has been in its current status.
 * Uses updated_at as the best proxy for "last status change" since
 * status changes always trigger an update.
 * For 'en_taller', uses started_at if available.
 */
function getDaysInStatus(repair: Repair): { text: string; isStale: boolean } {
  const now = new Date();
  let referenceDate: Date;

  if (repair.status === 'en_taller' && repair.started_at) {
    referenceDate = new Date(repair.started_at);
  } else if (repair.status === 'finalizado' && repair.completed_at) {
    // For finalized, show time since completion
    referenceDate = new Date(repair.completed_at);
  } else {
    // Use updated_at as the best proxy for when the status last changed
    referenceDate = new Date(repair.updated_at);
  }

  const days = differenceInDays(now, referenceDate);
  const hours = differenceInHours(now, referenceDate);

  // Stale thresholds by status
  const staleThresholds: Record<string, number> = {
    pendiente_aprobacion: 3,
    listo_entregar_taller: 2,
    en_taller: 7,
    esperando_piezas: 5,
    listo_recoger: 2,
    finalizado: 999, // never stale
  };

  const threshold = staleThresholds[repair.status] ?? 5;
  const isStale = days >= threshold;

  if (days === 0) {
    if (hours <= 1) return { text: 'Ahora', isStale: false };
    return { text: `${hours}h`, isStale: false };
  }
  if (days === 1) return { text: '1d', isStale };
  return { text: `${days}d`, isStale };
}

export function RepairKanbanCard({ repair, onClick }: RepairKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: repair.id,
    data: { repair },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { text: daysText, isStale } = getDaysInStatus(repair);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'mb-2 border-border/50 bg-card transition-all duration-200',
        'hover:shadow-md hover:border-border hover:-translate-y-0.5',
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/50 rotate-1',
        isStale && 'border-l-2 border-l-amber-500'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <CardContent className="p-3.5 space-y-2.5">
        {/* Header: Repair number + days indicator */}
        <div className="flex items-center justify-between">
          {repair.repair_number && (
            <p className="text-xs font-mono text-muted-foreground">
              {repair.repair_number}
            </p>
          )}
          {/* Days in status indicator */}
          <div
            className={cn(
              'flex items-center gap-1 text-xs rounded-full px-1.5 py-0.5',
              isStale
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'text-muted-foreground'
            )}
            title={`${daysText} en ${REPAIR_STATUS_LABELS[repair.status]}`}
          >
            <Clock className="h-3 w-3" />
            <span className="font-medium">{daysText}</span>
          </div>
        </div>

        {/* Vehicle info */}
        <div className="flex items-start gap-2">
          <Car className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">
              {repair.vehicle?.matricula || 'Sin vehículo'}
            </p>
            {repair.vehicle?.modelo && (
              <p className="text-xs text-muted-foreground truncate">
                {repair.vehicle.modelo}
              </p>
            )}
          </div>
        </div>

        {/* Repair type badge */}
        <Badge 
          variant="outline" 
          className={cn(
            'text-xs border',
            getRepairTypeBadgeColors(repair.repair_type)
          )}
        >
          <Wrench className="h-3 w-3 mr-1" />
          {REPAIR_TYPE_LABELS[repair.repair_type]}
        </Badge>

        {/* Workshop */}
        {repair.workshop?.name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building className="h-3 w-3 shrink-0" />
            <span className="truncate">{repair.workshop.name}</span>
          </div>
        )}

        {/* Footer with separator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 mt-1">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {repair.scheduled_date ? (
              format(new Date(repair.scheduled_date), 'dd MMM', { locale: es })
            ) : (
              <span className="text-muted-foreground/50">--</span>
            )}
          </div>
          {(() => {
            const isFinalizado = repair.status === 'finalizado';
            const displayCost = isFinalizado && repair.cost_final 
              ? repair.cost_final 
              : repair.cost_estimate;
            const isFinalCost = isFinalizado && repair.cost_final;
            
            if (!displayCost) return null;
            
            return (
              <div className={cn(
                "flex items-center gap-1 font-mono font-medium",
                isFinalCost ? "text-green-600 dark:text-green-400" : "text-foreground"
              )}>
                <Euro className="h-3 w-3" />
                {displayCost.toLocaleString('es-ES')}
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
