import { Badge } from '@/components/ui/badge';
import { TaskPriority, TASK_PRIORITY_OPTIONS } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  const option = TASK_PRIORITY_OPTIONS.find((o) => o.value === priority);
  
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        priority === 'low' && 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400',
        priority === 'medium' && 'border-yellow-300 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400',
        priority === 'high' && 'border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-400',
        priority === 'urgent' && 'border-red-300 text-red-700 dark:border-red-600 dark:text-red-400',
        className
      )}
    >
      {option?.label || priority}
    </Badge>
  );
}
