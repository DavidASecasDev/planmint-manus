import { useMemo } from 'react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaskWithRelations } from '@/types/tasks';
import { CalendarTaskCard } from './CalendarTaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CalendarDayViewProps {
  currentDate: Date;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}

export function CalendarDayView({ currentDate, tasks, onTaskClick }: CalendarDayViewProps) {
  const dayTasks = useMemo(() => {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    
    return tasks.filter((task) => {
      const displayDate = task.calendar_display_date || task.due_date;
      if (!displayDate) return false;
      return format(new Date(displayDate), 'yyyy-MM-dd') === dateKey;
    });
  }, [currentDate, tasks]);

  const isTodayDate = isToday(currentDate);

  return (
    <div className="h-full flex flex-col">
      <div
        className={cn(
          "p-4 border-b bg-muted/50 text-center",
          isTodayDate && "bg-primary/10"
        )}
      >
        <div className="text-sm text-muted-foreground uppercase">
          {format(currentDate, 'EEEE', { locale: es })}
        </div>
        <div
          className={cn(
            "text-3xl font-bold",
            isTodayDate && "text-primary"
          )}
        >
          {format(currentDate, 'd')}
        </div>
        <div className="text-sm text-muted-foreground">
          {format(currentDate, "MMMM 'de' yyyy", { locale: es })}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {dayTasks.length > 0 ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {dayTasks.map((task) => (
              <CalendarTaskCard
                key={`${task.id}-${task.calendar_event_kind || 'due'}`}
                task={task}
                showDetails
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg">No hay tareas para este día</p>
            <p className="text-sm">Los vencimientos y seguimientos aparecerán aquí</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
