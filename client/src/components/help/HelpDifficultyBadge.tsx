import { Clock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HelpDifficulty } from '@/data/helpContent';

interface HelpDifficultyBadgeProps {
  difficulty?: HelpDifficulty;
  readTime?: number;
  isNew?: boolean;
  className?: string;
}

const difficultyConfig: Record<HelpDifficulty, { label: string; className: string }> = {
  basic: {
    label: 'Básico',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  intermediate: {
    label: 'Intermedio',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  advanced: {
    label: 'Avanzado',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  },
};

export function HelpDifficultyBadge({ difficulty, readTime, isNew, className }: HelpDifficultyBadgeProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {isNew && (
        <Badge className="bg-gradient-to-r from-primary to-purple-500 text-white border-0 gap-1">
          <Sparkles className="h-3 w-3" />
          Nuevo
        </Badge>
      )}
      
      {difficulty && (
        <Badge variant="outline" className={cn('text-xs', difficultyConfig[difficulty].className)}>
          {difficultyConfig[difficulty].label}
        </Badge>
      )}
      
      {readTime && (
        <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground gap-1">
          <Clock className="h-3 w-3" />
          {readTime} min
        </Badge>
      )}
    </div>
  );
}
