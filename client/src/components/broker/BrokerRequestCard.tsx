import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, MapPin, ChevronRight, Building2 } from 'lucide-react';
import type { TransferRequest, TransferRequestStatus } from '@/types/transfers';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';

/*
 * Azul Cars Brand – Request Card
 * Card: #FFFFFF on #F5F3EF bg | Navy: #001321 | Gold: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow | Labels: Montserrat 700 uppercase
 */

interface BrokerRequestCardProps {
  request: TransferRequest;
}

const STATUS_STYLES: Record<TransferRequestStatus, { bg: string; text: string; border: string; label: string }> = {
  pendiente:           { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', label: 'Pendiente' },
  en_gestion:          { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', label: 'En gestión' },
  presupuesto_enviado: { bg: '#FFEDD5', text: '#9A3412', border: '#F97316', label: 'Ppto. Enviado' },
  confirmado:          { bg: '#DCFCE7', text: '#166534', border: '#22C55E', label: 'Confirmado' },
  completado:          { bg: '#F0FDF4', text: '#15803D', border: '#4ADE80', label: 'Completado' },
  cancelado:           { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444', label: 'Cancelado' },
};

export function BrokerRequestCard({ request }: BrokerRequestCardProps) {
  const { broker } = useBrokerAuth();
  const statusStyle = STATUS_STYLES[request.status];
  const isOwnRequest = broker?.id === request.broker_id;
  const firstItem = request.items?.[0];

  return (
    <Link to={`/broker/request/${request.id}`} className="block group">
      <div
        className="rounded-lg p-4 sm:p-5 transition-all duration-200 group-hover:shadow-md"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E2DB',
          borderLeft: `3px solid ${statusStyle.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Main Info */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-sm"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  color: 'oklch(0.72 0.10 80)',
                  letterSpacing: '0.02em',
                }}
              >
                {request.request_number}
              </span>
              <span
                className="px-2.5 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {statusStyle.label}
              </span>
            </div>

            {/* Client name */}
            <h3
              className="text-lg mb-2 truncate"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                color: '#001321',
              }}
            >
              {request.client_name}
            </h3>

            {/* Broker info */}
            <div
              className="flex items-center gap-2 text-sm mb-3"
              style={{ color: '#52555B', fontFamily: 'Barlow, sans-serif' }}
            >
              <Building2 className="h-4 w-4" style={{ color: '#9CA3AF' }} />
              <span>
                {request.broker_name}
                {isOwnRequest && (
                  <span
                    className="ml-1 text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(0,19,33,0.08)',
                      color: '#001321',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                      fontSize: '9px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    TÚ
                  </span>
                )}
              </span>
            </div>

            {/* Details row */}
            <div
              className="flex flex-wrap items-center gap-4 text-sm"
              style={{ color: '#6B7280', fontFamily: 'Barlow, sans-serif' }}
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
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: '#9CA3AF',
                }}
              >
                Trayectos
              </div>
              <div
                className="text-xl"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  color: '#001321',
                }}
              >
                {request.items_count || 0}
              </div>
            </div>

            {['presupuesto_enviado', 'confirmado', 'completado'].includes(request.status) &&
            request.total_amount != null &&
            request.total_amount > 0 ? (
              <div className="text-right">
                <div
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '10px',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: '#9CA3AF',
                  }}
                >
                  Importe (sin IVA)
                </div>
                <div
                  className="text-lg"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    color: '#001321',
                  }}
                >
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(request.total_amount)}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div
                  className="italic"
                  style={{
                    fontFamily: 'Barlow, sans-serif',
                    fontSize: '12px',
                    color: '#9CA3AF',
                  }}
                >
                  Pendiente de cotizar
                </div>
              </div>
            )}

            <ChevronRight
              className="h-5 w-5 group-hover:translate-x-1 transition-transform"
              style={{ color: '#9CA3AF' }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
