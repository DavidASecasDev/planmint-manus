import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrokerRequests } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Trash2, Ship, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { createEmptyTransferItem } from '@/types/transfers';
import type { TransferItemFormData, ClientType, VehicleType } from '@/types/transfers';
import { LocationAutocomplete } from '@/components/broker/LocationAutocomplete';

export default function BrokerNewRequest() {
  const navigate = useNavigate();
  const { createRequest, isCreating } = useBrokerRequests();
  const { broker } = useBrokerAuth();

  const [clientType, setClientType] = useState<ClientType>('villa');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [villaName, setVillaName] = useState('');
  const [boatName, setBoatName] = useState('');
  const [berthNumber, setBerthNumber] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
  const [notes, setNotes] = useState('');
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
    if (items.some(item => !item.transfer_date || !item.transfer_time)) {
      toast.error('Cada servicio debe tener fecha y hora');
      return;
    }
    if (items.some(item => !item.pickup_location || !item.dropoff_location)) {
      toast.error('Cada servicio debe tener recogida y destino');
      return;
    }
    if (clientType === 'charter' && captainPhone) {
      const intlPhoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!intlPhoneRegex.test(captainPhone.replace(/\s/g, ''))) {
        toast.error('El teléfono del capitán debe tener formato internacional (ej: +34 600 000 000)');
        return;
      }
    }

    // Convert form items to the expected format
    const finalItems: Array<import('@/hooks/useBrokerRequests').BrokerRequestItemData> = [];
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
        vehicle_type: item.vehicle_type,
        pax_count: item.pax_count ? parseInt(item.pax_count) : null,
        flight_number: item.flight_number || null,
        notes: item.notes || null,
      });
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
          vehicle_type: item.vehicle_type,
          pax_count: item.pax_count ? parseInt(item.pax_count) : null,
          flight_number: null,
          notes: null,
        });
      }
    }

    try {
      await createRequest({
        client_type: clientType,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        villa_name: villaName,
        boat_name: boatName,
        berth_number: berthNumber,
        captain_name: captainName,
        captain_phone: captainPhone,
        notes,
        items: finalItems,
      });
      toast.success('Solicitud enviada correctamente');
      navigate('/broker');
    } catch (e) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/broker')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Nueva solicitud de transfer</h1>
          <p className="text-sm text-muted-foreground">Completa los datos y envía la solicitud a Azul Cars para su confirmación</p>
        </div>
      </div>

      {/* Client type selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                clientType === 'villa'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
              onClick={() => setClientType('villa')}
            >
              <Building2 className="w-8 h-8 mx-auto mb-2" />
              <span className="font-medium">Villa</span>
            </button>
            <button
              type="button"
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                clientType === 'charter'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
              onClick={() => setClientType('charter')}
            >
              <Ship className="w-8 h-8 mx-auto mb-2" />
              <span className="font-medium">Charter</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Client info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del cliente *</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono de contacto *</Label>
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
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del barco</Label>
                  <Input value={boatName} onChange={e => setBoatName(e.target.value)} placeholder="Ej: Lady Blue" />
                </div>
                <div className="space-y-2">
                  <Label>Número de amarre</Label>
                  <Input value={berthNumber} onChange={e => setBerthNumber(e.target.value)} placeholder="Ej: A-42" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del capitán</Label>
                  <Input value={captainName} onChange={e => setCaptainName(e.target.value)} placeholder="Ej: John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono del capitán</Label>
                  <Input value={captainPhone} onChange={e => setCaptainPhone(e.target.value)} placeholder="+34 600 000 000" />
                  <p className="text-xs text-muted-foreground">Formato internacional: +34 600 000 000</p>
                </div>
              </div>
            </>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input type="date" value={item.transfer_date} onChange={e => updateItem(idx, { transfer_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora *</Label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Punto de recogida *</Label>
                <LocationAutocomplete
                  value={item.pickup_location}
                  onChange={(val) => updateItem(idx, { pickup_location: val })}
                  onSelect={(data) => updateItem(idx, { pickup_location: data.description, pickup_place_id: data.placeId })}
                  placeholder="Dirección de recogida"
                />
              </div>
              <div className="space-y-2">
                <Label>Destino *</Label>
                <LocationAutocomplete
                  value={item.dropoff_location}
                  onChange={(val) => updateItem(idx, { dropoff_location: val })}
                  onSelect={(data) => updateItem(idx, { dropoff_location: data.description, dropoff_place_id: data.placeId })}
                  placeholder="Dirección de destino"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nº pasajeros</Label>
                <Input type="number" min="1" max="8" value={item.pax_count} onChange={e => updateItem(idx, { pax_count: e.target.value })} placeholder="Nº" />
              </div>
              <div className="space-y-2">
                <Label>Nº vuelo (opcional)</Label>
                <Input value={item.flight_number} onChange={e => updateItem(idx, { flight_number: e.target.value })} placeholder="IB3456" />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={item.notes} onChange={e => updateItem(idx, { notes: e.target.value })} placeholder="Notas del servicio..." />
              </div>
            </div>

            {/* Return trip toggle */}
            <div className="flex items-center gap-3 pt-3 border-t">
              <Switch checked={item.has_return} onCheckedChange={v => updateItem(idx, { has_return: v })} />
              <Label className="cursor-pointer">Crear servicio de vuelta vinculado</Label>
            </div>

            {item.has_return && (
              <div className="space-y-4 pl-4 border-l-2 border-purple-200 bg-purple-50/30 p-4 rounded-r-lg">
                <p className="text-sm font-medium text-purple-700">Vuelta (servicio vinculado)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha vuelta</Label>
                    <Input type="date" value={item.return_date} onChange={e => updateItem(idx, { return_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora vuelta</Label>
                    <Input type="time" value={item.return_time} onChange={e => updateItem(idx, { return_time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Información adicional para Azul Cars..." rows={3} />
        </CardContent>
      </Card>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Nota:</strong> Tu solicitud será revisada por Azul Cars. Una vez aceptada, se te asignará un conductor con su nombre y número de contacto.
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate('/broker')}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isCreating}>
          {isCreating ? 'Enviando...' : 'Enviar solicitud'}
        </Button>
      </div>
    </div>
  );
}
