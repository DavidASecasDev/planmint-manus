import { useState, useEffect, useCallback, useRef } from 'react';
import { VehicleWithTasks, CLEANING_TASKS, CleaningTaskKey } from '@/types/vehicles';
import { useVehicles } from '@/hooks/useVehicles';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { 
  Fuel, 
  Gauge, 
  AlertTriangle, 
  Smartphone, 
  Sparkles, 
  Droplets,
  PlayCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VehicleCleaningChecklistProps {
  vehicle: VehicleWithTasks;
  onBecameClean?: () => void;
}

const TASK_ICONS: Record<CleaningTaskKey, React.ComponentType<{ className?: string }>> = {
  inicio_prep: PlayCircle,
  repostaje: Fuel,
  presion: Gauge,
  avisos: AlertTriangle,
  borrado: Smartphone,
  limpieza_int: Sparkles,
  limpieza_ext: Droplets,
};

export function VehicleCleaningChecklist({ vehicle, onBecameClean }: VehicleCleaningChecklistProps) {
  const { toggleTask, isTogglingTask, updateTaskNotes, isUpdatingNotes } = useVehicles();
  const prevStatusRef = useRef(vehicle.status);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState<string>('');
  const [debouncedSave, setDebouncedSave] = useState<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debouncedSave) {
        clearTimeout(debouncedSave);
      }
    };
  }, [debouncedSave]);

  // Detect when vehicle transitions to 'limpio' after toggling tasks
  useEffect(() => {
    if (prevStatusRef.current !== 'limpio' && vehicle.status === 'limpio') {
      onBecameClean?.();
    }
    prevStatusRef.current = vehicle.status;
  }, [vehicle.status, onBecameClean]);

  const handleNotesChange = useCallback((value: string, taskId: string) => {
    setNotesValue(value);
    
    // Clear previous timeout
    if (debouncedSave) {
      clearTimeout(debouncedSave);
    }
    
    // Set new timeout for auto-save
    const timeout = setTimeout(() => {
      updateTaskNotes({ taskId, notes: value });
    }, 500);
    
    setDebouncedSave(timeout);
  }, [debouncedSave, updateTaskNotes]);

  // Handle case where cleaning tasks are missing
  if (!vehicle.cleaning_tasks || vehicle.cleaning_tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-medium text-destructive">
          No hay tareas de limpieza configuradas
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Sincroniza los vehículos para crear las tareas automáticamente
        </p>
      </div>
    );
  }

  const tasks = vehicle.cleaning_tasks || [];
  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = CLEANING_TASKS.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const getTaskByKey = (key: CleaningTaskKey) => {
    return tasks.find(t => t.task_key === key);
  };

  const handleToggle = (taskKey: CleaningTaskKey) => {
    const task = getTaskByKey(taskKey);
    if (task) {
      toggleTask({ taskId: task.id, completed: !task.completed, vehicleId: vehicle.id, taskKey });
    }
  };

  const handleExpandTask = (taskKey: CleaningTaskKey, e: React.MouseEvent) => {
    e.stopPropagation();
    const task = getTaskByKey(taskKey);
    if (taskKey === 'avisos' && task) {
      if (expandedTask === task.id) {
        setExpandedTask(null);
      } else {
        setExpandedTask(task.id);
        setNotesValue(task.notes || '');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progreso de limpieza</span>
          <span className="text-muted-foreground">{completedTasks} de {totalTasks} completadas</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {CLEANING_TASKS.map((taskDef) => {
          const task = getTaskByKey(taskDef.key);
          const isCompleted = task?.completed ?? false;
          const completedByName = task?.completed_by_profile?.name;
          const Icon = TASK_ICONS[taskDef.key];
          const isAvisosTask = taskDef.key === 'avisos';
          const isExpanded = task && expandedTask === task.id;
          const hasNotes = task?.notes && task.notes.trim().length > 0;

          return (
            <div key={taskDef.key} className="space-y-0">
              <div
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                  isCompleted 
                    ? "bg-primary/5 border-primary/20" 
                    : "hover:bg-muted/50",
                  isExpanded && "rounded-b-none border-b-0"
                )}
                onClick={() => handleToggle(taskDef.key)}
              >
                <Checkbox
                  checked={isCompleted}
                  disabled={isTogglingTask}
                  className="pointer-events-none"
                />
                <Icon className={cn(
                  "h-5 w-5",
                  isCompleted ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "flex-1 text-sm font-medium",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {taskDef.label}
                </span>
                
                {/* Show indicator if has notes */}
                {isAvisosTask && hasNotes && !isExpanded && (
                  <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded">
                    Notas
                  </span>
                )}
                
                {/* Expand button for avisos */}
                {isAvisosTask && task && (
                  <button
                    onClick={(e) => handleExpandTask(taskDef.key, e)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
                
                {/* Show who completed the task */}
                {isCompleted && completedByName && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {completedByName}
                  </span>
                )}
              </div>
              
              {/* Expanded notes section for avisos */}
              {isAvisosTask && isExpanded && task && (
                <div 
                  className="border border-t-0 rounded-b-lg p-3 bg-muted/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Textarea
                    placeholder="Describe los avisos de mantenimiento pendientes..."
                    value={notesValue}
                    onChange={(e) => handleNotesChange(e.target.value, task.id)}
                    className="min-h-[80px] text-sm resize-none"
                    disabled={isUpdatingNotes}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {isUpdatingNotes ? 'Guardando...' : 'Auto-guardado activado'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      <div className="text-center text-sm text-muted-foreground">
        {completedTasks === 0 && (
          <p>Comienza marcando las tareas completadas</p>
        )}
        {completedTasks > 0 && completedTasks < totalTasks && (
          <p>Faltan {totalTasks - completedTasks} tareas para que el vehículo esté limpio</p>
        )}
        {completedTasks === totalTasks && (
          <p className="text-primary font-medium">¡El vehículo está listo para alquilar! 🎉</p>
        )}
      </div>
    </div>
  );
}
