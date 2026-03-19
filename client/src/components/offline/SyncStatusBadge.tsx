import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  className?: string;
  showLabel?: boolean;
}

export const SyncStatusBadge = ({ status, className, showLabel = false }: SyncStatusBadgeProps) => {
  const config = {
    synced: {
      icon: Cloud,
      label: 'Sincronizado',
      className: 'text-green-500',
    },
    pending: {
      icon: CloudOff,
      label: 'Pendiente',
      className: 'text-amber-500',
    },
    syncing: {
      icon: RefreshCw,
      label: 'Sincronizando',
      className: 'text-blue-500 animate-spin',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      className: 'text-destructive',
    },
    offline: {
      icon: CloudOff,
      label: 'Offline',
      className: 'text-muted-foreground',
    },
  };

  const { icon: Icon, label, className: statusClassName } = config[status];

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Icon className={cn("h-3.5 w-3.5", statusClassName)} />
      {showLabel && (
        <span className={cn("text-xs", statusClassName)}>{label}</span>
      )}
    </span>
  );
};
