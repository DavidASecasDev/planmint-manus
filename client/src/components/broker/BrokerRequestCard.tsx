import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, MapPin, ChevronRight, Building2 } from 'lucide-react';
import type { TransferRequest, TransferRequestStatus } from '@/types/transfers';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';

interface BrokerRequestCardProps {
  request: TransferRequest;
}

const STATUS_STYLES: Record<TransferRequestStatus, { bg: string; bgDark: string; text: string; label: string }> = {
  pendiente:  { bg: '#fef3c7', bgDark: '#451a0320', text: '#92400e', label: 'Pendiente' },
  en_gestion: { bg: '#dbeafe', bgDark: '#1e3a8a20', text: '#1e40af', label: 'En gestión' },
  presupuesto_enviado: { bg: '#fff7ed', bgDark: '#7c2d1220', text: '#c2410c', label: 'Ppto. Enviado' },
  confirmado: { bg: '#d1fae5', bgDark: '#06402820', text: '#065f46', label: 'Confirmado' },
  completado: { bg: '#e0e7ff', bgDark: '#3730a320', text: '#3730a3', label: 'Completado' },
  cancelado:  { bg: '#fee2e2', bgDark: '#99111120', text: '#991b1b', label: 'Cancelado' },
};

export function BrokerRequestCard({ request }: BrokerRequestCardProps) {
  const { broker } = useBrokerAuth();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';

  const statusStyle = STATUS_STYLES[request.status];
  const isOwnRequest = broker?.id === request.broker_id;

  const firstItem = request.items?.[0];

  const cardBg = isDark ? '#1e293b' : 'white';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const cardHoverBorder = isDark ? '#475569' : '#d1d5db';
  const textPrimary = isDark ? '#e2e8f0' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#6b7280';
  const textMuted = isDark ? '#64748b' : '#9ca3af';

  return (
    <Link to={`/broker/request/${request.id}`} className="block group">
      <div
        className="rounded-lg border p-4 sm:p-5 transition-all duration-200 hover:shadow-md"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
          borderLeft: '4px solid #b8860b',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Main Info */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-3 mb-2">
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: isDark ? '#93c5fd' : '#1a365d' }}
              >
                {request.request_number}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: isDark ? statusStyle.bgDark : statusStyle.bg,
                  color: statusStyle.text,
                }}
              >
                {statusStyle.label}
              </span>
            </div>

            {/* Client name */}
            <h3
              className="text-lg font-semibold mb-2 truncate"
              style={{ color: textPrimary }}
            >
              {request.client_name}
            </h3>

            {/* Broker info */}
            <div
              className="flex items-center gap-2 text-sm mb-3"
              style={{ color: textSecondary }}
            >
              <Building2 className="h-4 w-4" style={{ color: textMuted }} />
              <span>
                {request.broker_name}
                {isOwnRequest && (
                  <span
                    className="ml-1 text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: isDark ? '#b8860b35' : '#b8860b20',
                      color: isDark ? '#d4a017' : '#7a5c08',
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
              style={{ color: textSecondary }}
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
                className="text-xs uppercase tracking-wide"
                style={{ color: textSecondary }}
              >
                Trayectos
              </div>
              <div
                className="text-xl font-bold"
                style={{ color: isDark ? '#93c5fd' : '#1a365d' }}
              >
                {request.items_count || 0}
              </div>
            </div>

            {['presupuesto_enviado', 'confirmado', 'completado'].includes(request.status) && request.total_amount != null && request.total_amount > 0 ? (
              <div className="text-right">
                <div
                  className="text-xs uppercase tracking-wide"
                  style={{ color: textSecondary }}
                >
                  Importe (sin IVA)
                </div>
                <div className="text-lg font-bold" style={{ color: '#b8860b' }}>
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
                  style={{ color: isDark ? '#64748b' : '#6b7280', fontSize: '11px' }}
                >
                  Pendiente de cotizar
                </div>
              </div>
            )}

            <ChevronRight
              className="h-5 w-5 group-hover:translate-x-1 transition-transform"
              style={{ color: textMuted }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
