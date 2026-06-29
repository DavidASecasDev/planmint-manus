import { useState, useEffect } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { Loader2, ArrowRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatusHistoryEntry {
  id: string;
  vehicle_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  changed_by_name: string;
  reason: string | null;
  created_at: string;
}

interface VehicleStatusHistoryProps {
  vehicleId: string;
}

const STATUS_LABELS: Record<string, string> = {
  sucio: 'Sucio',
  incompleto: 'En proceso',
  limpio: 'Limpio',
  en_servicio: 'En Servicio',
  alquilado: 'Entregado',
};

const STATUS_COLORS: Record<string, string> = {
  sucio: 'bg-red-100 text-red-700 border-red-200',
  incompleto: 'bg-orange-100 text-orange-700 border-orange-200',
  limpio: 'bg-green-100 text-green-700 border-green-200',
  en_servicio: 'bg-purple-100 text-purple-700 border-purple-200',
  alquilado: 'bg-blue-100 text-blue-700 border-blue-200',
};

export function VehicleStatusHistory({ vehicleId }: VehicleStatusHistoryProps) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: apiError } = await apiInvoke<{ success: boolean; history: StatusHistoryEntry[] }>('get-vehicle-status-history', {
          body: { vehicle_id: vehicleId, limit: 20 },
        });

        if (cancelled) return;

        if (apiError) {
          setError(apiError.message);
          return;
        }

        setHistory(data?.history || []);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Error al cargar historial');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [vehicleId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando historial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No se pudo cargar el historial de cambios.
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No hay cambios manuales de estado registrados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg border bg-muted/30 p-3 space-y-2"
        >
          {/* Status transition */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[entry.from_status] || ''}`}>
              {STATUS_LABELS[entry.from_status] || entry.from_status}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[entry.to_status] || ''}`}>
              {STATUS_LABELS[entry.to_status] || entry.to_status}
            </Badge>
          </div>

          {/* Reason */}
          {entry.reason && (
            <p className="text-xs text-muted-foreground italic">
              {entry.reason}
            </p>
          )}

          {/* Actor and timestamp */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{entry.changed_by_name}</span>
            </div>
            <span>
              {formatDate(entry.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
