/*
 * Azul Cars Brand — Request Detail
 * Uses semantic CSS tokens for dark/light mode compatibility
 * bg-card | text-foreground | text-muted-foreground | border-border
 */
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
import { TransferNotesSection } from '@/components/transfers/TransferNotesSection';
import { StatusTimeline } from '@/components/transfers/StatusTimeline';
import { ChangeHistoryTimeline } from '@/components/broker/ChangeHistoryTimeline';
import { RouteEstimateBadge } from '@/components/broker/RouteEstimateBadge';
import { useBrokerQuotePdf, type BrokerPdfLanguage } from '@/hooks/useBrokerQuotePdf';
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
  Download,
  FileText,
} from 'lucide-react';
import type { TransferRequestStatus, TransferItem } from '@/types/transfers';

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
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';
  const { data: request, isLoading, error } = useBrokerRequestDetail(id);
  const { updateRequestStatus, isUpdatingStatus } = useBrokerRequests();
  const [statusAction, setStatusAction] = useState<'confirmado' | 'en_gestion' | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<'accept' | 'reject' | null>(null);
  const { logStatusChange } = useTransferStatusHistory(id);
  const { generateBrokerPdf, isGenerating: isGeneratingPdf } = useBrokerQuotePdf();
  const [pdfLanguage, setPdfLanguage] = useState<BrokerPdfLanguage>('es');

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2
            className="text-xl mb-2 text-foreground"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
          >
            Solicitud no encontrada
          </h2>
          <p className="mb-4 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
            No se pudo cargar la información de esta solicitud
          </p>
          <button
            onClick={() => navigate('/broker')}
            className="text-sm hover:underline text-primary"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
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
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1
                className="text-2xl text-foreground"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
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
              style={{ background: 'linear-gradient(90deg, oklch(0.72 0.10 80), transparent)' }}
            />
          </div>

          {isOwnRequest && request.status === 'pendiente' && (
            <Button
              onClick={() => navigate(`/broker/request/${id}/edit`)}
              className="gap-2 bg-foreground text-background hover:brightness-110"
              style={{
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
              backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : '#DBEAFE',
              border: isDark ? '1px solid rgba(37,99,235,0.25)' : '1px solid #BFDBFE',
              color: isDark ? '#93C5FD' : '#1E40AF',
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
                backgroundColor: isDark ? 'rgba(234,179,8,0.08)' : '#FFFBEB',
                border: `2px solid oklch(0.72 0.10 80 / 0.4)`,
              }}
            >
              <h3
                className="text-base mb-3 flex items-center gap-2 text-foreground"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
              >
                <Info className="h-5 w-5 text-primary" />
                Presupuesto pendiente de confirmación
              </h3>
              <p className="text-sm mb-4 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                Revisa el importe y confirma o solicita cambios.
              </p>

              <div className="rounded-lg p-4 mb-4 bg-card border border-border">
                <div className="space-y-1 text-sm" style={{ fontFamily: 'Barlow, sans-serif' }}>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal (sin IVA):</span>
                    <span>{fmt(subtotal)} €</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA 21%:</span>
                    <span>{fmt(iva)} €</span>
                  </div>
                  <div
                    className="flex justify-between text-base pt-2 text-foreground border-t border-border"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
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

      {/* PDF Download Section — visible when quote sent, confirmed, or completed */}
      {['presupuesto_enviado', 'confirmado', 'completado'].includes(request.status) && request.items && request.items.length > 0 && (
        <div className="rounded-lg p-5 mb-6 bg-card border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{ backgroundColor: request.status === 'confirmado' || request.status === 'completado' ? '#DCFCE7' : '#FEF3C7' }}
              >
                <FileText
                  className="h-5 w-5"
                  style={{ color: request.status === 'confirmado' || request.status === 'completado' ? '#166534' : '#92400E' }}
                />
              </div>
              <div>
                <p
                  className="text-foreground"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {request.status === 'confirmado' || request.status === 'completado'
                    ? 'Confirmación de Servicio'
                    : 'Presupuesto'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Descarga el documento para enviar a tu cliente
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={pdfLanguage}
                onChange={(e) => setPdfLanguage(e.target.value as BrokerPdfLanguage)}
                className="text-sm rounded-md border border-border bg-background text-foreground px-3 py-1.5"
                style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '12px' }}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
              <Button
                onClick={() => generateBrokerPdf(request, request.items || [], pdfLanguage)}
                disabled={isGeneratingPdf}
                className="gap-2"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Descargar PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Client Info Card */}
      <div className="rounded-lg p-6 mb-6 bg-card border border-border">
        <h2
          className="mb-4 flex items-center gap-2 text-muted-foreground"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}
        >
          <Users className="h-4 w-4" />
          Información del Cliente
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              className="text-muted-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              Cliente
            </label>
            <p
              className="mt-1 text-foreground"
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, fontSize: '15px' }}
            >
              {request.client_name}
            </p>
          </div>

          <div>
            <label
              className="text-muted-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              Broker
            </label>
            <p
              className="mt-1 flex items-center gap-2 text-foreground"
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, fontSize: '15px' }}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {request.broker_name}
              {isOwnRequest && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground"
                  style={{
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
              className="text-muted-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              Fecha de creación
            </label>
            <p
              className="mt-1 text-foreground"
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500, fontSize: '15px' }}
            >
              {format(new Date(request.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>

          {request.notes && (
            <div className="sm:col-span-2">
              <label
                className="text-muted-foreground"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                }}
              >
                Notas
              </label>
              <p
                className="mt-1 whitespace-pre-wrap text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif' }}
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
          className="mb-4 text-muted-foreground"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
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
              isDark={isDark}
            />
          ))}
        </div>
      </div>

      {/* Status History Timeline */}
      <StatusTimeline requestId={request.id} isDark={isDark} />

      {/* Change History Timeline */}
      <ChangeHistoryTimeline requestId={request.id} />

      {/* Internal Notes */}
      {broker && request && (
        <div>
          <TransferNotesSection
            requestId={request.id}
            organizationId={broker.organization_id}
            currentBrokerId={broker.id}
            currentAuthorName={broker.name}
            isDark={isDark}
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
  isDark: boolean;
}

function TransferItemDetail({ item, index, requestStatus, isDark }: TransferItemDetailProps) {
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
      className="rounded-lg overflow-hidden bg-card border border-border"
      style={{ borderLeft: '3px solid oklch(0.72 0.10 80)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-muted/50">
        <span
          className="text-foreground"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '14px' }}
        >
          Trayecto {index + 1}
        </span>
        <div className="flex items-center gap-2">
          {['presupuesto_enviado', 'confirmado', 'completado'].includes(requestStatus) &&
            item.price_with_commission != null &&
            item.price_with_commission > 0 && (
              <span
                className="px-2.5 py-0.5 rounded text-sm bg-muted text-foreground"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
              >
                {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.price_with_commission)} €{' '}
                <span className="font-normal text-xs text-muted-foreground">(sin IVA)</span>
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
            <div className="flex items-center gap-2 text-sm text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(item.transfer_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
          )}
          {item.pax_count && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
              <Users className="h-4 w-4" />
              <span>{item.pax_count} pasajero(s)</span>
            </div>
          )}
          {item.vehicle_type && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
              <Car className="h-4 w-4" />
              <span>{getVehicleInfo(item.vehicle_type)?.label || item.vehicle_type}</span>
            </div>
          )}
          {additionalVehicles.map((av) => (
            <div key={av.id} className="flex items-center gap-2 text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
              <Car className="h-4 w-4" />
              <span>{getVehicleInfo(av.vehicle_type)?.label || av.vehicle_type}</span>
              {av.driver_name && <span className="text-muted-foreground/70">· {av.driver_name}</span>}
            </div>
          ))}
        </div>

        {/* Pickup */}
        {item.pickup_enabled && item.pickup_location && (
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isDark ? 'rgba(22,163,106,0.15)' : '#DCFCE7' }}
            >
              <MapPin className="h-4 w-4" style={{ color: '#16a34a' }} />
            </div>
            <div>
              <label className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Recogida
              </label>
              <p className="font-medium mt-0.5 text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>{item.pickup_location}</p>
              {item.pickup_time && (
                <p className="text-sm flex items-center gap-1 mt-0.5 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
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
              style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2' }}
            >
              <MapPin className="h-4 w-4" style={{ color: '#dc2626' }} />
            </div>
            <div>
              <label className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Llegada
              </label>
              <p className="font-medium mt-0.5 text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>{item.dropoff_location}</p>
              {item.dropoff_time && (
                <p className="text-sm flex items-center gap-1 mt-0.5 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                  <Clock className="h-3.5 w-3.5" />
                  {item.dropoff_time}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Route Estimate (ida) */}
        {item.pickup_enabled && item.pickup_location && item.dropoff_enabled && item.dropoff_location && (
          <div className="pl-11">
            <RouteEstimateBadge
              origin={item.pickup_location}
              destination={item.dropoff_location}
            />
          </div>
        )}

        {/* Return Trip */}
        {item.has_return && (
          <div className="pt-4 space-y-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              <RotateCcw className="h-3.5 w-3.5" />
              Viaje de vuelta
            </div>

            {item.return_pickup_enabled && item.return_pickup_location && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isDark ? 'rgba(22,163,106,0.15)' : '#DCFCE7' }}>
                  <MapPin className="h-4 w-4" style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <label className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    Recogida (vuelta)
                  </label>
                  <p className="font-medium mt-0.5 text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>{item.return_pickup_location}</p>
                  {item.return_pickup_time && (
                    <p className="text-sm flex items-center gap-1 mt-0.5 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {item.return_pickup_time}
                    </p>
                  )}
                </div>
              </div>
            )}

            {item.return_dropoff_enabled && item.return_dropoff_location && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2' }}>
                  <MapPin className="h-4 w-4" style={{ color: '#dc2626' }} />
                </div>
                <div>
                  <label className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    Destino (vuelta)
                  </label>
                  <p className="font-medium mt-0.5 text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>{item.return_dropoff_location}</p>
                  {item.return_dropoff_time && (
                    <p className="text-sm flex items-center gap-1 mt-0.5 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {item.return_dropoff_time}
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* Route Estimate (vuelta) */}
            {item.return_pickup_enabled && item.return_pickup_location && item.return_dropoff_enabled && item.return_dropoff_location && (
              <div className="pl-11">
                <RouteEstimateBadge
                  origin={item.return_pickup_location}
                  destination={item.return_dropoff_location}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* Driver Info */}
        <div className="pt-4 border-t border-border">
          {hasDriver ? (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#DBEAFE' }}>
                <User className="h-4 w-4" style={{ color: '#2563EB' }} />
              </div>
              <div>
                <label className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  Conductor asignado
                </label>
                <p className="font-medium mt-0.5 text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>{item.driver_name}</p>
                {item.driver_phone && (
                  <p className="text-sm flex items-center gap-1 mt-0.5 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                    <Phone className="h-3.5 w-3.5" />
                    {item.driver_phone}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
              <Clock className="h-4 w-4" />
              <span>Conductor pendiente de asignar</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="pt-4 border-t border-border">
            <label className="text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Notas
            </label>
            <p className="text-sm mt-1 whitespace-pre-wrap text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>{item.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
