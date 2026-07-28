import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBrokerRequests, type BrokerRequestItemData } from '@/hooks/useBrokerRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Ship, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { getBabySeatGroup } from '@/types/transfers';
import type { ClientType, VehicleType, BabySeatDetail } from '@/types/transfers';
import { LocationAutocomplete } from '@/components/broker/LocationAutocomplete';

export default function BrokerEditRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requests, isLoading, updateRequest, isUpdating } = useBrokerRequests();

  const request = requests.find(r => r.id === id);

  // Form state
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
  const [items, setItems] = useState<BrokerRequestItemData[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (request && !initialized) {
      setClientType(request.client_type || 'villa');
      setClientName(request.client_name || '');
      setClientPhone(request.client_phone || '');
      setClientEmail(request.client_email || '');
      setVillaName(request.villa_name || '');
      setBoatName(request.boat_name || '');
      setBerthNumber(request.berth_number || '');
      setCaptainName(request.captain_name || '');
      setCaptainPhone(request.captain_phone || '');
      setNotes(request.notes || '');
      if (request.items && request.items.length > 0) {
        setItems(request.items.map(item => ({
          direction: item.direction || 'ida',
          transfer_date: item.transfer_date || null,
          transfer_time: item.transfer_time || null,
          pickup_location: item.pickup_location || null,
          pickup_lat: item.pickup_lat || null,
          pickup_lng: item.pickup_lng || null,
          pickup_place_id: item.pickup_place_id || null,
          dropoff_location: item.dropoff_location || null,
          dropoff_lat: item.dropoff_lat || null,
          dropoff_lng: item.dropoff_lng || null,
          dropoff_place_id: item.dropoff_place_id || null,
          vehicle_type: (item.vehicle_type as VehicleType) || 'mercedes_vito',
          pax_count: item.pax_count || null,
          flight_number: item.flight_number || null,
          notes: item.notes || null,
          baby_seats_count: item.baby_seats_count || null,
          baby_seats: item.baby_seats ? (typeof item.baby_seats === 'string' ? JSON.parse(item.baby_seats) : item.baby_seats) : null,
        })));
      }
      setInitialized(true);
    }
  }, [request, initialized]);

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

  if (request.status !== 'pendiente') {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Solo se pueden editar solicitudes pendientes</p>
        <Button variant="outline" onClick={() => navigate(`/broker/request/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al detalle
        </Button>
      </div>
    );
  }

  const updateItem = (idx: number, updates: Partial<BrokerRequestItemData>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      direction: 'ida',
      transfer_date: null,
      transfer_time: null,
      pickup_location: null,
      pickup_lat: null,
      pickup_lng: null,
      pickup_place_id: null,
      dropoff_location: null,
      dropoff_lat: null,
      dropoff_lng: null,
      dropoff_place_id: null,
      vehicle_type: 'mercedes_vito',
      pax_count: null,
      flight_number: null,
      notes: null,
    }]);
  };

  const validateCaptainPhone = (phone: string): boolean => {
    if (!phone) return true; // Optional field
    const intlPhoneRegex = /^\+[1-9]\d{6,14}$/;
    return intlPhoneRegex.test(phone.replace(/\s/g, ''));
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    if (!clientPhone.trim()) {
      toast.error('El teléfono de contacto es obligatorio');
      return;
    }
    if (items.length === 0) {
      toast.error('Debe haber al menos un servicio');
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
    if (clientType === 'charter' && captainPhone && !validateCaptainPhone(captainPhone)) {
      toast.error('El teléfono del capitán debe tener formato internacional (ej: +34 600 000 000)');
      return;
    }

    try {
      await updateRequest({
        id: request.id,
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
        items,
      });
      toast.success('Solicitud actualizada correctamente');
      navigate(`/broker/request/${id}`);
    } catch (e) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/broker/request/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Editar solicitud {request.request_number}</h1>
      </div>

      {/* Client type */}
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
                  <Input
                    value={captainPhone}
                    onChange={e => setCaptainPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                  />
                  <p className="text-xs text-muted-foreground">Formato internacional: +34 600 000 000</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transfer items */}
      {items.map((item, idx) => (
        <Card key={idx}>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Select value={item.direction} onValueChange={v => updateItem(idx, { direction: v as 'ida' | 'vuelta' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ida">Ida</SelectItem>
                    <SelectItem value="vuelta">Vuelta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input type="date" value={item.transfer_date || ''} onChange={e => updateItem(idx, { transfer_date: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>{clientType === 'charter' ? 'Hora del Charter *' : 'Hora de Pick up *'}</Label>
                <Input type="time" value={item.transfer_time || ''} onChange={e => updateItem(idx, { transfer_time: e.target.value || null })} />
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
                <Label>Recogida *</Label>
                <LocationAutocomplete
                  value={item.pickup_location || ''}
                  onChange={(val) => updateItem(idx, { pickup_location: val })}
                  onSelect={(data) => updateItem(idx, { pickup_location: data.description, pickup_place_id: data.placeId })}
                  placeholder="Dirección de recogida"
                />
              </div>
              <div className="space-y-2">
                <Label>Destino *</Label>
                <LocationAutocomplete
                  value={item.dropoff_location || ''}
                  onChange={(val) => updateItem(idx, { dropoff_location: val })}
                  onSelect={(data) => updateItem(idx, { dropoff_location: data.description, dropoff_place_id: data.placeId })}
                  placeholder="Dirección de destino"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Pasajeros</Label>
                <Input type="number" min="1" max="50" value={item.pax_count || ''} onChange={e => updateItem(idx, { pax_count: e.target.value ? parseInt(e.target.value) : null })} placeholder="Nº" />
              </div>
              <div className="space-y-2">
                <Label>Vuelo</Label>
                <Input value={item.flight_number || ''} onChange={e => updateItem(idx, { flight_number: e.target.value || null })} placeholder="IB3456" />
              </div>
              <div className="space-y-2 col-span-2 md:col-span-1">
                <Label>Notas del servicio</Label>
                <Input value={item.notes || ''} onChange={e => updateItem(idx, { notes: e.target.value || null })} placeholder="Notas..." />
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
                    value={item.baby_seats_count || ''}
                    onChange={e => {
                      const count = parseInt(e.target.value) || 0;
                      const currentSeats: BabySeatDetail[] = (item.baby_seats as any) || [];
                      let newSeats: any[] = [];
                      if (count > 0) {
                        newSeats = Array.from({ length: count }, (_, i) => currentSeats[i] || { age: 0, weight: 0 });
                      }
                      updateItem(idx, { baby_seats_count: count || null, baby_seats: newSeats.length > 0 ? newSeats : null });
                    }}
                    placeholder="0"
                    className="w-20"
                  />
                </div>
              </div>
              {item.baby_seats && (item.baby_seats as any[]).length > 0 && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-200">
                  {(item.baby_seats as any[]).map((seat: any, seatIdx: number) => (
                    <div key={seatIdx} className="space-y-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Edad silla {seatIdx + 1}</Label>
                          <Input
                            type="number"
                            min="0"
                            max="12"
                            value={seat.age || ''}
                            onChange={e => {
                              const newSeats = [...(item.baby_seats as any[])];
                              newSeats[seatIdx] = { ...newSeats[seatIdx], age: parseInt(e.target.value) || 0 };
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
                            value={seat.weight || ''}
                            onChange={e => {
                              const newSeats = [...(item.baby_seats as any[])];
                              newSeats[seatIdx] = { ...newSeats[seatIdx], weight: parseInt(e.target.value) || 0 };
                              updateItem(idx, { baby_seats: newSeats });
                            }}
                            placeholder="kg"
                          />
                        </div>
                      </div>
                      {seat.weight && (typeof seat.weight === 'number' ? seat.weight : parseInt(seat.weight)) > 0 && (
                        <p className="text-xs font-medium text-pink-600 pl-1">
                          \u2192 {getBabySeatGroup(typeof seat.weight === 'number' ? seat.weight : parseInt(seat.weight)).label}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-1">Grupos: 0-9kg (Recién nacido) · 9-18kg (Infantes) · 18-36kg (Niño) · +36kg (Elevador)</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={addItem}>
        <Plus className="w-4 h-4 mr-2" /> Añadir servicio
      </Button>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas generales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones adicionales..." rows={3} />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-4">
        <Button variant="outline" className="flex-1" onClick={() => navigate(`/broker/request/${id}`)}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={isUpdating}>
          {isUpdating ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
