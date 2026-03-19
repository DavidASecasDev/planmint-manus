import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBrokerRequestDetail, useBrokerRequests } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getVehicleInfo } from '@/lib/transferPricing';
import type { TransferItemVehicle } from '@/types/transfers';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Loader2, 
  Calendar, 
  Users, 
  MapPin, 
  Clock,
  User,
  Phone,
  RotateCcw,
  AlertCircle,
  Building2,
  Car,
  Pencil,
  Info,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import type { TransferRequestStatus, TransferItem } from '@/types/transfers';

const STATUS_STYLES: Record<TransferRequestStatus, { bg: string; bgDark: string; text: string; textDark: string; label: string }> = {
  pendiente:  { bg: '#fef3c7', bgDark: '#78350f30', text: '#92400e', textDark: '#fbbf24', label: 'Pendiente' },
  en_gestion: { bg: '#dbeafe', bgDark: '#1e3a8a30', text: '#1e40af', textDark: '#93c5fd', label: 'En gestión' },
  presupuesto_enviado: { bg: '#fff7ed', bgDark: '#7c2d1230', text: '#c2410c', textDark: '#fb923c', label: 'Ppto. Enviado' },
  confirmado: { bg: '#d1fae5', bgDark: '#06402830', text: '#065f46', textDark: '#34d399', label: 'Confirmado' },
  completado: { bg: '#e0e7ff', bgDark: '#3730a330', text: '#3730a3', textDark: '#a5b4fc', label: 'Completado' },
  cancelado:  { bg: '#fee2e2', bgDark: '#7f1d1d30', text: '#991b1b', textDark: '#f87171', label: 'Cancelado' },
};

