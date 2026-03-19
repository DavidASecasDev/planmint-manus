import { useState } from 'react';
import { Play, Pause, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

interface TimerWidgetProps {
  className?: string;
  compact?: boolean;
}

export function TimerWidget({ className, compact = false }: TimerWidgetProps) {
  const { timerState, formatElapsed, startTimer, stopTimer, isStartingTimer, isStoppingTimer } = useTimeTracking();
  const { tasks } = useTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [description, setDescription] = useState('');

  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const handleStart = () => {
    startTimer({
      task_id: selectedTaskId || null,
      description: description || null,
    });
  };

  const handleStop = () => {
    stopTimer();
    setDescription('');
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(
          "font-mono text-lg font-semibold",
          timerState.isRunning ? "text-primary" : "text-muted-foreground"
        )}>
          {formatElapsed(timerState.elapsed)}
        </div>
        {timerState.isRunning ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={isStoppingTimer}
          >
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={isStartingTimer}
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4">
          {/* Timer Display */}
          <div className={cn(
            "text-4xl font-mono font-bold tracking-wider",
            timerState.isRunning ? "text-primary animate-pulse" : "text-muted-foreground"
          )}>
            {formatElapsed(timerState.elapsed)}
          </div>

          {/* Task Selection */}
          {!timerState.isRunning && (
            <div className="w-full space-y-3">
              <Select 
                value={selectedTaskId || 'none'} 
                onValueChange={(val) => setSelectedTaskId(val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tarea (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tarea</SelectItem>
                  {activeTasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="¿En qué estás trabajando?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

          {/* Control Button */}
          {timerState.isRunning ? (
            <Button
              size="lg"
              variant="destructive"
              onClick={handleStop}
              disabled={isStoppingTimer}
              className="w-full"
            >
              <Pause className="h-5 w-5 mr-2" />
              Detener
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleStart}
              disabled={isStartingTimer}
              className="w-full"
            >
              <Play className="h-5 w-5 mr-2" />
              Iniciar
            </Button>
          )}

          {timerState.isRunning && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Temporizador activo
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
