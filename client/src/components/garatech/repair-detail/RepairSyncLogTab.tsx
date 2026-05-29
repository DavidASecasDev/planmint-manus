import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepairSyncLogTabProps {
  repairId: string;
}

interface SyncLogEntry {
  id: string;
  repair_id: string;
  organization_id: string;
  action: string;
  direction: 'outbound' | 'inbound';
  rently_service_id: number | null;
  status: string | null;
  details: Record<string, any>;
  error: string | null;
  success: boolean;
  created_by: string | null;
  created_at: string;
  creator?: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Servicio creado en Rently',
  update: 'Servicio actualizado en Rently',
  finish: 'Servicio finalizado en Rently',
  cancel: 'Servicio cancelado en Rently',
  rently_update: 'Cambio detectado desde Rently',
  rently_cancel: 'Cancelado desde Rently',
  rently_finish: 'Finalizado desde Rently',
  rently_deleted: 'Servicio eliminado en Rently',
};

const ACTION_ICONS: Record<string, typeof RefreshCw> = {
  create: ArrowUpRight,
  update: ArrowUpRight,
  finish: CheckCircle2,
  cancel: XCircle,
  rently_update: ArrowDownLeft,
  rently_cancel: ArrowDownLeft,
  rently_finish: ArrowDownLeft,
  rently_deleted: AlertTriangle,
};

export function RepairSyncLogTab({ repairId }: RepairSyncLogTabProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['repair-sync-log', repairId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('repair_sync_log')
        .select(`
          *,
          creator:profiles!repair_sync_log_created_by_fkey(name)
        `)
        .eq('repair_id', repairId)
        .order('created_at', { ascending: false });

      if (error) {
        // If the join fails (FK not set up), try without it
        const { data: fallbackData, error: fallbackError } = await supabaseQuery
          .from('repair_sync_log')
          .select('*')
          .eq('repair_id', repairId)
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        return (fallbackData || []) as SyncLogEntry[];
      }
      return (data || []) as SyncLogEntry[];
    },
    enabled: !!repairId,
  });

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

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No hay registros de sincronización todavía</p>
        <p className="text-xs mt-1">Los registros aparecerán cuando esta reparación se sincronice con Rently</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {logs.map((entry) => {
          const Icon = ACTION_ICONS[entry.action] || RefreshCw;
          const isOutbound = entry.direction === 'outbound';

          return (
            <div key={entry.id} className="relative flex gap-4 pl-8">
              {/* Timeline dot */}
              <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-background ${
                entry.success ? 'bg-primary' : 'bg-destructive'
              }`} />

              <div className="flex-1 min-w-0 pb-4">
                {/* Action header */}
                <div className="flex items-center gap-2 text-sm">
                  <Icon className={`h-4 w-4 ${
                    entry.success 
                      ? isOutbound ? 'text-blue-500' : 'text-green-500'
                      : 'text-destructive'
                  }`} />
                  <span className="font-medium">
                    {ACTION_LABELS[entry.action] || entry.action}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] px-1.5 py-0 ${
                      isOutbound 
                        ? 'border-blue-200 text-blue-600 bg-blue-50' 
                        : 'border-green-200 text-green-600 bg-green-50'
                    }`}
                  >
                    {isOutbound ? 'PlanMint → Rently' : 'Rently → PlanMint'}
                  </Badge>
                  {!entry.success && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Error
                    </Badge>
                  )}
                </div>

                {/* Details */}
                {entry.rently_service_id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Servicio Rently #{entry.rently_service_id}
                  </p>
                )}

                {/* Error message */}
                {entry.error && (
                  <p className="text-xs text-destructive mt-1 bg-destructive/5 rounded px-2 py-1">
                    {entry.error}
                  </p>
                )}

                {/* Date changes detail */}
                {entry.details?.dates_updated && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {entry.details.dates_updated.started_at && (
                      <p>Fecha inicio actualizada: {format(new Date(entry.details.dates_updated.started_at), "d MMM yyyy", { locale: es })}</p>
                    )}
                    {entry.details.dates_updated.scheduled_date && (
                      <p>Fecha fin actualizada: {format(new Date(entry.details.dates_updated.scheduled_date), "d MMM yyyy", { locale: es })}</p>
                    )}
                  </div>
                )}

                {/* Status change detail */}
                {entry.details?.previous_status && entry.status && entry.details.previous_status !== entry.status && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estado: {entry.details.previous_status} → {entry.status}
                  </p>
                )}

                {/* User and time */}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(entry.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                  </span>
                  {entry.creator?.name && (
                    <>
                      <span>·</span>
                      <span>{entry.creator.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
