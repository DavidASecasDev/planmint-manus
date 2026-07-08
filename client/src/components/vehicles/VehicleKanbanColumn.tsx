import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { VehicleCard } from './VehicleCard';
import { VehicleWithTasks, VehicleStatus } from '@/types/vehicles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface VehicleKanbanColumnProps {
  status: VehicleStatus;
  label: string;
  color: string;
  vehicles: VehicleWithTasks[];
  onSelectVehicle: (vehicleId: string) => void;
  /** Whether the current user can drag cards */
  canDrag?: boolean;
  /** Whether this column is a valid drop target for the currently dragged vehicle */
  isValidTarget?: boolean;
  /** Whether a drag operation is in progress */
  isDragging?: boolean;
}

export function VehicleKanbanColumn({
  status,
  label,
  color,
  vehicles,
  onSelectVehicle,
  canDrag = false,
  isValidTarget,
  isDragging = false,
}: VehicleKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const vehicleIds = vehicles.map((v) => v.id);

  // Visual states during drag
  const isInvalidTarget = isDragging && isValidTarget === false;
  const isHighlightedTarget = isDragging && isValidTarget === true;

  return (
    <div className={cn(
      'flex flex-col rounded-xl border bg-card transition-opacity duration-200 min-h-0 overflow-hidden',
      isInvalidTarget && 'opacity-40',
    )}>
      {/* Column Header */}
      <div 
        className={cn(
          'flex items-center justify-between p-3 border-b transition-all duration-200',
          isHighlightedTarget && 'ring-2 ring-primary/40 rounded-t-xl',
        )}
        style={{ borderTopColor: color, borderTopWidth: '3px', borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          <span 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-sm">{label}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {vehicles.length}
        </Badge>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 transition-all duration-200 min-h-[100px]',
          isOver && isHighlightedTarget && 'bg-primary/10 ring-2 ring-primary/40 ring-inset rounded-b-xl',
          isHighlightedTarget && !isOver && 'bg-primary/5',
        )}
      >
        <ScrollArea className="h-full p-3">
          <SortableContext items={vehicleIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {vehicles.length === 0 ? (
                <div className={cn(
                  'text-center py-8 text-muted-foreground text-sm',
                  isOver && isHighlightedTarget && 'text-primary font-medium',
                )}>
                  {isOver && isHighlightedTarget ? 'Soltar aquí' : 'No hay vehículos'}
                </div>
              ) : (
                vehicles.map((vehicle) => (
                  <VehicleCard 
                    key={vehicle.id} 
                    vehicle={vehicle} 
                    onSelect={onSelectVehicle}
                    canDrag={canDrag}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}
