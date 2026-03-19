import { useMemo } from 'react';
import { format, parseISO, isSameDay, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CalendarTaskCard } from './CalendarTaskCard';
import { TaskWithRelations } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface CalendarRangeViewProps {
  dateFrom: Date;
  dateTo: Date;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}

export function CalendarRangeView({ dateFrom, dateTo, tasks, onTaskClick }: CalendarRangeViewProps) {
  const daysInRange = useMemo(() => {
    return eachDayOfInterval({ start: dateFrom, end: dateTo });
  }, [dateFrom, dateTo]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    
    daysInRange.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      map.set(dayKey, []);
    });

    tasks.forEach(task => {
      if (!task.due_date) return;
      const taskDate = parseISO(task.due_date);
      const dayKey = format(taskDate, 'yyyy-MM-dd');
      
      if (map.has(dayKey)) {
        const dayTasks = map.get(dayKey)!;
        dayTasks.push(task);
      }
    });

    return map;
  }, [tasks, daysInRange]);

  const today = new Date();

  return (
    <ScrollArea className="h-full">
      <div className="min-w-max flex gap-4 p-2">
        {daysInRange.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(dayKey) || [];
          const isToday = isSameDay(day, today);

          return (
            <div
              key={dayKey}
              className={cn(
                "flex-shrink-0 w-64 rounded-lg border bg-card",
                isToday && "border-primary ring-1 ring-primary"
              )}
            >
              {/* Day header */}
              <div className={cn(
                "px-3 py-2 border-b",
                isToday && "bg-primary/10"
              )}>
                <div className="text-sm font-medium capitalize">
                  {format(day, 'EEEE', { locale: es })}
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  isToday && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {format(day, 'MMMM yyyy', { locale: es })}
                </div>
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto">
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin tareas
                  </p>
                ) : (
                  dayTasks.map(task => (
                    <CalendarTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))
                )}
              </div>

              {/* Task count footer */}
              <div className="px-3 py-1 border-t bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {dayTasks.length} {dayTasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
