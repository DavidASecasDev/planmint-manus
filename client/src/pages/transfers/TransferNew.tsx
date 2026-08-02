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
import { ArrowLeft, Plus, Trash2, Ship, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { createEmptyTransferItem, getBabySeatGroup } from '@/types/transfers';
import type { TransferItemFormData, ClientType, VehicleType, BabySeatDetail } from '@/types/transfers';
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
  const [captainName, setCaptainName] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
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
        baby_seats_count: item.baby_seats_count ? parseInt(item.baby_seats_count) : null,
        baby_seats: item.baby_seats.length > 0 ? item.baby_seats.filter(s => s.age || s.weight).map(s => ({ age: parseInt(s.age) || 0, weight: parseInt(s.weight) || 0 })) : null,
        luggage_count: item.luggage_count ? parseInt(item.luggage_count) : null,
        vans_needed: item.vans_needed ? parseInt(item.vans_needed) : 1,
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
          luggage_count: item.luggage_count ? parseInt(item.luggage_count) : null,
          vans_needed: item.vans_needed ? parseInt(item.vans_needed) : 1,
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
        captain_name: captainName,
        captain_phone: captainPhone,
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
    <div className="space-y-6 max-w-3xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/transfers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Nueva solicitud de transfer</h1>
          <p className="text-sm text-muted-foreground">Completa los datos y envía la solicitud a Azul Cars para su confirmación</p>
        </div>
      </div>

      {/* Client type selector - visual buttons like broker portal */}
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

          {/* Broker / Origen field (internal only) */}
          <div className="space-y-2 pt-2 border-t">
            <Label>Broker / Origen</Label>
            <Input value={brokerName} onChange={e => setBrokerName(e.target.value)} placeholder="Nombre del broker" />
            <p className="text-xs text-muted-foreground">Indica quién origina esta solicitud (por defecto: Azul Cars)</p>
          </div>
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
                <Label>{clientType === 'charter' ? 'Hora del Charter *' : 'Hora de Pick up *'}</Label>
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

            {/* Baby seats */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label>Sillas de bebé</Label>
                  <Input
                    type="number"
                    min="0"
                    max="4"
                    value={item.baby_seats_count}
                    onChange={e => {
                      const count = parseInt(e.target.value) || 0;
                      const currentSeats = item.baby_seats || [];
                      let newSeats: BabySeatDetail[] = [];
                      if (count > 0) {
                        newSeats = Array.from({ length: count }, (_, i) => currentSeats[i] || { age: '', weight: '' });
                      }
                      updateItem(idx, { baby_seats_count: e.target.value, baby_seats: newSeats });
                    }}
                    placeholder="0"
                    className="w-20"
                  />
                </div>
              </div>
              {item.baby_seats.length > 0 && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-200">
                  {item.baby_seats.map((seat, seatIdx) => (
                    <div key={seatIdx} className="space-y-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Edad silla {seatIdx + 1}</Label>
                          <Input
                            type="number"
                            min="0"
                            max="12"
                            value={seat.age}
                            onChange={e => {
                              const newSeats = [...item.baby_seats];
                              newSeats[seatIdx] = { ...newSeats[seatIdx], age: e.target.value };
                              updateItem(idx, { baby_seats: newSeats });
                            }}
                            placeholder="Años"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Peso silla {seatIdx + 1} (kg)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="40"
                            value={seat.weight}
                            onChange={e => {
                              const newSeats = [...item.baby_seats];
                              newSeats[seatIdx] = { ...newSeats[seatIdx], weight: e.target.value };
                              updateItem(idx, { baby_seats: newSeats });
                            }}
                            placeholder="kg"
                          />
                        </div>
                      </div>
                      {seat.weight && parseInt(seat.weight) > 0 && (
                        <p className="text-xs font-medium text-pink-600 pl-1">
                          → {getBabySeatGroup(parseInt(seat.weight)).label}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-1">Grupos: 0-9kg (Recién nacido) · 9-18kg (Infantes) · 18-36kg (Niño) · +36kg (Elevador)</p>
                </div>
              )}
            </div>

            {/* Luggage & Vans */}
            <div className="space-y-3 pt-3 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Maletas</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={item.luggage_count}
                    onChange={e => updateItem(idx, { luggage_count: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Número total de maletas</p>
                </div>
                <div className="space-y-1">
                  <Label>Furgonetas necesarias</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={item.vans_needed}
                    onChange={e => updateItem(idx, { vans_needed: e.target.value })}
                  >
                    <option value="1">1 furgoneta</option>
                    <option value="2">2 furgonetas</option>
                    <option value="3">3 furgonetas</option>
                    <option value="4">4 furgonetas</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Según volumen de equipaje y pasajeros</p>
                </div>
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
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Información adicional..." rows={3} />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate('/transfers')}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isCreating}>
          {isCreating ? 'Creando...' : 'Crear solicitud'}
        </Button>
      </div>
    </div>
    </AppLayout>
  );
}
