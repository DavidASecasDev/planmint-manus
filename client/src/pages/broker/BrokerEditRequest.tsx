/*
 * Azul Cars Brand — Edit Request (Enhanced)
 * Now allows editing: client type, service type, vehicle, associated service, zone
 * Uses semantic CSS tokens for dark/light mode compatibility
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBrokerRequests, useBrokerRequestDetail, UpdateBrokerRequestData } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TransferItemFormCard,
  TransferItemFormData,
  createEmptyItem,
  serializeItems,
} from '@/components/broker/TransferItemFormCard';
import {
  VEHICLE_TYPES,
  TRANSFER_ZONES,
  PACK_DURATIONS,
  getEstimatedPointToPointDynamic,
  getEstimatedPackDynamic,
  getVehicleInfo,
  type DynamicPricingRow,
} from '@/lib/transferPricing';
import { supabaseQuery } from '@/lib/supabaseQuery';
import type { ClientType, ServiceType, PackDuration } from '@/types/transfers';
import { ArrowLeft, Plus, Loader2, AlertCircle, Users } from 'lucide-react';

const ASSOCIATED_SERVICES = [
  { value: 'villa', label: 'Villa' },
  { value: 'charter', label: 'Charter' },
  { value: 'yate', label: 'Yate' },
  { value: 'otro', label: 'Otro' },
];

export default function BrokerEditRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { broker } = useBrokerAuth();
  const { data: request, isLoading: isLoadingDetail } = useBrokerRequestDetail(id);
  const { updateRequest, isUpdating } = useBrokerRequests();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';

  // Editable fields
  const [clientName, setClientName] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [notes, setNotes] = useState('');
  const [clientType, setClientType] = useState<ClientType>('external_client');
  const [associatedService, setAssociatedService] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('point_to_point');
  const [vehicleType, setVehicleType] = useState('v_class');
  const [packDuration, setPackDuration] = useState<PackDuration>('4h');
  const [selectedZone, setSelectedZone] = useState('');
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyItem()]);
  const [initialized, setInitialized] = useState(false);

  // Dynamic pricing
  const [pricingRows, setPricingRows] = useState<DynamicPricingRow[]>([]);
  useEffect(() => {
    supabaseQuery
      .from('transfer_pricing')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setPricingRows(data as DynamicPricingRow[]);
      });
  }, []);

  // Pre-fill form when data loads
  useEffect(() => {
    if (request && !initialized) {
      setClientName(request.client_name || '');
      setClientReference(request.client_reference || '');
      setNotes(request.notes || '');
      setClientType((request.client_type as ClientType) || 'external_client');
      setAssociatedService(request.associated_service || '');
      setServiceType((request.service_type as ServiceType) || 'point_to_point');

      if (request.items && request.items.length > 0) {
        const firstItem = request.items[0];
        setVehicleType(firstItem.vehicle_type || 'v_class');
        if (firstItem.pack_duration) setPackDuration(firstItem.pack_duration as PackDuration);

        setItems(request.items.map(item => ({
          id: crypto.randomUUID(),
          transfer_date: item.transfer_date || '',
          pickup_enabled: item.pickup_enabled ?? true,
          pickup_location: item.pickup_location || '',
          pickup_time: item.pickup_time || '',
          dropoff_enabled: item.dropoff_enabled ?? true,
          dropoff_location: item.dropoff_location || '',
          dropoff_time: item.dropoff_time || '',
          has_return: item.has_return ?? false,
          return_pickup_enabled: item.return_pickup_enabled ?? false,
          return_pickup_location: item.return_pickup_location || '',
          return_pickup_time: item.return_pickup_time || '',
          return_dropoff_enabled: item.return_dropoff_enabled ?? false,
          return_dropoff_location: item.return_dropoff_location || '',
          return_dropoff_time: item.return_dropoff_time || '',
          pax_count: item.pax_count?.toString() || '',
          vehicle_type: item.vehicle_type || 'v_class',
          flight_number: item.flight_number || '',
          notes: item.notes || '',
        })));
      }
      setInitialized(true);
    }
  }, [request, initialized]);

  // Estimated price
  const estimatedPrice = useMemo(() => {
    if (!clientType || !serviceType) return null;
    if (serviceType === 'point_to_point' && selectedZone) {
      return getEstimatedPointToPointDynamic(pricingRows, selectedZone, vehicleType, clientType);
    }
    if (serviceType === 'pack') {
      return getEstimatedPackDynamic(pricingRows, selectedZone, vehicleType, packDuration, clientType);
    }
    return null;
  }, [clientType, serviceType, vehicleType, selectedZone, packDuration, pricingRows]);

  // Capacity validation
  const vehicleCapacity = useMemo(() => {
    const v = VEHICLE_TYPES.find(vt => vt.key === vehicleType);
    return v?.capacity ?? 99;
  }, [vehicleType]);

  const capacityWarnings = useMemo(() => {
    return items
      .map((item, idx) => {
        const pax = parseInt(item.pax_count);
        if (!isNaN(pax) && pax > vehicleCapacity) {
          return { index: idx + 1, pax, capacity: vehicleCapacity };
        }
        return null;
      })
      .filter(Boolean) as { index: number; pax: number; capacity: number }[];
  }, [items, vehicleCapacity]);

  if (isLoadingDetail) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Guard: not pending or not own request
  if (request && (request.status !== 'pendiente' || broker?.id !== request.broker_id)) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2
            className="text-xl mb-2 text-foreground"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
          >
            No se puede editar esta solicitud
          </h2>
          <p className="mb-4 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
            Solo se pueden editar solicitudes en estado pendiente que sean tuyas.
          </p>
          <button
            onClick={() => navigate(`/broker/request/${id}`)}
            className="text-sm hover:underline text-foreground"
            style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
          >
            Volver al detalle
          </button>
        </div>
      </div>
    );
  }

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId: string, field: keyof TransferItemFormData, value: any) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !id) return;

    // Build previous data snapshot for change tracking
    const previousItems = request?.items?.map(item => ({
      transfer_date: item.transfer_date || null,
      pickup_enabled: item.pickup_enabled ?? true,
      pickup_location: item.pickup_location || null,
      pickup_time: item.pickup_time || null,
      dropoff_enabled: item.dropoff_enabled ?? true,
      dropoff_location: item.dropoff_location || null,
      dropoff_time: item.dropoff_time || null,
      has_return: item.has_return ?? false,
      pax_count: item.pax_count ?? null,
      vehicle_type: item.vehicle_type || null,
      flight_number: item.flight_number || null,
      notes: item.notes || null,
      pack_duration: item.pack_duration || null,
      estimated_price: item.estimated_price ?? null,
    })) || [];

    const data: UpdateBrokerRequestData = {
      id,
      client_name: clientName.trim(),
      client_type: clientType,
      service_type: serviceType,
      client_reference: clientReference.trim() || undefined,
      associated_service: clientType === 'broker_client' ? associatedService : undefined,
      notes: notes.trim() || undefined,
      items: serializeItems(items).map(item => ({
        ...item,
        vehicle_type: vehicleType,
        pack_duration: serviceType === 'pack' ? packDuration : undefined,
        estimated_price: estimatedPrice ?? undefined,
      })),
      _previousData: {
        client_name: request?.client_name || '',
        client_type: request?.client_type || '',
        service_type: request?.service_type || '',
        client_reference: request?.client_reference || '',
        associated_service: request?.associated_service || '',
        notes: request?.notes || '',
        items: previousItems,
      },
    };

    try {
      await updateRequest(data);
      navigate(`/broker/request/${id}`);
    } catch (error) {
      // Error handled by hook
    }
  };

  const vehicleInfo = getVehicleInfo(vehicleType);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(`/broker/request/${id}`)}
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al detalle
        </button>

        <h1
          className="text-2xl mb-2 text-foreground"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
        >
          Editar Solicitud {request?.request_number}
        </h1>
        <div
          className="w-16 h-1 rounded"
          style={{ background: 'linear-gradient(90deg, oklch(0.72 0.10 80), transparent)' }}
        />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Client Type & Service Configuration */}
        <div className="rounded-lg p-6 mb-6 bg-card border border-border">
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
            Configuración del Servicio
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Client Type */}
            <div>
              <Label className="text-foreground" style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}>
                Tipo de cliente *
              </Label>
              <Select value={clientType} onValueChange={(v) => {
                setClientType(v as ClientType);
                if (v === 'broker_client' && serviceType === 'pack') {
                  setServiceType('point_to_point');
                }
              }}>
                <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="external_client">Cliente directo</SelectItem>
                  <SelectItem value="broker_client">Cliente Isle Of Mallorca</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Associated Service (only for broker_client) */}
            {clientType === 'broker_client' && (
              <div>
                <Label className="text-foreground" style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}>
                  Servicio asociado *
                </Label>
                <Select value={associatedService} onValueChange={setAssociatedService}>
                  <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSOCIATED_SERVICES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Service Type */}
            <div>
              <Label className="text-foreground" style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}>
                Tipo de servicio *
              </Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
                <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="point_to_point">Punto a punto</SelectItem>
                  <SelectItem value="pack" disabled={clientType === 'broker_client'}>
                    Pack por horas {clientType === 'broker_client' ? '(no disponible)' : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Type */}
            <div>
              <Label className="text-foreground" style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}>
                Vehículo *
              </Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map(v => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.label} ({v.capacity} pax)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pack Duration (only for pack) */}
            {serviceType === 'pack' && (
              <div>
                <Label className="text-foreground" style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}>
                  Duración del pack *
                </Label>
                <Select value={packDuration} onValueChange={(v) => setPackDuration(v as PackDuration)}>
                  <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACK_DURATIONS.map(d => (
                      <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Zone (for pricing) */}
            <div>
              <Label className="text-foreground" style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}>
                Zona (para precio estimado)
              </Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                  <SelectValue placeholder="Seleccionar zona" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_ZONES.map(z => (
                    <SelectItem key={z.key} value={z.key}>{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estimated price */}
          {estimatedPrice && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Precio estimado: {estimatedPrice}€
              </span>
            </div>
          )}
        </div>

        {/* Client Info */}
        <div className="rounded-lg p-6 mb-6 bg-card border border-border">
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
            Información del Cliente
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label
                htmlFor="client_name"
                className="text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
              >
                Nombre del cliente *
              </Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: Sr. García y familia"
                required
                className="mt-1.5 bg-background border-input text-foreground"
              />
            </div>

            <div>
              <Label
                htmlFor="client_reference"
                className="text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
              >
                Referencia del cliente
              </Label>
              <Input
                id="client_reference"
                value={clientReference}
                onChange={(e) => setClientReference(e.target.value)}
                placeholder="Ej: Reserva #12345"
                className="mt-1.5 bg-background border-input text-foreground"
              />
            </div>

            <div className="sm:col-span-2">
              <Label
                htmlFor="notes"
                className="text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
              >
                Notas generales
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales, preferencias del cliente..."
                className="mt-1.5 bg-background border-input text-foreground"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Transfer Items */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2
              className="text-muted-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              Trayectos ({items.length})
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1 border-foreground text-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <Plus className="h-4 w-4" />
              Añadir trayecto
            </Button>
          </div>

          {/* Capacity warning */}
          {capacityWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
              <Users className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-400">
                <span className="font-semibold">Atención:</span>{' '}
                {capacityWarnings.map(w => (
                  <span key={w.index}>
                    Trayecto {w.index} tiene {w.pax} pasajeros pero el vehículo seleccionado solo admite {w.capacity}.{' '}
                  </span>
                ))}
                <span className="block mt-1 text-xs opacity-80">
                  Considera cambiar a un vehículo de mayor capacidad.
                </span>
              </div>
            </div>
          )}

          {items.map((item, index) => (
            <TransferItemFormCard
              key={item.id}
              item={item}
              index={index}
              canRemove={items.length > 1}
              onChange={(field, value) => handleItemChange(item.id, field, value)}
              onRemove={() => handleRemoveItem(item.id)}
              isDark={isDark}
              hideVehicleType
            />
          ))}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/broker/request/${id}`)}
            disabled={isUpdating}
            className="border-border text-muted-foreground"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !clientName.trim()}
            className="hover:brightness-110 bg-foreground text-background"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
