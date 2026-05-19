import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { TransferStatusBadge } from './TransferStatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, Euro, Building2, User } from 'lucide-react';
import type { TransferRequest, TransferRequestStatus } from '@/types/transfers';

interface TransfersKanbanProps {
  requests: TransferRequest[];
}

const KANBAN_COLUMNS: { status: TransferRequestStatus; label: string; color: string; headerBg: string }[] = [
  { status: 'pendiente', label: 'Pendiente', color: 'border-t-yellow-500', headerBg: 'bg-yellow-500/10' },
  { status: 'en_gestion', label: 'En gestión', color: 'border-t-blue-500', headerBg: 'bg-blue-500/10' },
  { status: 'presupuesto_enviado', label: 'Ppto. Enviado', color: 'border-t-orange-500', headerBg: 'bg-orange-500/10' },
  { status: 'confirmado', label: 'Confirmado', color: 'border-t-green-500', headerBg: 'bg-green-500/10' },
  { status: 'completado', label: 'Completado', color: 'border-t-emerald-600', headerBg: 'bg-emerald-600/10' },
  { status: 'cancelado', label: 'Cancelado', color: 'border-t-red-500', headerBg: 'bg-red-500/10' },
];

export function TransfersKanban({ requests }: TransfersKanbanProps) {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const map: Record<TransferRequestStatus, TransferRequest[]> = {
      pendiente: [],
      en_gestion: [],
      presupuesto_enviado: [],
      confirmado: [],
      completado: [],
      cancelado: [],
    };
    for (const req of requests) {
      if (map[req.status]) {
        map[req.status].push(req);
      }
    }
    return map;
  }, [requests]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {KANBAN_COLUMNS.map((col) => {
        const items = grouped[col.status];
        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-[280px] rounded-xl border border-border/50 border-t-4 ${col.color} bg-card/50`}
          >
            {/* Column header */}
            <div className={`px-3 py-2.5 ${col.headerBg} rounded-t-lg`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
                  {items.length}
                </Badge>
              </div>
            </div>

            {/* Column body */}
            <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Sin solicitudes
                </div>
              ) : (
                items.map((request) => (
                  <KanbanCard
                    key={request.id}
                    request={request}
                    onClick={() => navigate(`/transfers/${request.id}`)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ request, onClick }: { request: TransferRequest; onClick: () => void }) {
  const formattedDate = request.first_transfer_date
    ? format(new Date(request.first_transfer_date), "d MMM", { locale: es })
    : null;

  const clientTotal = request.client_total || request.total_amount || 0;
  const itemCount = request.items?.length || request.items_count || 0;

  return (
    <div
      className="rounded-lg border border-border/40 bg-background p-3 cursor-pointer hover:border-border hover:shadow-sm transition-all space-y-2"
      onClick={onClick}
    >
      {/* Header: number + broker */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">{request.request_number}</span>
        {request.pricing_mode === 'zone_tariff' && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            Zona
          </Badge>
        )}
      </div>

      {/* Client name */}
      <div className="font-medium text-sm leading-tight truncate">
        {request.client_name}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {request.broker_name && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {request.broker_name}
          </span>
        )}
        {!request.broker_name && request.created_by && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {request.created_by}
          </span>
        )}
        {formattedDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
        )}
        {itemCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {itemCount}
          </span>
        )}
      </div>

      {/* Price */}
      {clientTotal > 0 && (
        <div className="flex items-center justify-end">
          <span className="text-xs font-semibold text-foreground flex items-center gap-0.5">
            <Euro className="h-3 w-3" />
            {clientTotal.toFixed(2)} €
          </span>
        </div>
      )}
    </div>
  );
}
