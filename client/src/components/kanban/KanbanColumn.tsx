import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { KanbanColumn } from '@/types/kanban';
import { TaskWithRelations } from '@/types/tasks';
import { KanbanTaskCard } from './KanbanTaskCard';
import { Inbox } from 'lucide-react';

interface KanbanColumnProps {
  column: KanbanColumn;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
  canDragTask: (task: TaskWithRelations) => boolean;
}

export function KanbanColumnComponent({
  column,
  tasks,
  onTaskClick,
  canDragTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: {
      type: 'column',
      column,
    },
  });

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column Header */}
      <div
        className="flex items-center gap-2 p-3 rounded-t-xl border border-b-0 border-border/50 bg-card"
        style={{ borderLeftColor: column.color, borderLeftWidth: '3px' }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <h3 className="font-medium text-sm flex-1">{column.label}</h3>
        <Badge variant="secondary" className="text-xs font-normal px-2">
          {tasks.length}
        </Badge>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 bg-muted/30 rounded-b-xl border border-t-0 border-border/50 min-h-[200px] transition-all duration-200 ${
          isOver ? 'bg-primary/5 ring-2 ring-primary/30 ring-inset' : ''
        }`}
      >
        <ScrollArea className="h-[calc(100vh-340px)]">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                <Inbox className="h-5 w-5 mb-1 opacity-50" />
                <span className="text-xs">Sin tareas</span>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    isDraggable={canDragTask(task)}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}
