import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, ListChecks, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SubtaskItem } from './SubtaskItem';
import { Subtask } from '@/types/subtasks';
import { cn } from '@/lib/utils';

interface SubtaskListProps {
  subtasks: Subtask[];
  taskId: string;
  canEdit: boolean;
  completedCount: number;
  totalCount: number;
  progress: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onCreate: (title: string) => void;
}

export function SubtaskList({
  subtasks,
  taskId,
  canEdit,
  completedCount,
  totalCount,
  progress,
  onToggle,
  onDelete,
  onReorder,
  onCreate,
}: SubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  };

  const handleCreate = () => {
    if (newSubtaskTitle.trim()) {
      onCreate(newSubtaskTitle.trim());
      setNewSubtaskTitle('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <h4 className="font-medium">Subtareas</h4>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
            {progress === 100 && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="space-y-1.5">
          <Progress 
            value={progress} 
            className={cn(
              "h-2 transition-all",
              progress === 100 && "[&>div]:bg-green-500"
            )} 
          />
          <p className="text-xs text-muted-foreground text-right">
            {Math.round(progress)}% completado
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                onToggle={onToggle}
                onDelete={onDelete}
                canEdit={canEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {subtasks.length === 0 && !canEdit && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <ListChecks className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground">
            Esta tarea no tiene subtareas
          </p>
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="Añadir nueva subtarea..."
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-10"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleCreate}
            disabled={!newSubtaskTitle.trim()}
            className="h-10 w-10 shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
