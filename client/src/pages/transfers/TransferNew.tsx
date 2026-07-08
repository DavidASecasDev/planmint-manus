import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransferRequests, type CreateInternalRequestData } from '@/hooks/useTransferRequests';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createEmptyTransferItem } from '@/types/transfers';
import type { TransferItemFormData, ClientType, VehicleType } from '@/types/transfers';
import { LocationAutocomplete } from '@/components/broker/LocationAutocomplete';

export default function TransferNew() {
  const navigate = useNavigate();
  const { createRequest, isCreating } = useTransferRequests({});

  // Request-level fields
  const [brokerName, setBrokerName] = useState('Azul Cars');
  const [clientType, setClientType] = useState<ClientType>('villa');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [villaName, setVillaName] = useState('');
  const [boatName, setBoatName] = useState('');
  const [berthNumber, setBerthNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Items
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyTransferItem()]);

  const updateItem = (idx: number, updates: Partial<TransferItemFormData>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, createEmptyTransferItem()]);
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }

    // Build items array (including return trips)
    const finalItems: CreateInternalRequestData['items'] = [];
    for (const item of items) {
      finalItems.push({
        direction: item.direction,
        transfer_date: item.transfer_date || null,
        transfer_time: item.transfer_time || null,
        pickup_location: item.pickup_location || null,
        pickup_lat: item.pickup_lat,
        pickup_lng: item.pickup_lng,
        pickup_place_id: item.pickup_place_id,
        dropoff_location: item.dropoff_location || null,
        dropoff_lat: item.dropoff_lat,
        dropoff_lng: item.dropoff_lng,
        dropoff_place_id: item.dropoff_place_id,
        vehicle_type: item.vehicle_type as VehicleType,
        pax_count: item.pax_count ? parseInt(item.pax_count) : null,
        flight_number: item.flight_number || null,
        notes: item.notes || null,
      });

      // If has_return, add the return trip
      if (item.has_return) {
        finalItems.push({
          direction: 'vuelta',
          transfer_date: item.return_date || null,
          transfer_time: item.return_time || null,
          pickup_location: item.return_pickup_location || item.dropoff_location || null,
          pickup_lat: item.return_pickup_lat || item.dropoff_lat,
          pickup_lng: item.return_pickup_lng || item.dropoff_lng,
          pickup_place_id: item.return_pickup_place_id || item.dropoff_place_id,
          dropoff_location: item.return_dropoff_location || item.pickup_location || null,
          dropoff_lat: item.return_dropoff_lat || item.pickup_lat,
          dropoff_lng: item.return_dropoff_lng || item.pickup_lng,
          dropoff_place_id: item.return_dropoff_place_id || item.pickup_place_id,
          vehicle_type: item.vehicle_type as VehicleType,
          pax_count: item.pax_count ? parseInt(item.pax_count) : null,
          flight_number: null,
          notes: null,
        });
      }
    }

    try {
      await createRequest({
        broker_name: brokerName,
        client_type: clientType,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        villa_name: villaName,
        boat_name: boatName,
        berth_number: berthNumber,
        notes,
        items: finalItems,
      });
      navigate('/transfers');
    } catch (e) {
      // Error handled by hook
    }
  };

  return (
    <AppLayout title="Nueva Solicitud">
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/transfers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Nueva solicitud de transfer</h1>
      </div>

      {/* Client info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Broker / Origen</Label>
              <Input value={brokerName} onChange={e => setBrokerName(e.target.value)} placeholder="Nombre del broker" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select value={clientType} onValueChange={v => setClientType(v as ClientType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villa">Villa</SelectItem>
                  <SelectItem value="charter">Charter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del cliente *</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+34 600 000 000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email (opcional)</Label>
            <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@ejemplo.com" type="email" />
          </div>

          {clientType === 'villa' && (
            <div className="space-y-2">
              <Label>Nombre de la villa</Label>
              <Input value={villaName} onChange={e => setVillaName(e.target.value)} placeholder="Ej: Villa Serenity" />
            </div>
          )}

          {clientType === 'charter' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del barco</Label>
                <Input value={boatName} onChange={e => setBoatName(e.target.value)} placeholder="Ej: Lady Blue" />
              </div>
              <div className="space-y-2">
                <Label>Número de amarre</Label>
                <Input value={berthNumber} onChange={e => setBerthNumber(e.target.value)} placeholder="Ej: A-42" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer items */}
      {items.map((item, idx) => (
        <Card key={item.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Servicio {idx + 1}</CardTitle>
              {items.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={item.transfer_date} onChange={e => updateItem(idx, { transfer_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={item.transfer_time} onChange={e => updateItem(idx, { transfer_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vehículo</Label>
                <Select value={item.vehicle_type} onValueChange={v => updateItem(idx, { vehicle_type: v as VehicleType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mercedes_vito">Mercedes Vito</SelectItem>
                    <SelectItem value="mercedes_v_class">Mercedes V-Class</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Punto de recogida</Label>
                <LocationAutocomplete
                  value={item.pickup_location}
                  onChange={(val) => updateItem(idx, { pickup_location: val })}
                  onSelect={(data) => updateItem(idx, { pickup_location: data.description, pickup_place_id: data.placeId })}
                  placeholder="Dirección de recogida"
                />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <LocationAutocomplete
                  value={item.dropoff_location}
                  onChange={(val) => updateItem(idx, { dropoff_location: val })}
                  onSelect={(data) => updateItem(idx, { dropoff_location: data.description, dropoff_place_id: data.placeId })}
                  placeholder="Dirección de destino"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Pasajeros</Label>
                <Input type="number" min="1" max="8" value={item.pax_count} onChange={e => updateItem(idx, { pax_count: e.target.value })} placeholder="Nº" />
              </div>
              <div className="space-y-2">
                <Label>Nº vuelo (opcional)</Label>
                <Input value={item.flight_number} onChange={e => updateItem(idx, { flight_number: e.target.value })} placeholder="IB3456" />
              </div>
              <div className="space-y-2">
                <Label>Notas servicio</Label>
                <Input value={item.notes} onChange={e => updateItem(idx, { notes: e.target.value })} placeholder="Notas..." />
              </div>
            </div>

            {/* Return trip toggle */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <Switch checked={item.has_return} onCheckedChange={v => updateItem(idx, { has_return: v })} />
              <Label className="cursor-pointer">Crear servicio de vuelta</Label>
            </div>

            {item.has_return && (
              <div className="space-y-4 pl-4 border-l-2 border-purple-200">
                <p className="text-sm font-medium text-purple-700">Vuelta</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha vuelta</Label>
                    <Input type="date" value={item.return_date} onChange={e => updateItem(idx, { return_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora vuelta</Label>
                    <Input type="time" value={item.return_time} onChange={e => updateItem(idx, { return_time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recogida vuelta</Label>
                    <LocationAutocomplete
                      value={item.return_pickup_location || item.dropoff_location}
                      onChange={(val) => updateItem(idx, { return_pickup_location: val })}
                      onSelect={(data) => updateItem(idx, { return_pickup_location: data.description, return_pickup_place_id: data.placeId })}
                      placeholder="Por defecto: destino de la ida"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destino vuelta</Label>
                    <LocationAutocomplete
                      value={item.return_dropoff_location || item.pickup_location}
                      onChange={(val) => updateItem(idx, { return_dropoff_location: val })}
                      onSelect={(data) => updateItem(idx, { return_dropoff_location: data.description, return_dropoff_place_id: data.placeId })}
                      placeholder="Por defecto: recogida de la ida"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={addItem}>
        <Plus className="w-4 h-4 mr-2" /> Añadir otro servicio
      </Button>

      {/* General notes */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Label>Notas generales (opcional)</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Información adicional..." rows={3} />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/transfers')}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isCreating}>
          {isCreating ? 'Creando...' : 'Crear solicitud'}
        </Button>
      </div>
    </div>
    </AppLayout>
  );
}
