import { History, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRepairHistory } from '@/hooks/useRepairHistory';
import { REPAIR_STATUS_LABELS, REPAIR_HISTORY_ACTION_LABELS, type RepairHistoryAction } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepairHistoryTabProps {
  repairId: string;
}

const ACTION_ICONS: Record<RepairHistoryAction, string> = {
  created: '🆕',
  status_change: '🔄',
  edited: '✏️',
  invoice_added: '📄',
  invoice_removed: '🗑️',
  photo_added: '📷',
  photo_removed: '🗑️',
  comment_added: '💬',
};

export function RepairHistoryTab({ repairId }: RepairHistoryTabProps) {
  const { history, isLoading } = useRepairHistory(repairId);

  const getStatusLabel = (status: string | null | undefined): string => {
    if (!status) return status ?? '';
    return REPAIR_STATUS_LABELS[status as keyof typeof REPAIR_STATUS_LABELS] || status;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No hay historial todavía</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {history.map((entry, index) => (
          <div key={entry.id} className="relative flex gap-4 pl-8">
            {/* Timeline dot */}
            <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center gap-2 text-sm">
                <span>{ACTION_ICONS[entry.action as RepairHistoryAction] || '📌'}</span>
                <span className="font-medium">
                  {REPAIR_HISTORY_ACTION_LABELS[entry.action as RepairHistoryAction] || entry.action}
                </span>
              </div>

              {/* Status change details */}
              {entry.action === 'status_change' ? (
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{getStatusLabel(entry.from_value)}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">
                    {getStatusLabel(entry.to_value)}
                  </span>
                </div>
              ) : null}

              {/* Metadata details for other actions */}
              {entry.action === 'invoice_added' && entry.metadata?.file_name ? (
                <p className="text-sm text-muted-foreground mt-1">
                  📄 {String(entry.metadata.file_name)}
                </p>
              ) : null}

              {entry.action === 'photo_added' && entry.to_value && (
                <p className="text-sm text-muted-foreground mt-1">
                  Tipo: {entry.to_value === 'before' ? 'Antes' : 'Después'}
                </p>
              )}

              {/* User and time */}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {entry.user?.name && <span>{entry.user.name}</span>}
                <span>·</span>
                <span>
                  {format(new Date(entry.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
