import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RentlyAuditEntry {
  id: string;
  created_at: string;
  action: string;
  actor: { id: string; name: string } | null;
  metadata_json: string | null;
}

interface ParsedMetadata {
  rently_action?: string;
  label?: string;
  success?: boolean;
  rentlyStatus?: number;
  elapsed?: number;
  requestData?: Record<string, unknown>;
}

interface RentlyActionHistoryProps {
  reservationId: string;
  externalReservationId: string;
}

const ACTION_LABELS: Record<string, string> = {
  'rently.booking.confirm': 'Confirmar reserva',
  'rently.booking.cancel': 'Cancelar reserva',
  'rently.booking.uncancel': 'Reactivar reserva',
  'rently.booking.update': 'Actualizar reserva',
  'rently.booking.create': 'Crear reserva',
  'rently.booking.assign_driver': 'Asignar conductor',
  'rently.operations.delivery': 'Procesar entrega',
  'rently.operations.return': 'Procesar devolución',
  'rently.customer.create': 'Crear cliente',
  'rently.customer.update': 'Actualizar cliente',
  'rently.cars.relocate': 'Reubicar vehículo',
  'rently.cars.transfer': 'Transferir vehículo',
};

export function RentlyActionHistory({ reservationId, externalReservationId }: RentlyActionHistoryProps) {
  const [entries, setEntries] = useState<RentlyAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!externalReservationId) return;

    async function fetchHistory() {
      setLoading(true);
      setError(null);

      try {
        // Query audit_logs for rently actions related to this booking
        const { data, error: fetchError } = await supabase
          .from('audit_logs')
          .select('id, created_at, action, actor_user_id, metadata_json')
          .eq('entity_type', 'rently_action')
          .like('action', 'rently.%')
          .order('created_at', { ascending: false })
          .limit(50);

        if (fetchError) {
          setError('Error al cargar el historial de acciones');
          console.error('[RentlyActionHistory] Fetch error:', fetchError);
          return;
        }

        // Filter entries that match this booking ID from metadata
        const filtered = (data || []).filter((entry: any) => {
          if (!entry.metadata_json) return false;
          try {
            const meta = JSON.parse(entry.metadata_json);
            const requestData = meta.requestData || {};
            const bookingId = requestData.Id || requestData.BookingId || requestData.bookingId;
            return String(bookingId) === externalReservationId;
          } catch {
            return false;
          }
        });

        // Resolve actor names from profiles
        const actorIds = Array.from(new Set(filtered.map((e: any) => e.actor_user_id).filter(Boolean)));
        let profileMap: Record<string, string> = {};
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', actorIds);
          if (profiles) {
            profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.name]));
          }
        }

        // Attach actor name to entries
        const enriched = filtered.map((entry: any) => ({
          ...entry,
          actor: entry.actor_user_id ? { id: entry.actor_user_id, name: profileMap[entry.actor_user_id] || 'Usuario' } : null,
        }));

        setEntries(enriched as unknown as RentlyAuditEntry[]);
      } catch (err) {
        setError('Error inesperado al cargar historial');
        console.error('[RentlyActionHistory] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [externalReservationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando historial de Rently...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No se han ejecutado acciones de Rently para esta reserva
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Las acciones como confirmar, cancelar o procesar entregas aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Acciones ejecutadas en Rently</h3>
        <Badge variant="outline" className="text-xs ml-auto">
          {entries.length} {entries.length === 1 ? 'acción' : 'acciones'}
        </Badge>
      </div>

      <div className="space-y-0">
        {entries.map((entry, idx) => {
          let meta: ParsedMetadata = {};
          try {
            meta = entry.metadata_json ? JSON.parse(entry.metadata_json) : {};
          } catch { /* ignore */ }

          const actionLabel = ACTION_LABELS[entry.action] || meta.label || entry.action;
          const success = meta.success !== false;
          const elapsed = meta.elapsed;
          const actorName = entry.actor?.name || 'Sistema';
          const timestamp = new Date(entry.created_at);

          return (
            <div key={entry.id}>
              <div className="flex items-start gap-3 py-3">
                {/* Status icon */}
                <div className={`mt-0.5 rounded-full p-1 ${success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {success ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{actionLabel}</span>
                    {!success && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Error
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {actorName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {actorName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timestamp.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' '}
                      {timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {elapsed !== undefined && (
                      <span className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {idx < entries.length - 1 && <Separator />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
