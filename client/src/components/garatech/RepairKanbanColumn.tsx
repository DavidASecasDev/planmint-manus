import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Inbox, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RepairKanbanCard } from './RepairKanbanCard';
import type { Repair, RepairStatus } from '@/types/garatech';

interface RepairKanbanColumnProps {
  status: RepairStatus;
  label: string;
  color: string;
  repairs: Repair[];
  onRepairClick: (repair: Repair) => void;
  /** Whether this column is a valid drop target for the currently dragged repair */
  isValidTarget?: boolean;
  /** Whether a drag operation is in progress */
  isDragging?: boolean;
}

export function RepairKanbanColumn({
  status,
  label,
  color,
  repairs,
  onRepairClick,
  isValidTarget,
  isDragging = false,
}: RepairKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const repairIds = repairs.map((r) => r.id);

  // Visual states during drag
  const isInvalidTarget = isDragging && isValidTarget === false;
  const isHighlightedTarget = isDragging && isValidTarget === true;

  return (
    <div className={cn(
      'flex flex-col min-w-[288px] w-72 transition-opacity duration-200',
      isInvalidTarget && 'opacity-40',
    )}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 p-3 rounded-t-xl border border-b-0 border-border/50 bg-card transition-all duration-200',
          isHighlightedTarget && 'ring-2 ring-primary/40',
          isInvalidTarget && 'grayscale',
        )}
        style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-medium text-sm truncate flex-1">{label}</h3>
        {isInvalidTarget && (
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Badge variant="secondary" className="text-xs font-normal">
          {repairs.length}
        </Badge>
      </div>

      {/* Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 bg-muted/30 rounded-b-xl border border-t-0 border-border/50 min-h-[200px] transition-all duration-200',
          isOver && isValidTarget && 'bg-primary/10 ring-2 ring-primary/40 ring-inset',
          isOver && isValidTarget === false && 'bg-destructive/5 ring-2 ring-destructive/30 ring-inset',
          isHighlightedTarget && !isOver && 'bg-primary/5 border-primary/20',
        )}
      >
        <ScrollArea className="h-[calc(100vh-340px)]">
          <SortableContext items={repairIds} strategy={verticalListSortingStrategy}>
            <div className="p-2 space-y-0">
              {repairs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-xs">Sin reparaciones</p>
                </div>
              ) : (
                repairs.map((repair) => (
                  <RepairKanbanCard
                    key={repair.id}
                    repair={repair}
                    onClick={() => onRepairClick(repair)}
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