export default function BrokerRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { broker } = useBrokerAuth();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';
  const { data: request, isLoading, error } = useBrokerRequestDetail(id);
  const { updateRequestStatus, isUpdatingStatus } = useBrokerRequests();
  const [statusAction, setStatusAction] = useState<'confirmado' | 'en_gestion' | null>(null);

  // Paleta Nautical Luxury
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const titleColor = isDark ? '#93c5fd' : '#1a365d';
  const textPrimary = isDark ? '#e2e8f0' : '#111827';
  const textSecondary = isDark ? '#94a3b8' : '#6b7280';
  const textMuted = isDark ? '#64748b' : '#9ca3af';

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: titleColor }} />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: textPrimary }}>
            Solicitud no encontrada
          </h2>
          <p className="mb-4" style={{ color: textSecondary }}>
            No se pudo cargar la información de esta solicitud
          </p>
          <button
            onClick={() => navigate('/broker')}
            className="text-sm hover:underline"
            style={{ color: titleColor }}
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[request.status];
  const isOwnRequest = broker?.id === request.broker_id;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/broker')}
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity"
          style={{ color: titleColor }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 
                className="text-2xl font-bold"
                style={{ color: titleColor }}
              >
                {request.request_number}
              </h1>
              <span 
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ 
                  backgroundColor: isDark ? statusStyle.bgDark : statusStyle.bg, 
                  color: isDark ? statusStyle.textDark : statusStyle.text,
                }}
              >
                {statusStyle.label}
              </span>
            </div>
            <div 
              className="w-16 h-1 rounded"
              style={{ backgroundColor: '#b8860b' }}
            />
          </div>

          {/* Edit button - only for own pending requests */}
          {isOwnRequest && request.status === 'pendiente' && (
            <Button
              onClick={() => navigate(`/broker/request/${id}/edit`)}
              variant="outline"
              style={{ borderColor: '#b8860b', color: '#b8860b' }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar solicitud
            </Button>
          )}
        </div>

        {/* Info banner when request is no longer editable */}
        {isOwnRequest && request.status === 'en_gestion' && (
          <div 
            className="mt-4 flex items-start gap-3 p-3 rounded-lg text-sm"
            style={{ 
              backgroundColor: isDark ? '#1e3a8a30' : '#dbeafe', 
              color: isDark ? '#93c5fd' : '#1e40af',
              border: `1px solid ${isDark ? '#1e3a8a60' : '#bfdbfe'}`,
            }}
          >
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Esta solicitud está siendo gestionada y ya no se puede editar. Contacta con nosotros si necesitas hacer cambios.</span>
          </div>
        )}

        {/* Quote acceptance block for presupuesto_enviado */}
        {isOwnRequest && request.status === 'presupuesto_enviado' && (() => {
          const subtotal = (request.items || []).reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
          const iva = subtotal * 0.21;
          const total = subtotal + iva;
          const fmt = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

          return (
            <div 
              className="mt-4 rounded-lg p-5"
              style={{ 
                backgroundColor: isDark ? '#7c2d1215' : '#fff7ed', 
                border: `2px solid ${isDark ? '#c2410c50' : '#fb923c60'}`,
              }}
            >
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#fb923c' : '#c2410c' }}>
                <Info className="h-5 w-5" />
                Presupuesto pendiente de confirmación
              </h3>
              <p className="text-sm mb-4" style={{ color: textSecondary }}>
                Revisa el importe y confirma o solicita cambios.
              </p>
              
              <div 
                className="rounded-lg p-4 mb-4"
                style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${cardBorder}` }}
              >
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between" style={{ color: textSecondary }}>
                    <span>Subtotal (sin IVA):</span>
                    <span>{fmt(subtotal)} €</span>
                  </div>
                  <div className="flex justify-between" style={{ color: textSecondary }}>
                    <span>IVA 21%:</span>
                    <span>{fmt(iva)} €</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2" style={{ color: textPrimary, borderTop: `1px solid ${cardBorder}` }}>
                    <span>Total:</span>
                    <span>{fmt(total)} €</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    setStatusAction('confirmado');
                    await updateRequestStatus({ id: request.id, status: 'confirmado' });
                    setStatusAction(null);
                  }}
                  disabled={isUpdatingStatus}
                  className="flex-1 gap-2"
                  style={{ backgroundColor: '#16a34a', color: 'white' }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {statusAction === 'confirmado' ? 'Aceptando...' : 'Aceptar Presupuesto'}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setStatusAction('en_gestion');
                    await updateRequestStatus({ id: request.id, status: 'en_gestion' });
                    setStatusAction(null);
                  }}
                  disabled={isUpdatingStatus}
                  className="flex-1 gap-2"
                  style={{ borderColor: '#dc2626', color: '#dc2626' }}
                >
                  <XCircle className="h-4 w-4" />
                  {statusAction === 'en_gestion' ? 'Enviando...' : 'Rechazar / Solicitar cambios'}
                </Button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Client Info Card */}
      <div
        className="rounded-lg border p-6 mb-6"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <h2 
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: titleColor }}
        >
          <Users className="h-5 w-5" />
          Información del Cliente
        </h2>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm" style={{ color: textSecondary }}>Cliente</label>
            <p className="font-medium mt-0.5" style={{ color: textPrimary }}>{request.client_name}</p>
          </div>
          
          <div>
            <label className="text-sm" style={{ color: textSecondary }}>Broker</label>
            <p className="font-medium mt-0.5 flex items-center gap-2" style={{ color: textPrimary }}>
              <Building2 className="h-4 w-4" style={{ color: textMuted }} />
              {request.broker_name}
              {isOwnRequest && (
                <span 
                  className="text-xs px-1.5 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: '#b8860b25', color: isDark ? '#d4a017' : '#7a5c08' }}
                >
                  (tú)
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="text-sm" style={{ color: textSecondary }}>Fecha de creación</label>
            <p className="font-medium mt-0.5" style={{ color: textPrimary }}>
              {format(new Date(request.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>

          {request.notes && (
            <div className="sm:col-span-2">
              <label className="text-sm" style={{ color: textSecondary }}>Notas</label>
              <p className="mt-0.5 whitespace-pre-wrap" style={{ color: textPrimary }}>{request.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Items */}
      <div className="mb-6">
        <h2 
          className="text-lg font-semibold mb-4"
          style={{ color: titleColor }}
        >
          Trayectos ({request.items?.length || 0})
        </h2>

        <div className="space-y-4">
          {request.items?.map((item, index) => (
            <TransferItemDetail
              key={item.id}
              item={item}
              index={index}
              organizationId={broker?.organization_id}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              cardBg={cardBg}
              cardBorder={cardBorder}
              titleColor={titleColor}
              requestStatus={request.status}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TransferItemDetailProps {
  item: TransferItem;
  index: number;
  organizationId?: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  requestStatus: TransferRequestStatus;
}

function TransferItemDetail({ item, index, isDark, textPrimary, textSecondary, textMuted, cardBg, cardBorder, titleColor, requestStatus }: TransferItemDetailProps) {
  const { data: additionalVehicles = [] } = useQuery({
    queryKey: ['broker-item-vehicles', item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transfer_item_vehicles')
        .select('*')
        .eq('transfer_item_id', item.id)
        .order('position');
      if (error) throw error;
      return (data ?? []) as TransferItemVehicle[];
    },
    enabled: !!item.id,
  });

  const hasDriver = item.driver_name && !item.driver_pending;

  const headerBg = isDark ? '#0f172a' : '#f8fafc';
  const dividerColor = isDark ? '#334155' : '#e2e8f0';

  // Píldoras de íconos adaptadas al tema
  const pickupPillBg = isDark ? 'rgba(20,83,45,0.3)' : '#dcfce7';
  const pickupIconColor = isDark ? '#4ade80' : '#16a34a';
  const dropoffPillBg = isDark ? 'rgba(127,29,29,0.3)' : '#fee2e2';
  const dropoffIconColor = isDark ? '#f87171' : '#dc2626';
  const driverPillBg = isDark ? 'rgba(30,58,138,0.3)' : '#dbeafe';
  const driverIconColor = isDark ? '#93c5fd' : '#2563eb';

  const itemStatusBg = item.status === 'confirmado'
    ? (isDark ? 'rgba(6,64,40,0.35)' : '#d1fae5')
    : (isDark ? 'rgba(120,53,15,0.35)' : '#fef3c7');
  const itemStatusText = item.status === 'confirmado'
    ? (isDark ? '#34d399' : '#065f46')
    : (isDark ? '#fbbf24' : '#92400e');

  return (
    <div 
      className="rounded-lg border overflow-hidden"
      style={{ 
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderLeft: '4px solid #b8860b',
      }}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: headerBg, borderBottom: `1px solid ${dividerColor}` }}
      >
        <span className="font-medium" style={{ color: titleColor }}>
          Trayecto {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {['presupuesto_enviado', 'confirmado', 'completado'].includes(requestStatus) && item.price_with_commission != null && item.price_with_commission > 0 && (
            <span 
              className="px-2.5 py-0.5 rounded text-sm font-bold"
              style={{ backgroundColor: '#b8860b20', color: isDark ? '#d4a017' : '#b8860b' }}
            >
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.price_with_commission)} €
            </span>
          )}
          <span 
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: itemStatusBg, color: itemStatusText }}
          >
            {item.status === 'confirmado' ? 'Confirmado' : 'Pendiente'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Date, Pax & Vehicle */}
        <div className="flex flex-wrap gap-4">
          {item.transfer_date && (
            <div className="flex items-center gap-2 text-sm" style={{ color: textPrimary }}>
              <Calendar className="h-4 w-4" style={{ color: textMuted }} />
              <span className="font-medium">
                {format(new Date(item.transfer_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
          )}
          {item.pax_count && (
            <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary }}>
              <Users className="h-4 w-4" style={{ color: textMuted }} />
              <span>{item.pax_count} pasajero(s)</span>
            </div>
          )}
          {item.vehicle_type && (
            <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary }}>
              <Car className="h-4 w-4" style={{ color: textMuted }} />
              <span>{getVehicleInfo(item.vehicle_type)?.label || item.vehicle_type}</span>
            </div>
          )}
          {additionalVehicles.map((av) => (
            <div key={av.id} className="flex items-center gap-2 text-sm" style={{ color: textSecondary }}>
              <Car className="h-4 w-4" style={{ color: textMuted }} />
              <span>{getVehicleInfo(av.vehicle_type)?.label || av.vehicle_type}</span>
              {av.driver_name && (
                <span style={{ color: textMuted }}>· {av.driver_name}</span>
              )}
            </div>
          ))}
        </div>

        {/* Pickup */}
        {item.pickup_enabled && item.pickup_location && (
          <div className="flex items-start gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: pickupPillBg }}
            >
              <MapPin className="h-4 w-4" style={{ color: pickupIconColor }} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: textMuted }}>Recogida</label>
              <p className="font-medium mt-0.5" style={{ color: textPrimary }}>{item.pickup_location}</p>
              {item.pickup_time && (
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary }}>
                  <Clock className="h-3.5 w-3.5" />
                  {item.pickup_time}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Dropoff */}
        {item.dropoff_enabled && item.dropoff_location && (
          <div className="flex items-start gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: dropoffPillBg }}
            >
              <MapPin className="h-4 w-4" style={{ color: dropoffIconColor }} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide" style={{ color: textMuted }}>Llegada</label>
              <p className="font-medium mt-0.5" style={{ color: textPrimary }}>{item.dropoff_location}</p>
              {item.dropoff_time && (
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary }}>
                  <Clock className="h-3.5 w-3.5" />
                  {item.dropoff_time}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Driver Info */}
        <div 
          className="pt-4"
          style={{ borderTop: `1px solid ${dividerColor}` }}
        >
          {hasDriver ? (
            <div className="flex items-start gap-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: driverPillBg }}
              >
                <User className="h-4 w-4" style={{ color: driverIconColor }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide" style={{ color: textMuted }}>Conductor asignado</label>
                <p className="font-medium mt-0.5" style={{ color: textPrimary }}>{item.driver_name}</p>
                {item.driver_phone && (
                  <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary }}>
                    <Phone className="h-3.5 w-3.5" />
                    {item.driver_phone}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary }}>
              <Clock className="h-4 w-4" />
              <span>Conductor pendiente de asignar</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {item.notes && (
          <div 
            className="pt-4"
            style={{ borderTop: `1px solid ${dividerColor}` }}
          >
            <label className="text-xs uppercase tracking-wide" style={{ color: textMuted }}>Notas</label>
            <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: textPrimary }}>{item.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
