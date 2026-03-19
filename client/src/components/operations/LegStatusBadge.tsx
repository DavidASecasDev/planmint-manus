import { Badge } from '@/components/ui/badge';
import { Clock, Navigation, CheckCircle, AlertTriangle } from 'lucide-react';
import type { LegStatus } from '@/types/operations';

interface LegStatusBadgeProps {
  status: LegStatus;
  className?: string;
}

export function LegStatusBadge({ status, className }: LegStatusBadgeProps) {
  const config = {
    pending: {
      label: 'Pendiente',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    en_route: {
      label: 'En camino',
      icon: Navigation,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    done: {
      label: 'Completado',
      icon: CheckCircle,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    issue: {
      label: 'Incidencia',
      icon: AlertTriangle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge variant="outline" className={`${statusClassName} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}
