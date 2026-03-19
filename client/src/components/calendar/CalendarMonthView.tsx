import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { TaskWithRelations } from '@/types/tasks';
import { CalendarTaskCard } from './CalendarTaskCard';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CalendarMonthViewProps {
  currentDate: Date;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_VISIBLE_TASKS = 3;

export function CalendarMonthView({ currentDate, tasks, onTaskClick }: CalendarMonthViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
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
    <div className="flex flex-col h-full">
      {/* Header with weekday names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-[100px] p-1 border rounded-md",
                isCurrentMonth ? "bg-card" : "bg-muted/30",
                isTodayDate && "ring-2 ring-primary"
              )}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1",
                  !isCurrentMonth && "text-muted-foreground",
                  isTodayDate && "text-primary"
                )}
              >
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayTasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
                  <CalendarTaskCard
                    key={task.id}
                    task={task}
                    compact
                    onClick={() => onTaskClick(task)}
                  />
                ))}

                {dayTasks.length > MAX_VISIBLE_TASKS && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-auto py-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        +{dayTasks.length - MAX_VISIBLE_TASKS} más
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="font-medium mb-2">
                        {format(day, "EEEE d 'de' MMMM", { locale: es })}
                      </div>
                      <ScrollArea className="h-64">
                        <div className="space-y-2">
                          {dayTasks.map((task) => (
                            <CalendarTaskCard
                              key={task.id}
                              task={task}
                              onClick={() => onTaskClick(task)}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
