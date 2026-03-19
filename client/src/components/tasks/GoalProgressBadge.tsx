import { Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface GoalProgressBadgeProps {
  currentValue: number;
  targetValue: number;
  unit: string;
  showBar?: boolean;
  size?: 'sm' | 'md';
}

export function GoalProgressBadge({
  currentValue,
  targetValue,
  unit,
  showBar = false,
  size = 'sm',
}: GoalProgressBadgeProps) {
  const progressPercent = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
  const isCompleted = currentValue >= targetValue;

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
    }
    return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  };

  return (
    <div className={cn('flex items-center gap-1.5', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <Target className={cn('text-primary', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      <span className="text-muted-foreground">
        {formatValue(currentValue)} / {formatValue(targetValue)} {unit}
      </span>
      {showBar && (
        <div className="w-12 ml-1">
          <Progress
            value={progressPercent}
            className={cn('h-1.5', isCompleted && '[&>div]:bg-green-500')}
          />
        </div>
      )}
      <span className={cn('font-medium', isCompleted ? 'text-green-600' : 'text-muted-foreground')}>
        ({progressPercent.toFixed(0)}%)
      </span>
    </div>
  );
}
