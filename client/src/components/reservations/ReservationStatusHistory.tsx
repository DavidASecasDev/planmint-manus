import { useEffect, useState } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, RefreshCw, ArrowRight, Bot, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatusHistoryEntry {
  id: string;
  reservation_id: string;
  external_reservation_id: string | null;
  old_status: string | null;
  new_status: string;
  change_type: string;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  notes: string | null;
  created_at: string;
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  reactivation_auto: { label: 'Reactivación automática', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  manual: { label: 'Cambio manual', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  sync: { label: 'Sincronización', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  cancellation: { label: 'Cancelación', color: 'bg-red-100 text-red-800 border-red-300' },
};

interface Props {
  reservationId: string;
}

export function ReservationStatusHistory({ reservationId }: Props) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const result = await apiInvoke<StatusHistoryEntry[]>('get-reservation-status-history', {
          body: { reservation_id: reservationId },
        });
        if (!cancelled) {
          if (result.error) {
            setError(result.error.message);
          } else {
            setHistory(result.data || []);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Error al cargar historial');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [reservationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando historial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <History className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No hay cambios de estado registrados para esta reserva.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Los eventos de reactivación automática aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">
          Historial de cambios de estado
        </h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {history.length} evento{history.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {history.map((entry) => {
            const typeInfo = CHANGE_TYPE_LABELS[entry.change_type] || CHANGE_TYPE_LABELS.manual;
            const isReactivation = entry.change_type === 'reactivation_auto';

            return (
              <div key={entry.id} className="relative pl-8">
                {/* Timeline dot */}
                <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${
                  isReactivation ? 'bg-amber-400 border-amber-600' : 'bg-background border-muted-foreground/40'
                }`} />

                <div className={`rounded-lg border p-3 ${
                  isReactivation ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800' : 'border-border bg-card'
                }`}>
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] ${typeInfo.color}`}>
                      {isReactivation && <RefreshCw className="h-2.5 w-2.5 mr-1" />}
                      {typeInfo.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {format(parseISO(entry.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>

                  {/* Status change */}
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    {entry.old_status && (
                      <>
                        <span className="font-medium text-muted-foreground">{entry.old_status}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                    <span className="font-medium">{entry.new_status}</span>
                  </div>

                  {/* Notes */}
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {entry.notes}
                    </p>
                  )}

                  {/* Changed by */}
                  {entry.changed_by_name && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                      {entry.change_type === 'reactivation_auto' ? (
                        <Bot className="h-3 w-3" />
                      ) : null}
                      <span>{entry.changed_by_name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
