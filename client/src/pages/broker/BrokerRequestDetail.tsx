import { useParams, useNavigate } from 'react-router-dom';
import { useBrokerRequests } from '@/hooks/useBrokerRequests';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Clock, Phone, Ship, Building2, Plane, Car, ExternalLink, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DIRECTION_META, VEHICLE_TYPE_META, CLIENT_TYPE_META } from '@/types/transfers';
import { toast } from 'sonner';

export default function BrokerRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requests, isLoading, cancelRequest } = useBrokerRequests();

  const request = requests.find(r => r.id === id);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!request) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Solicitud no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/broker')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const ClientIcon = request.client_type === 'charter' ? Ship : Building2;
  const canCancel = ['pendiente', 'aceptado', 'conductor_asignado'].includes(request.status);

  const openInMaps = (location: string, placeId?: string | null) => {
    if (placeId) {
      window.open(`https://www.google.com/maps/place/?q=place_id:${placeId}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
    }
  };

  const handleCancel = async () => {
    if (!confirm('¿Estás seguro de que quieres cancelar esta solicitud?')) return;
    try {
      await cancelRequest(request.id);
      toast.success('Solicitud cancelada');
    } catch (e) {
      // handled by hook
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/broker')}>
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
        {canCancel && (
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleCancel}>
            Cancelar solicitud
          </Button>
        )}
      </div>

      {/* Status info */}
      {request.status === 'rechazado' && request.rejection_reason && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-red-800">Solicitud rechazada</p>
            <p className="text-sm text-red-700 mt-1">{request.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Driver info (shown when assigned) */}
      {request.items?.some(i => i.driver_name) && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-800 mb-2">Conductor asignado</p>
            {request.items?.filter(i => i.driver_name).map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-green-600" />
                <span className="font-medium">{item.driver_name}</span>
                {item.driver_phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="w-3 h-3" /> {item.driver_phone}
                  </span>
                )}
              </div>
            ))}
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
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Cliente</span>
            <p className="font-medium">{request.client_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tipo</span>
            <p className="font-medium">{CLIENT_TYPE_META[request.client_type]?.label}</p>
          </div>
          {request.client_phone && (
            <div>
              <span className="text-muted-foreground">Teléfono</span>
              <p className="font-medium">{request.client_phone}</p>
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
          {request.client_type === 'villa' && request.villa_name && (
            <div>
              <span className="text-muted-foreground">Villa</span>
              <p className="font-medium">{request.villa_name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer items */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Servicios ({request.items?.length || 0})</h2>
        {request.items?.map((item) => (
          <Card key={item.id}>
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

              {/* Driver info per item */}
              {item.driver_name && (
                <div className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded">
                  <User className="w-4 h-4 text-green-600" />
                  <span className="font-medium">{item.driver_name}</span>
                  {item.driver_phone && (
                    <span className="text-muted-foreground">· {item.driver_phone}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* General notes */}
      {request.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{request.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
