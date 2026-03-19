import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Subtask } from '@/types/subtasks';
import { cn } from '@/lib/utils';

interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}

export function SubtaskItem({ subtask, onToggle, onDelete, canEdit }: SubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDone = subtask.status === 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 bg-card group transition-all duration-200',
        'hover:border-border hover:shadow-sm',
        isDragging && 'opacity-50 shadow-lg rotate-1',
        isDone && 'bg-muted/30'
      )}
    >
      {canEdit && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none transition-colors"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      
      <button
        onClick={() => onToggle(subtask.id)}
        disabled={!canEdit}
        className={cn(
          "shrink-0 transition-all duration-200",
          canEdit && "hover:scale-110"
        )}
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/50 hover:text-muted-foreground" />
        )}
      </button>
      
      <span
        className={cn(
          'flex-1 text-sm transition-all duration-200',
          isDone && 'line-through text-muted-foreground'
        )}
      >
        {subtask.title}
      </span>
      
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(subtask.id)}
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
