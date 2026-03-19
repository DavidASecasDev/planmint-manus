import { Progress } from '@/components/ui/progress';

interface MilestoneProgressBadgeProps {
  completed: number;
  total: number;
  showBar?: boolean;
}

export function MilestoneProgressBadge({ completed, total, showBar = false }: MilestoneProgressBadgeProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (total === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Sin hitos definidos
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {completed} de {total} hitos ({percentage}%)
      </span>
      {showBar && (
        <Progress value={percentage} className="h-1.5 w-16" />
      )}
    </div>
  );
}
