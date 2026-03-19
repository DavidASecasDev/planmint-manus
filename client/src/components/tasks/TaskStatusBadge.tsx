import { Badge } from '@/components/ui/badge';
import { TaskStatus, TASK_STATUS_OPTIONS } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const option = TASK_STATUS_OPTIONS.find((o) => o.value === status);
  
  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-xs font-medium',
        status === 'pending' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        status === 'in_progress' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        status === 'blocked' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        status === 'completed' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        className
      )}
    >
      {option?.label || status}
    </Badge>
  );
}
