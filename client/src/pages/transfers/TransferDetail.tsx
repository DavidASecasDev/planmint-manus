import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTransferRequests } from '@/hooks/useTransferRequests';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check, X, UserPlus, MapPin, Clock, Phone, Ship, Building2, Plane, Car, ExternalLink, FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TransferRouteMap } from '@/components/transfers/TransferRouteMap';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CLIENT_TYPE_META, VEHICLE_TYPE_META, DIRECTION_META } from '@/types/transfers';
import type { TransferRequest, TransferItem, TransferRequestStatus } from '@/types/transfers';

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requests, isLoading, acceptRequest, rejectRequest, assignDriver, updateStatus } = useTransferRequests({});
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);

  const { session } = useAuth();
  const request = requests.find(r => r.id === id);

  const handleDownloadPdf = async () => {
    if (!request) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || session?.access_token;
      if (!token) {
        toast.error('Sesion no disponible. Recarga la pagina.');
        return;
      }
      const response = await fetch(`/api/transfer-pdf/${request.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Error ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transfer-${request.request_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch (err: any) {
      console.error('PDF download error:', err);
      toast.error(err.message || 'Error al generar PDF');
    }
  };

  if (isLoading) {
    return <AppLayout title="Transfer"><div className="p-8 text-center text-muted-foreground">Cargando...</div></AppLayout>;
  }

  if (!request) {
    return (
      <AppLayout title="Transfer">
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Solicitud no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/transfers')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
      </div>
      </AppLayout>
    );
  }

  const ClientIcon = request.client_type === 'charter' ? Ship : Building2;
  const clientMeta = CLIENT_TYPE_META[request.client_type as keyof typeof CLIENT_TYPE_META];

  const handleAccept = () => {
    acceptRequest(request.id);
  };

  const handleReject = () => {
    rejectRequest({ requestId: request.id, reason: rejectionReason });
    setShowRejectForm(false);
  };

  const handleAssignDriver = () => {
    if (!driverName.trim()) return;
    // Assign driver to all items in the request
    const items = request.items || [];
    items.forEach(item => {
      assignDriver({ itemId: item.id, driverName: driverName.trim(), driverPhone: driverPhone.trim() });
    });
    setShowDriverForm(false);
    setDriverName('');
    setDriverPhone('');
  };

  const handleMarkInProgress = () => {
    updateStatus({ id: request.id, status: 'en_curso' });
  };

  const handleMarkCompleted = () => {
    updateStatus({ id: request.id, status: 'completado' });
  };

  const openInMaps = (location: string, placeId?: string | null) => {
    if (placeId) {
      window.open(`https://www.google.com/maps/place/?q=place_id:${placeId}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
    }
  };

  return (
    <AppLayout title={`Transfer ${request?.request_number || ''}`}>
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/transfers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{request.request_number}</h1>
            <TransferStatusBadge status={request.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Creado {format(new Date(request.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} title="Descargar PDF">
            <FileDown className="w-4 h-4 mr-1" /> PDF
          </Button>
          {request.status === 'pendiente' && (
            <>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowRejectForm(true)}>
                <X className="w-4 h-4 mr-1" /> Rechazar
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleAccept}>
                <Check className="w-4 h-4 mr-1" /> Aceptar
              </Button>
            </>
          )}
          {request.status === 'aceptado' && (
            <Button onClick={() => setShowDriverForm(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Asignar conductor
            </Button>
          )}
          {request.status === 'conductor_asignado' && (
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleMarkInProgress}>
              Marcar en curso
            </Button>
          )}
          {request.status === 'en_curso' && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleMarkCompleted}>
              <Check className="w-4 h-4 mr-1" /> Completar
            </Button>
          )}
        </div>
      </div>

      {/* Rejection form */}
      {showRejectForm && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-red-800">Motivo del rechazo</p>
            <Textarea
              placeholder="Indica el motivo del rechazo (opcional)..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowRejectForm(false)}>Cancelar</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleReject}>Confirmar rechazo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver assignment form */}
      {showDriverForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-blue-800">Asignar conductor</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Nombre del conductor"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
              />
              <Input
                placeholder="Teléfono del conductor"
                value={driverPhone}
                onChange={e => setDriverPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDriverForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAssignDriver} disabled={!driverName.trim()}>Asignar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClientIcon className="w-4 h-4" />
            Información del cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Cliente</span>
            <p className="font-medium">{request.client_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tipo</span>
            <p className="font-medium">{clientMeta?.label || request.client_type}</p>
          </div>
          {request.client_phone && (
            <div>
              <span className="text-muted-foreground">Teléfono</span>
              <p className="font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> {request.client_phone}
              </p>
            </div>
          )}
          {request.client_type === 'charter' && request.boat_name && (
            <div>
              <span className="text-muted-foreground">Barco</span>
              <p className="font-medium">{request.boat_name}</p>
            </div>
          )}
          {request.client_type === 'charter' && request.berth_number && (
            <div>
              <span className="text-muted-foreground">Amarre</span>
              <p className="font-medium">{request.berth_number}</p>
            </div>
          )}
          {request.client_type === 'charter' && request.captain_name && (
            <div>
              <span className="text-muted-foreground">Capitán</span>
              <p className="font-medium">{request.captain_name}</p>
            </div>
          )}
          {request.client_type === 'charter' && request.captain_phone && (
            <div>
              <span className="text-muted-foreground">Tel. Capitán</span>
              <p className="font-medium">
                <a href={`tel:${request.captain_phone}`} className="text-blue-600 hover:underline">{request.captain_phone}</a>
              </p>
            </div>
          )}
          {request.client_type === 'villa' && request.villa_name && (
            <div>
              <span className="text-muted-foreground">Villa</span>
              <p className="font-medium">{request.villa_name}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Broker</span>
            <p className="font-medium">{request.broker_name}</p>
          </div>
          {request.items?.find(i => i.driver_name) && (
            <div>
              <span className="text-muted-foreground">Conductor</span>
              <p className="font-medium">{request.items!.find(i => i.driver_name)!.driver_name}</p>
              {request.items!.find(i => i.driver_name)!.driver_phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {request.items!.find(i => i.driver_name)!.driver_phone}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer items */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Servicios ({request.items?.length || 0})</h2>
        {request.items?.map((item, idx) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={DIRECTION_META[item.direction || 'ida']?.color || ''}>
                    {DIRECTION_META[item.direction || 'ida']?.label || 'Ida'}
                  </Badge>
                  {item.vehicle_type && (
                    <Badge variant="secondary">
                      <Car className="w-3 h-3 mr-1" />
                      {VEHICLE_TYPE_META[item.vehicle_type as keyof typeof VEHICLE_TYPE_META]?.label}
                    </Badge>
                  )}
                  {item.linked_item_id && (
                    <Badge variant="outline" className="text-xs">Vinculado</Badge>
                  )}
                </div>
                <TransferStatusBadge status={item.status || request.status} variant="item" />
              </div>

              {/* Date & time */}
              <div className="flex items-center gap-4 text-sm">
                {item.transfer_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {format(new Date(item.transfer_date), 'EEEE dd MMM yyyy', { locale: es })}
                    {item.transfer_time && ` · ${item.transfer_time.slice(0, 5)}`}
                  </span>
                )}
                {item.flight_number && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Plane className="w-3 h-3" /> {item.flight_number}
                  </span>
                )}
              </div>

              {/* Locations */}
              <div className="space-y-2">
                {item.pickup_location && (
                  <div className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="text-muted-foreground text-xs">Recogida</span>
                      <p className="font-medium">{item.pickup_location}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => openInMaps(item.pickup_location!, item.pickup_place_id)}
                      title="Abrir en Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                {item.dropoff_location && (
                  <div className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="text-muted-foreground text-xs">Destino</span>
                      <p className="font-medium">{item.dropoff_location}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => openInMaps(item.dropoff_location!, item.dropoff_place_id)}
                      title="Abrir en Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Passengers */}
              {item.pax_count && item.pax_count > 0 && (
                <p className="text-xs text-muted-foreground">{item.pax_count} pasajero{item.pax_count > 1 ? 's' : ''}</p>
              )}

              {/* Route map */}
              {item.pickup_location && item.dropoff_location && (
                <TransferRouteMap
                  pickupLocation={item.pickup_location}
                  dropoffLocation={item.dropoff_location}
                  pickupPlaceId={item.pickup_place_id}
                  dropoffPlaceId={item.dropoff_place_id}
                />
              )}

              {/* Notes */}
              {item.notes && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">{item.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* General notes */}
      {request.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas generales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{request.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rejection reason */}
      {request.status === 'rechazado' && request.rejection_reason && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-red-800">Motivo del rechazo:</p>
            <p className="text-sm text-red-700">{request.rejection_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  );
}
