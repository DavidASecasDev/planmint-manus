import { Target, ListTodo, TrendingUp, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TaskWithRelations, TaskType, TaskPriority } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface CalendarTaskCardProps {
  task: TaskWithRelations;
  compact?: boolean;
  showDetails?: boolean;
  isDraggable?: boolean;
  onClick?: () => void;
}

const getTypeIcon = (type: TaskType) => {
  switch (type) {
    case 'goal_numeric':
      return <TrendingUp className="h-3 w-3" />;
    case 'goal_milestones':
      return <Target className="h-3 w-3" />;
    default:
      return <ListTodo className="h-3 w-3" />;
  }
};

const getPriorityStyles = (priority: TaskPriority): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getPriorityLabel = (priority: TaskPriority): string => {
  switch (priority) {
    case 'urgent': return 'Urgente';
    case 'high': return 'Alta';
    case 'medium': return 'Media';
    case 'low': return 'Baja';
    default: return priority;
  }
};

export function CalendarTaskCard({ 
  task, 
  compact = false, 
  showDetails = false,
  isDraggable = false,
  onClick 
}: CalendarTaskCardProps) {
  if (compact) {
    return (
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Tarea: ${task.title}`}
        className={cn(
          "text-xs p-1.5 rounded-md cursor-pointer transition-all duration-200",
          "bg-primary/10 hover:bg-primary/20 text-foreground",
          "flex items-center gap-1.5 hover:shadow-sm"
        )}
      >
        {getTypeIcon(task.type)}
        <span className="truncate font-medium">{task.title}</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Tarea: ${task.title}`}
      className={cn(
        "p-2.5 rounded-lg border border-border/50 bg-card cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:border-border hover:-translate-y-0.5",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        {isDraggable && (
          <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-muted-foreground">{getTypeIcon(task.type)}</span>
            <span className="font-medium text-sm truncate">{task.title}</span>
          </div>
          
          {showDetails && task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
              {task.description}
            </p>
          )}
          
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge 
              variant="outline" 
              className={cn("text-xs px-2 py-0.5 font-medium border", getPriorityStyles(task.priority))}
            >
              {getPriorityLabel(task.priority)}
            </Badge>
            
            {task.areas && task.areas.length > 0 && (
              <div className="flex items-center gap-1">
                {task.areas.slice(0, 2).map((area) => (
                  <span
                    key={area.id}
                    className="inline-block w-2.5 h-2.5 rounded-full ring-1 ring-background"
                    style={{ backgroundColor: area.color || '#4F46E5' }}
                    title={area.name}
                  />
                ))}
                {task.areas.length > 2 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    +{task.areas.length - 2}
                  </span>
                )}
              </div>
            )}
            
            {task.assignee && (
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                {task.assignee.name || 'Sin nombre'}
              </span>
            )}

            {task.type === 'goal_numeric' && task.goalCurrentValue !== undefined && task.goal_target_value && (
              <span className="text-xs text-primary font-semibold">
                {Math.round((task.goalCurrentValue / task.goal_target_value) * 100)}%
              </span>
            )}

            {task.type === 'goal_milestones' && task.milestoneCompleted !== undefined && task.milestoneCount !== undefined && (
              <span className="text-xs text-primary font-semibold">
                {task.milestoneCompleted}/{task.milestoneCount}
              </span>
            )}

            {task.subtaskCompleted !== undefined && task.subtaskCount !== undefined && task.subtaskCount > 0 && (
              <span className="text-xs text-muted-foreground font-medium">
                ✓ {task.subtaskCompleted}/{task.subtaskCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
