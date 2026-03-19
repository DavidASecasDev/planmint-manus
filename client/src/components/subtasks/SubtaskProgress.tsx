import { CheckSquare } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SubtaskProgressProps {
  completed: number;
  total: number;
  showBar?: boolean;
}

export function SubtaskProgress({ completed, total, showBar = false }: SubtaskProgressProps) {
  if (total === 0) return null;

  const progress = (completed / total) * 100;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <CheckSquare className="h-3 w-3" />
      <span>
        {completed}/{total}
      </span>
      {showBar && (
        <Progress value={progress} className="h-1.5 w-16" />
      )}
    </div>
  );
}
