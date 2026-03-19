import { AreaVisibility } from '@/types/areas';
import { Badge } from '@/components/ui/badge';
import { Lock, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisibilityBadgeProps {
  visibility: AreaVisibility;
  className?: string;
}

export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  if (visibility === 'org') {
    return null; // No badge for public areas
  }

  const config = {
    admins: {
      label: 'Directiva',
      icon: Lock,
      variant: 'secondary' as const,
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    custom: {
      label: 'Restringido',
      icon: Settings,
      variant: 'secondary' as const,
      className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    },
  };

  const { label, icon: Icon, className: badgeClassName } = config[visibility];

  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 text-xs font-medium gap-1', badgeClassName, className)}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
