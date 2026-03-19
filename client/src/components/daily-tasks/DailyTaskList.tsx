import { DailyTaskWithStatus } from '@/hooks/useDailyTasks';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, ClipboardCheck, Pencil, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

const DAY_SHORT_NAMES: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
};

interface DailyTaskListProps {
  tasks: DailyTaskWithStatus[];
  isLoading: boolean;
  onComplete: (templateId: string) => void;
  onUncomplete: (completionId: string) => void;
  isCompleting: boolean;
  isUncompleting: boolean;
  canManage: boolean;
  canComplete: boolean;
  onDelete: (templateId: string) => void;
  onEdit: (task: { id: string; title: string; description: string | null; weekdays: number[] | null; assigned_to: string | null }) => void;
  selectedDate?: Date;
}

export function DailyTaskList({
  tasks,
  isLoading,
  onComplete,
  onUncomplete,
  isCompleting,
  isUncompleting,
  canManage,
  canComplete,
  onDelete,
  onEdit,
  selectedDate,
}: DailyTaskListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const effectiveDate = selectedDate || new Date();
  const isCurrentDay = isToday(effectiveDate);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">
          {isCurrentDay
            ? 'No hay tareas diarias configuradas'
            : `No hay tareas programadas para ${format(effectiveDate, "EEEE d 'de' MMMM", { locale: es })}`
          }
        </p>
        {isCurrentDay && (
          <p className="text-sm mt-1">Crea tareas recurrentes que tu equipo debe completar cada día</p>
        )}
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.todayCompletion).length;
  const dateLabel = isCurrentDay
    ? 'completadas hoy'
    : `completadas — ${format(effectiveDate, "EEEE d 'de' MMM", { locale: es })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {completedCount} de {tasks.length} {dateLabel}
        </span>
        {completedCount === tasks.length && tasks.length > 0 && (
          <span className="text-primary font-medium">¡Todo listo! 🎉</span>
        )}
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const isCompleted = !!task.todayCompletion;
          const completedByName = task.todayCompletion?.completed_by_profile?.name;
          const assignedName = task.assigned_to_profile?.name;

          return (
            <div
              key={task.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                isCompleted
                  ? 'bg-primary/5 border-primary/20'
                  : 'hover:bg-muted/50'
              )}
            >
              <Checkbox
                checked={isCompleted}
                disabled={!canComplete || isCompleting || isUncompleting}
                onCheckedChange={() => {
                  if (isCompleted && task.todayCompletion) {
                    onUncomplete(task.todayCompletion.id);
                  } else {
                    onComplete(task.id);
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isCompleted && 'line-through text-muted-foreground'
                  )}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {task.weekdays && task.weekdays.length > 0 && (
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6,0].filter(d => task.weekdays!.includes(d)).map(d => (
                        <Badge key={d} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {DAY_SHORT_NAMES[d]}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {assignedName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                      <User className="h-2.5 w-2.5" />
                      {assignedName}
                    </Badge>
                  )}
                </div>
              </div>
              {isCompleted && completedByName && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {completedByName}
                </span>
              )}
              {canManage && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit({ id: task.id, title: task.title, description: task.description, weekdays: task.weekdays, assigned_to: task.assigned_to })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
