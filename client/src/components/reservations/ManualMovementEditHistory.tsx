import { useEffect, useState } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Pencil, ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FieldChange {
  field: string;
  label: string;
  old_value: string | null;
  new_value: string | null;
}

interface EditHistoryEntry {
  id: string;
  reservation_id: string;
  external_reservation_id: string | null;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  changes: FieldChange[];
  created_at: string;
}

interface Props {
  reservationId: string;
  externalReservationId?: string | null;
}

export function ManualMovementEditHistory({ reservationId, externalReservationId }: Props) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only show for manual movements
  const isManual = externalReservationId?.startsWith('MANUAL-');

  useEffect(() => {
    if (!isManual) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const result = await apiInvoke<EditHistoryEntry[]>('get-manual-movement-history', {
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
          setError(err?.message || 'Error al cargar historial de ediciones');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [reservationId, isManual]);

  if (!isManual) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando historial de ediciones...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Pencil className="h-7 w-7 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No hay ediciones registradas para este movimiento manual.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Las ediciones realizadas a este movimiento aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Pencil className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">
          Historial de ediciones
        </h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {history.length} edición{history.length !== 1 ? 'es' : ''}
        </Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {history.map((entry) => (
            <div key={entry.id} className="relative pl-8">
              {/* Timeline dot */}
              <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 bg-blue-400 border-blue-600" />

              <div className="rounded-lg border border-border bg-card p-3">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-300">
                    <Pencil className="h-2.5 w-2.5 mr-1" />
                    Edición
                  </Badge>
                  {entry.changed_by_name && (
                    <span className="text-[10px] font-medium text-foreground">
                      {entry.changed_by_name}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {format(parseISO(entry.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                </div>

                {/* Changes list */}
                <div className="mt-2 space-y-1.5">
                  {entry.changes.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="font-medium text-muted-foreground min-w-[80px] shrink-0">
                        {change.label}:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        {change.old_value ? (
                          <span className="text-red-600 dark:text-red-400 line-through truncate max-w-[120px]" title={change.old_value}>
                            {change.old_value}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic">vacío</span>
                        )}
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        {change.new_value ? (
                          <span className="text-green-600 dark:text-green-400 font-medium truncate max-w-[120px]" title={change.new_value}>
                            {change.new_value}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic">vacío</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
