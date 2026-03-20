import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, MapPin, ChevronRight, Building2 } from 'lucide-react';
import type { TransferRequest, TransferRequestStatus } from '@/types/transfers';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';

interface BrokerRequestCardProps {
  request: TransferRequest;
}

const STATUS_STYLES: Record<TransferRequestStatus, { bg: string; text: string; label: string }> = {
  pendiente:        { bg: 'rgba(251, 191, 36, 0.12)', text: '#FBBF24', label: 'Pendiente' },
  en_gestion:       { bg: 'rgba(96, 165, 250, 0.12)', text: '#60A5FA', label: 'En gestión' },
  presupuesto_enviado: { bg: 'rgba(251, 146, 60, 0.12)', text: '#FB923C', label: 'Ppto. Enviado' },
  confirmado:       { bg: 'rgba(52, 211, 153, 0.12)', text: '#34D399', label: 'Confirmado' },
  completado:       { bg: 'rgba(163, 230, 53, 0.12)', text: '#A3E635', label: 'Completado' },
  cancelado:        { bg: 'rgba(248, 113, 113, 0.12)', text: '#F87171', label: 'Cancelado' },
};

export function BrokerRequestCard({ request }: BrokerRequestCardProps) {
  const { broker } = useBrokerAuth();
  const statusStyle = STATUS_STYLES[request.status];
  const isOwnRequest = broker?.id === request.broker_id;
  const firstItem = request.items?.[0];

  return (
    <Link to={`/broker/request/${request.id}`} className="block group">
      <div
        className="rounded-lg p-4 sm:p-5 transition-all duration-200 group-hover:border-opacity-40"
        style={{
          backgroundColor: '#161B22',
          border: '1px solid rgba(163, 230, 53, 0.08)',
          borderLeft: '3px solid #A3E635',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Main Info */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-3 mb-2">
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: '#A3E635' }}
              >
                {request.request_number}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                }}
              >
                {statusStyle.label}
              </span>
            </div>

            {/* Client name */}
            <h3
              className="text-lg font-semibold mb-2 truncate"
              style={{ color: '#E6EDF3' }}
            >
              {request.client_name}
            </h3>

            {/* Broker info */}
            <div
              className="flex items-center gap-2 text-sm mb-3"
              style={{ color: 'rgba(230, 237, 243, 0.5)' }}
            >
              <Building2 className="h-4 w-4" style={{ color: 'rgba(230, 237, 243, 0.3)' }} />
              <span>
                {request.broker_name}
                {isOwnRequest && (
                  <span
                    className="ml-1 text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(163, 230, 53, 0.15)',
                      color: '#A3E635',
                    }}
                  >
                    (tú)
                  </span>
                )}
              </span>
            </div>

            {/* Details row */}
            <div
              className="flex flex-wrap items-center gap-4 text-sm"
              style={{ color: 'rgba(230, 237, 243, 0.5)' }}
            >
              {request.first_transfer_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(request.first_transfer_date), 'd MMM yyyy', { locale: es })}
                  </span>
                </div>
              )}

              {firstItem && (firstItem as any).pickup_location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">
                    {(firstItem as any).pickup_location}
                    {(firstItem as any).dropoff_location && (
                      <> → {(firstItem as any).dropoff_location}</>
                    )}
                  </span>
                </div>
              )}

              {firstItem && (firstItem as any).pax_count && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{(firstItem as any).pax_count} pax</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side info */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
            <div className="text-right">
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: 'rgba(230, 237, 243, 0.4)' }}
              >
                Trayectos
              </div>
              <div
                className="text-xl font-bold"
                style={{ color: '#A3E635' }}
              >
                {request.items_count || 0}
              </div>
            </div>

            {['presupuesto_enviado', 'confirmado', 'completado'].includes(request.status) &&
            request.total_amount != null &&
            request.total_amount > 0 ? (
              <div className="text-right">
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'rgba(230, 237, 243, 0.4)' }}
                >
                  Importe (sin IVA)
                </div>
                <div className="text-lg font-bold" style={{ color: '#E6EDF3' }}>
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(request.total_amount)}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div
                  className="text-xs italic"
                  style={{ color: 'rgba(230, 237, 243, 0.3)', fontSize: '11px' }}
                >
                  Pendiente de cotizar
                </div>
              </div>
            )}

            <ChevronRight
              className="h-5 w-5 group-hover:translate-x-1 transition-transform"
              style={{ color: 'rgba(230, 237, 243, 0.3)' }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
