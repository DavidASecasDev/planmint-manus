import { useMemo } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { TaskWithRelations } from '@/types/tasks';
import { CalendarTaskCard } from './CalendarTaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CalendarWeekViewProps {
  currentDate: Date;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}

export function CalendarWeekView({ currentDate, tasks, onTaskClick }: CalendarWeekViewProps) {
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    
    tasks.forEach((task) => {
      if (task.due_date) {
        const dateKey = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });

    return map;
  }, [tasks]);

  return (
    <div className="grid grid-cols-7 gap-2 h-full">
      {weekDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDay.get(dateKey) || [];
        const isTodayDate = isToday(day);

        return (
          <div
            key={dateKey}
            className={cn(
              "flex flex-col border rounded-lg overflow-hidden",
              isTodayDate && "ring-2 ring-primary"
            )}
          >
            <div
              className={cn(
                "p-2 border-b bg-muted/50 text-center",
                isTodayDate && "bg-primary/10"
              )}
            >
              <div className="text-xs text-muted-foreground uppercase">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  isTodayDate && "text-primary"
                )}
              >
                {format(day, 'd')}
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {dayTasks.length > 0 ? (
                  dayTasks.map((task) => (
                    <CalendarTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin tareas
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
