import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBrokerRequestDetail, useBrokerRequests } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getVehicleInfo } from '@/lib/transferPricing';
import { TransferNotesSection } from '@/components/transfers/TransferNotesSection';
import { StatusTimeline } from '@/components/transfers/StatusTimeline';
import { useTransferStatusHistory } from '@/hooks/useTransferStatusHistory';
import type { TransferItemVehicle } from '@/types/transfers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  XCircle,
} from 'lucide-react';
import type { TransferRequestStatus, TransferItem } from '@/types/transfers';

/*
 * Azul Cars Brand – Request Detail
 * Navy: #001321 | Gold: oklch(0.72 0.10 80) | Warm bg: #F5F3EF
 * Cards: #FFFFFF | Headings: Montserrat 700-800 | Body: Barlow 400
 * Labels: Montserrat 700 uppercase tracking 1.5px
 */

const navy = '#001321';
const gold = 'oklch(0.72 0.10 80)';
const warmBg = '#F5F3EF';
const cardBg = '#FFFFFF';
const cardBorder = '#E5E2DB';
const textPrimary = '#111827';
const textSecondary = '#6B7280';
const textMuted = '#9CA3AF';

const STATUS_STYLES: Record<TransferRequestStatus, { bg: string; text: string; border: string; label: string }> = {
  pendiente:           { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', label: 'Pendiente' },
  en_gestion:          { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', label: 'En gestión' },
  presupuesto_enviado: { bg: '#FFEDD5', text: '#9A3412', border: '#F97316', label: 'Ppto. Enviado' },
  confirmado:          { bg: '#DCFCE7', text: '#166534', border: '#22C55E', label: 'Confirmado' },
  completado:          { bg: '#F0FDF4', text: '#15803D', border: '#4ADE80', label: 'Completado' },
  cancelado:           { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444', label: 'Cancelado' },
};

export default function BrokerRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { broker } = useBrokerAuth();
  const { data: request, isLoading, error } = useBrokerRequestDetail(id);
  const { updateRequestStatus, isUpdatingStatus } = useBrokerRequests();
  const [statusAction, setStatusAction] = useState<'confirmado' | 'en_gestion' | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<'accept' | 'reject' | null>(null);
  const { logStatusChange } = useTransferStatusHistory(id);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: navy }} />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2
            className="text-xl mb-2"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: navy }}
          >
            Solicitud no encontrada
          </h2>
          <p className="mb-4" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
            No se pudo cargar la información de esta solicitud
          </p>
          <button
            onClick={() => navigate('/broker')}
            className="text-sm hover:underline"
            style={{ color: gold, fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
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
          style={{ color: navy, fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1
                className="text-2xl"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: navy }}
              >
                {request.request_number}
              </h1>
              <span
                className="px-3 py-1 rounded text-xs"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {statusStyle.label}
              </span>
            </div>
            <div
              className="w-16 h-1 rounded"
              style={{ background: `linear-gradient(90deg, ${gold}, transparent)` }}
            />
          </div>

          {isOwnRequest && request.status === 'pendiente' && (
            <Button
              onClick={() => navigate(`/broker/request/${id}/edit`)}
              className="gap-2"
              style={{
                backgroundColor: navy,
                color: '#FFFFFF',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <Pencil className="h-4 w-4" />
              Editar solicitud
            </Button>
          )}
        </div>

        {/* Info banner */}
        {isOwnRequest && request.status === 'en_gestion' && (
          <div
            className="mt-4 flex items-start gap-3 p-4 rounded-lg text-sm"
            style={{
              backgroundColor: '#DBEAFE',
              border: '1px solid #BFDBFE',
              color: '#1E40AF',
              fontFamily: 'Barlow, sans-serif',
            }}
          >
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Esta solicitud está siendo gestionada y ya no se puede editar. Contacta con nosotros si necesitas hacer cambios.</span>
          </div>
        )}

        {/* Quote acceptance block */}
        {isOwnRequest && request.status === 'presupuesto_enviado' && (() => {
          const subtotal = (request.items || []).reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
          const iva = subtotal * 0.21;
          const total = subtotal + iva;
          const fmt = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

          return (
            <div
              className="mt-4 rounded-lg p-5"
              style={{
                backgroundColor: '#FFFBEB',
                border: `2px solid oklch(0.72 0.10 80 / 0.4)`,
              }}
            >
              <h3
                className="text-base mb-3 flex items-center gap-2"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  color: navy,
                }}
              >
                <Info className="h-5 w-5" style={{ color: gold }} />
                Presupuesto pendiente de confirmación
              </h3>
              <p className="text-sm mb-4" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                Revisa el importe y confirma o solicita cambios.
              </p>

              <div
                className="rounded-lg p-4 mb-4"
                style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div className="space-y-1 text-sm" style={{ fontFamily: 'Barlow, sans-serif' }}>
                  <div className="flex justify-between" style={{ color: textSecondary }}>
                    <span>Subtotal (sin IVA):</span>
                    <span>{fmt(subtotal)} €</span>
                  </div>
                  <div className="flex justify-between" style={{ color: textSecondary }}>
                    <span>IVA 21%:</span>
                    <span>{fmt(iva)} €</span>
                  </div>
                  <div
                    className="flex justify-between text-base pt-2"
                    style={{
                      color: navy,
                      borderTop: `1px solid ${cardBorder}`,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                    }}
                  >
                    <span>Total:</span>
                    <span>{fmt(total)} €</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setConfirmDialog('accept')}
                  disabled={isUpdatingStatus}
                  className="flex-1 gap-2"
                  style={{
                    backgroundColor: '#16a34a',
                    color: 'white',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {statusAction === 'confirmado' ? 'Aceptando...' : 'Aceptar Presupuesto'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog('reject')}
                  disabled={isUpdatingStatus}
                  className="flex-1 gap-2"
                  style={{
                    borderColor: '#dc2626',
                    color: '#dc2626',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  {statusAction === 'en_gestion' ? 'Enviando...' : 'Rechazar'}
                </Button>
              </div>

              {/* Accept Dialog */}
              <AlertDialog open={confirmDialog === 'accept'} onOpenChange={(open) => !open && setConfirmDialog(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar aceptación del presupuesto</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vas a aceptar el presupuesto por un total de <strong>{fmt(total)} € (IVA incluido)</strong>. Esta acción es irreversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setConfirmDialog(null);
                        setStatusAction('confirmado');
                        await updateRequestStatus({ id: request.id, status: 'confirmado' });
                        await logStatusChange({
                          request_id: request.id,
                          organization_id: broker?.organization_id || '',
                          previous_status: request.status,
                          new_status: 'confirmado',
                          changed_by_type: 'broker',
                          changed_by_id: broker?.id,
                          changed_by_name: broker?.name,
                          note: 'Presupuesto aceptado por el broker',
                        });
                        setStatusAction(null);
                      }}
                      style={{ backgroundColor: '#16a34a', color: 'white' }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Sí, aceptar presupuesto
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Reject Dialog */}
              <AlertDialog open={confirmDialog === 'reject'} onOpenChange={(open) => !open && setConfirmDialog(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rechazar presupuesto</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vas a rechazar el presupuesto actual. La solicitud volverá al estado "En gestión" para que podamos revisarla y enviarte una nueva propuesta.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setConfirmDialog(null);
                        setStatusAction('en_gestion');
                        await updateRequestStatus({ id: request.id, status: 'en_gestion' });
                        await logStatusChange({
                          request_id: request.id,
                          organization_id: broker?.organization_id || '',
                          previous_status: request.status,
                          new_status: 'en_gestion',
                          changed_by_type: 'broker',
                          changed_by_id: broker?.id,
                          changed_by_name: broker?.name,
                          note: 'Presupuesto rechazado, solicitud de cambios',
                        });
                        setStatusAction(null);
                      }}
                      style={{ backgroundColor: '#dc2626', color: 'white' }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Sí, rechazar y solicitar cambios
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })()}
      </div>

      {/* Client Info Card */}
      <div
        className="rounded-lg p-6 mb-6"
        style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <h2
          className="mb-4 flex items-center gap-2"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: textMuted,
          }}
        >
          <Users className="h-4 w-4" />
          Información del Cliente
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: textMuted,
              }}
            >
              Cliente
            </label>
            <p
              className="mt-1"
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, color: textPrimary, fontSize: '15px' }}
            >
              {request.client_name}
            </p>
          </div>

          <div>
            <label
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: textMuted,
              }}
            >
              Broker
            </label>
            <p
              className="mt-1 flex items-center gap-2"
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, color: textPrimary, fontSize: '15px' }}
            >
              <Building2 className="h-4 w-4" style={{ color: textMuted }} />
              {request.broker_name}
              {isOwnRequest && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'rgba(0,19,33,0.08)',
                    color: navy,
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '9px',
                    letterSpacing: '0.05em',
                  }}
                >
                  TÚ
                </span>
              )}
            </p>
          </div>

          <div>
            <label
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: textMuted,
              }}
            >
              Fecha de creación
            </label>
            <p
              className="mt-1"
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, color: textPrimary, fontSize: '15px' }}
            >
              {format(new Date(request.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>

          {request.notes && (
            <div className="sm:col-span-2">
              <label
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: textMuted,
                }}
              >
                Notas
              </label>
              <p
                className="mt-1 whitespace-pre-wrap"
                style={{ fontFamily: 'Barlow, sans-serif', color: textPrimary }}
              >
                {request.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Items */}
      <div className="mb-6">
        <h2
          className="mb-4"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: textMuted,
          }}
        >
          Trayectos ({request.items?.length || 0})
        </h2>

        <div className="space-y-4">
          {request.items?.map((item, index) => (
            <TransferItemDetail
              key={item.id}
              item={item}
              index={index}
              requestStatus={request.status}
            />
          ))}
        </div>
      </div>

      {/* Status History Timeline */}
      <StatusTimeline requestId={request.id} isDark={false} />

      {/* Internal Notes */}
      {broker && request && (
        <div>
          <TransferNotesSection
            requestId={request.id}
            organizationId={broker.organization_id}
            currentBrokerId={broker.id}
            currentAuthorName={broker.name}
            isDark={false}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Transfer Item Detail ─── */

interface TransferItemDetailProps {
  item: TransferItem;
  index: number;
  requestStatus: TransferRequestStatus;
}

function TransferItemDetail({ item, index, requestStatus }: TransferItemDetailProps) {
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

  const itemStatusBg = item.status === 'confirmado' ? '#DCFCE7' : '#FEF3C7';
  const itemStatusText = item.status === 'confirmado' ? '#166534' : '#92400E';

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        borderLeft: `3px solid ${gold}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#FAFAF8', borderBottom: `1px solid ${cardBorder}` }}
      >
        <span
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: navy, fontSize: '14px' }}
        >
          Trayecto {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {['presupuesto_enviado', 'confirmado', 'completado'].includes(requestStatus) &&
            item.price_with_commission != null &&
            item.price_with_commission > 0 && (
              <span
                className="px-2.5 py-0.5 rounded text-sm"
                style={{
                  backgroundColor: 'rgba(0,19,33,0.06)',
                  color: navy,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                }}
              >
                {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.price_with_commission)} €{' '}
                <span className="font-normal text-xs" style={{ color: textMuted }}>(sin IVA)</span>
              </span>
            )}
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: itemStatusBg,
              color: itemStatusText,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '10px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {item.status === 'confirmado' ? 'Confirmado' : 'Pendiente'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Date, Pax & Vehicle */}
        <div className="flex flex-wrap gap-4">
          {item.transfer_date && (
            <div className="flex items-center gap-2 text-sm" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>
              <Calendar className="h-4 w-4" style={{ color: textMuted }} />
              <span className="font-medium">
                {format(new Date(item.transfer_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
          )}
          {item.pax_count && (
            <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
              <Users className="h-4 w-4" style={{ color: textMuted }} />
              <span>{item.pax_count} pasajero(s)</span>
            </div>
          )}
          {item.vehicle_type && (
            <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
              <Car className="h-4 w-4" style={{ color: textMuted }} />
              <span>{getVehicleInfo(item.vehicle_type)?.label || item.vehicle_type}</span>
            </div>
          )}
          {additionalVehicles.map((av) => (
            <div key={av.id} className="flex items-center gap-2 text-sm" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
              <Car className="h-4 w-4" style={{ color: textMuted }} />
              <span>{getVehicleInfo(av.vehicle_type)?.label || av.vehicle_type}</span>
              {av.driver_name && <span style={{ color: textMuted }}>· {av.driver_name}</span>}
            </div>
          ))}
        </div>

        {/* Pickup */}
        {item.pickup_enabled && item.pickup_location && (
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <MapPin className="h-4 w-4" style={{ color: '#16a34a' }} />
            </div>
            <div>
              <label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
                Recogida
              </label>
              <p className="font-medium mt-0.5" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>{item.pickup_location}</p>
              {item.pickup_time && (
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
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
              style={{ backgroundColor: '#FEE2E2' }}
            >
              <MapPin className="h-4 w-4" style={{ color: '#dc2626' }} />
            </div>
            <div>
              <label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
                Llegada
              </label>
              <p className="font-medium mt-0.5" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>{item.dropoff_location}</p>
              {item.dropoff_time && (
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                  <Clock className="h-3.5 w-3.5" />
                  {item.dropoff_time}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Return Trip */}
        {item.has_return && (
          <div className="pt-4 space-y-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <div className="flex items-center gap-1.5" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
              <RotateCcw className="h-3.5 w-3.5" />
              Viaje de vuelta
            </div>

            {item.return_pickup_enabled && item.return_pickup_location && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                  <MapPin className="h-4 w-4" style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
                    Recogida (vuelta)
                  </label>
                  <p className="font-medium mt-0.5" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>{item.return_pickup_location}</p>
                  {item.return_pickup_time && (
                    <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {item.return_pickup_time}
                    </p>
                  )}
                </div>
              </div>
            )}

            {item.return_dropoff_enabled && item.return_dropoff_location && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                  <MapPin className="h-4 w-4" style={{ color: '#dc2626' }} />
                </div>
                <div>
                  <label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
                    Destino (vuelta)
                  </label>
                  <p className="font-medium mt-0.5" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>{item.return_dropoff_location}</p>
                  {item.return_dropoff_time && (
                    <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {item.return_dropoff_time}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Driver Info */}
        <div className="pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
          {hasDriver ? (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                <User className="h-4 w-4" style={{ color: '#2563EB' }} />
              </div>
              <div>
                <label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
                  Conductor asignado
                </label>
                <p className="font-medium mt-0.5" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>{item.driver_name}</p>
                {item.driver_phone && (
                  <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
                    <Phone className="h-3.5 w-3.5" />
                    {item.driver_phone}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}>
              <Clock className="h-4 w-4" />
              <span>Conductor pendiente de asignar</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <label style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted }}>
              Notas
            </label>
            <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: textPrimary, fontFamily: 'Barlow, sans-serif' }}>{item.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
