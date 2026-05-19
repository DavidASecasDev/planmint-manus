/**
 * Internal Edit Transfer Wizard — Loads existing request data and allows
 * editing via the same 4-step wizard UX as creation.
 *
 * Key differences from InternalNewTransferWizard:
 * - Preloads all fields from existing request + items
 * - Submit updates existing request + items instead of creating new ones
 * - No draft persistence (editing existing data, not a new draft)
 * - Shows request_number in header
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTransferRequest, useTransferRequests } from '@/hooks/useTransferRequests';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TransferItemFormCard,
  type TransferItemFormData,
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
  getZoneLabel,
  type DynamicPricingRow,
} from '@/lib/transferPricing';
import {
  calculatePointToPointPricing,
  calculatePackPricing,
  type PricingBreakdown,
  type SupplementConfig,
} from '@/lib/pricingEngine';
import { calculateNightHours, getNightHoursDescription } from '@/lib/nightHoursCalculator';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { BrokerSelect } from '@/components/transfers/BrokerSelect';
import { ProviderSelect } from '@/components/transfers/ProviderSelect';
import type { ClientType, ServiceType, PackDuration, PricingMode, TransferItem } from '@/types/transfers';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Loader2,
  Users,
  Briefcase,
  MapPin,
  Clock,
  Check,
  Car,
  Plane,
  Ship,
  Building2,
  Route,
  PlaneTakeoff,
  Moon,
  Info,
  FileText,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, label: 'Tipo de cliente' },
  { id: 2, label: 'Servicio y precio' },
  { id: 3, label: 'Detalles' },
  { id: 4, label: 'Resumen' },
];

/** Convert a DB TransferItem to the form data shape */
function itemToFormData(item: TransferItem): TransferItemFormData {
  return {
    id: item.id,
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
    pax_count: item.pax_count?.toString() || '1',
    vehicle_type: item.vehicle_type || '',
    flight_number: item.flight_number || '',
    notes: item.notes || '',
  };
}

export default function InternalEditTransferWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateRequest, isUpdating } = useTransferRequests();
  const { profile } = useAuth();
  const { data: existingRequest, isLoading } = useTransferRequest(id);

  // Wizard state
  const [step, setStep] = useState(1);
  const [initialized, setInitialized] = useState(false);

  // Step 1: Client type
  const [clientType, setClientType] = useState<ClientType | null>(null);
  const [associatedService, setAssociatedService] = useState('');

  // Step 2: Service type + vehicle + pricing mode
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [vehicleType, setVehicleType] = useState('v_class');
  const [packDuration, setPackDuration] = useState<PackDuration>('4h');
  const [selectedZone, setSelectedZone] = useState('');
  const pricingMode: PricingMode = 'zone_tariff';

  // Supplements
  const [airportPickup, setAirportPickup] = useState(false);
  const [nightHours, setNightHours] = useState(0);

  // Step 3: Details
  const [brokerName, setBrokerName] = useState('');
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [isExternalProvider, setIsExternalProvider] = useState(false);
  const [externalProviderName, setExternalProviderName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyItem()]);

  // Initialize from existing request
  useEffect(() => {
    if (existingRequest && !initialized) {
      setClientType(existingRequest.client_type || null);
      setAssociatedService(existingRequest.associated_service || '');
      setServiceType(existingRequest.service_type || null);

      setBrokerName(existingRequest.broker_name || '');
      setBrokerId(existingRequest.broker_id || null);
      setClientName(existingRequest.client_name || '');
      setClientReference(existingRequest.client_reference || '');
      setIsExternalProvider(existingRequest.is_external_provider || false);
      setExternalProviderName(existingRequest.external_provider_name || '');
      setNotes(existingRequest.notes || '');

      // Initialize items from existing data
      const existingItems = (existingRequest.items || []) as TransferItem[];
      if (existingItems.length > 0) {
        setItems(existingItems.map(itemToFormData));
        // Infer vehicle type from first item
        const firstVehicle = existingItems[0].vehicle_type;
        if (firstVehicle) setVehicleType(firstVehicle);
        // Infer zone from first item
        const firstZone = existingItems[0].zone;
        if (firstZone) setSelectedZone(firstZone);
        // Infer pack duration from first item
        const firstPack = existingItems[0].pack_duration;
        if (firstPack) setPackDuration(firstPack);
      }

      setInitialized(true);
    }
  }, [existingRequest, initialized]);

  // Load dynamic pricing from DB
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

  // Estimated price calculation
  const estimatedPrice = useMemo(() => {
    if (!clientType || !serviceType) return null;
    if (serviceType === 'point_to_point' && selectedZone) {
      return getEstimatedPointToPointDynamic(pricingRows, selectedZone, vehicleType, clientType);
    }
    if (serviceType === 'pack') {
      return getEstimatedPackDynamic(pricingRows, selectedZone, vehicleType, packDuration, clientType);
    }
    return null;
  }, [clientType, serviceType, vehicleType, selectedZone, packDuration, pricingRows, pricingMode]);

  // Full pricing breakdown
  const pricingBreakdown = useMemo<PricingBreakdown | null>(() => {
    if (!clientType || !serviceType) return null;
    const supplements: Partial<SupplementConfig> = { airportPickup, nightHours };
    if (serviceType === 'point_to_point' && selectedZone) {
      return calculatePointToPointPricing(selectedZone, vehicleType, supplements);
    }
    if (serviceType === 'pack') {
      return calculatePackPricing(vehicleType, packDuration, supplements);
    }
    return null;
  }, [clientType, serviceType, vehicleType, selectedZone, packDuration, airportPickup, nightHours, pricingMode]);

  // Auto-detect night hours
  const autoNightHours = useMemo(() => {
    const pickupTimes = items
      .map(it => it.pickup_time)
      .filter(t => t && t.includes(':'));
    const returnTimes = items
      .filter(it => it.has_return)
      .map(it => it.return_pickup_time)
      .filter(t => t && t.includes(':'));
    const allTimes = [...pickupTimes, ...returnTimes];
    if (allTimes.length === 0) return 0;
    return Math.max(...allTimes.map(t => calculateNightHours(t, 90)));
  }, [items]);

  const [nightHoursManuallySet, setNightHoursManuallySet] = useState(false);
  useEffect(() => {
    if (!nightHoursManuallySet) {
      setNightHours(autoNightHours);
    }
  }, [autoNightHours, nightHoursManuallySet]);

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

  // Navigation
  const canGoNext = () => {
    switch (step) {
      case 1: return clientType !== null;
      case 2: return serviceType !== null;
      case 3: return brokerName.trim().length > 0 && clientName.trim().length > 0 && items.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => { if (canGoNext() && step < 4) setStep(step + 1); };
  const goBack = () => { if (step > 1) setStep(step - 1); };

  // Quick route templates
  const QUICK_TEMPLATES = [
    { label: 'Aeropuerto → Hotel', icon: 'plane', pickup: 'Aeropuerto de Palma de Mallorca (PMI)', dropoff: '' },
    { label: 'Hotel → Aeropuerto', icon: 'plane', pickup: '', dropoff: 'Aeropuerto de Palma de Mallorca (PMI)' },
    { label: 'Puerto → Villa', icon: 'ship', pickup: 'Puerto de Palma', dropoff: '' },
    { label: 'Villa → Puerto', icon: 'ship', pickup: '', dropoff: 'Puerto de Palma' },
    { label: 'Aeropuerto → Puerto', icon: 'route', pickup: 'Aeropuerto de Palma de Mallorca (PMI)', dropoff: 'Puerto de Palma' },
    { label: 'Hotel → Hotel', icon: 'building', pickup: '', dropoff: '' },
  ];

  const handleAddFromTemplate = (template: typeof QUICK_TEMPLATES[number]) => {
    const newItem = createEmptyItem();
    if (template.pickup) newItem.pickup_location = template.pickup;
    if (template.dropoff) newItem.dropoff_location = template.dropoff;
    setItems(prev => [...prev, newItem]);
  };

  const handleAddItem = () => { setItems(prev => [...prev, createEmptyItem()]); };
  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };
  const handleItemChange = (id: string, field: keyof TransferItemFormData, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Submit — update existing request + items
  const handleSubmit = async () => {
    if (!id || !clientType || !serviceType || !clientName.trim() || !brokerName.trim()) return;

    try {
      // Step 1: Update the request
      updateRequest({
        id,
        broker_name: brokerName.trim(),
        broker_id: brokerId,
        client_name: clientName.trim(),
        client_type: clientType,
        service_type: serviceType,
        is_external_provider: isExternalProvider,
        external_provider_name: isExternalProvider ? externalProviderName.trim() : null,
        pricing_mode: pricingMode,
        notes: notes.trim() || null,
        client_reference: clientReference.trim() || null,
        associated_service: clientType === 'broker_client' ? associatedService : null,
      } as any);

      // Step 2: Sync items — delete removed, update existing, create new
      const existingItems = (existingRequest?.items || []) as TransferItem[];
      const existingIds = new Set(existingItems.map(it => it.id));
      const currentIds = new Set(items.map(it => it.id));

      // Delete items that were removed
      for (const existingItem of existingItems) {
        if (!currentIds.has(existingItem.id)) {
          await supabaseQuery
            .from('transfer_items')
            .delete()
            .eq('id', existingItem.id);
        }
      }

      // Update existing items and create new ones
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const serialized = serializeItems([item])[0];
        const estimPrice = pricingBreakdown
          ? (clientType === 'external_client' ? pricingBreakdown.clientNet : pricingBreakdown.providerNet)
          : (estimatedPrice ?? null);

        const itemData = {
          position: i + 1,
          transfer_date: serialized.transfer_date,
          pickup_enabled: serialized.pickup_enabled,
          pickup_location: serialized.pickup_location,
          pickup_time: serialized.pickup_time,
          dropoff_enabled: serialized.dropoff_enabled,
          dropoff_location: serialized.dropoff_location,
          dropoff_time: serialized.dropoff_time,
          has_return: serialized.has_return,
          return_pickup_enabled: serialized.return_pickup_enabled,
          return_pickup_location: serialized.return_pickup_location,
          return_pickup_time: serialized.return_pickup_time,
          return_dropoff_enabled: serialized.return_dropoff_enabled,
          return_dropoff_location: serialized.return_dropoff_location,
          return_dropoff_time: serialized.return_dropoff_time,
          pax_count: serialized.pax_count,
          vehicle_type: vehicleType,
          pack_duration: serviceType === 'pack' ? packDuration : null,
          flight_number: serialized.flight_number,
          notes: serialized.notes,
          base_price: pricingBreakdown?.basePrice ?? null,
          price_with_commission: estimPrice,
        };

        if (existingIds.has(item.id)) {
          // Update existing item
          await supabaseQuery
            .from('transfer_items')
            .update(itemData)
            .eq('id', item.id);
        } else {
          // Create new item
          await supabaseQuery
            .from('transfer_items')
            .insert({
              ...itemData,
              request_id: id,
              organization_id: profile?.organization_id,
            });
        }
      }

      toast.success('Solicitud actualizada correctamente');
      navigate(`/transfers/${id}`);
    } catch (err) {
      console.error('Error updating transfer:', err);
      toast.error('Error al actualizar la solicitud');
    }
  };

  const vehicleInfo = getVehicleInfo(vehicleType);

  // Loading state
  if (isLoading || !initialized) {
    return (
      <AppLayout title="Editar Transfer">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Editar Transfer">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => step > 1 ? goBack() : navigate(`/transfers/${id}`)}
            className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {step > 1 ? 'Paso anterior' : 'Volver al detalle'}
          </button>

          <h1 className="text-2xl font-bold mb-2 text-foreground">
            Editar Solicitud {existingRequest?.request_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            Wizard de edición — Paso {step} de 4
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                  step === s.id
                    ? 'bg-primary text-primary-foreground'
                    : s.id < step
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-background/20">
                  {s.id < step ? <Check className="h-3 w-3" /> : s.id}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════
            STEP 1 — Tipo de cliente
        ═══════════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              ¿Qué tipo de cliente es?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'broker_client', label: 'Cliente de broker', desc: 'Viene a través de un intermediario', icon: Briefcase },
                { key: 'external_client', label: 'Cliente externo', desc: 'Empresa o agencia externa', icon: Building2 },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setClientType(opt.key as ClientType)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    clientType === opt.key
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <opt.icon className={`h-6 w-6 mb-2 ${clientType === opt.key ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>

            {clientType === 'broker_client' && (
              <div className="space-y-2 mt-4">
                <Label>Servicio asociado</Label>
                <Input
                  value={associatedService}
                  onChange={(e) => setAssociatedService(e.target.value)}
                  placeholder="Ej: Excursión Tramuntana, Boda García..."
                />
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
            STEP 2 — Servicio y precio
        ═══════════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Tipo de servicio y vehículo
            </h2>

            {/* Service type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'point_to_point', label: 'Punto a punto', desc: 'Transfer de A a B', icon: MapPin },
                { key: 'pack', label: 'Pack de horas', desc: 'Disposición por tiempo', icon: Clock },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setServiceType(opt.key as ServiceType)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    serviceType === opt.key
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <opt.icon className={`h-6 w-6 mb-2 ${serviceType === opt.key ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Vehicle type */}
            {serviceType && (
              <div className="space-y-3">
                <Label className="font-medium">Vehículo</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {VEHICLE_TYPES.map(v => (
                    <button
                      key={v.key}
                      onClick={() => setVehicleType(v.key)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        vehicleType === v.key
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Car className={`h-5 w-5 mx-auto mb-1 ${vehicleType === v.key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-xs font-medium">{v.label}</p>
                      <p className="text-[10px] text-muted-foreground">{v.capacity} pax</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Zone selector (point to point) */}
            {serviceType === 'point_to_point' && (
              <div className="space-y-2">
                <Label>Zona de destino</Label>
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar zona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_ZONES.map(z => (
                      <SelectItem key={z.key} value={z.key}>{z.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Pack duration */}
            {serviceType === 'pack' && (
              <div className="space-y-2">
                <Label>Duración del pack</Label>
                <div className="grid grid-cols-4 gap-3">
                  {PACK_DURATIONS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPackDuration(p.key)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        packDuration === p.key
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Clock className={`h-4 w-4 mx-auto mb-1 ${packDuration === p.key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium">{p.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Supplements */}
            {serviceType && (
              <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                <Label className="font-medium flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Suplementos
                </Label>

                {/* Airport pickup */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlaneTakeoff className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Recogida en aeropuerto</span>
                    <span className="text-xs text-muted-foreground">(+20-25€)</span>
                  </div>
                  <Switch checked={airportPickup} onCheckedChange={setAirportPickup} />
                </div>

                {/* Night hours */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm">Suplemento nocturno (1:00-5:00)</span>
                    </div>
                    {autoNightHours > 0 && !nightHoursManuallySet && (
                      <span className="text-xs text-indigo-500 font-medium">
                        Auto-detectado: {autoNightHours}h
                      </span>
                    )}
                  </div>
                  <Select
                    value={nightHours.toString()}
                    onValueChange={(v) => {
                      setNightHours(parseInt(v));
                      setNightHoursManuallySet(true);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map(h => (
                        <SelectItem key={h} value={h.toString()}>{h} hora{h !== 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {nightHours > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {getNightHoursDescription(nightHours)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pricing estimate */}
            {pricingBreakdown && (
              <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10 space-y-2">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Estimación de precio
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Base proveedor:</span>
                  <span className="font-medium">{pricingBreakdown.basePrice.toFixed(2)} €</span>
                  {pricingBreakdown.totalSupplements > 0 && (
                    <>
                      <span className="text-muted-foreground">Suplementos:</span>
                      <span className="font-medium">+{pricingBreakdown.totalSupplements.toFixed(2)} €</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Coste proveedor (IVA 10%):</span>
                  <span className="font-medium">{pricingBreakdown.providerTotal.toFixed(2)} €</span>
                  <span className="text-muted-foreground">Comisión (50%):</span>
                  <span className="font-medium text-green-600">+{pricingBreakdown.commissionAmount.toFixed(2)} €</span>
                  <span className="font-medium border-t pt-1">Precio cliente (sin IVA):</span>
                  <span className="font-bold text-green-700 dark:text-green-300 border-t pt-1">
                    {pricingBreakdown.clientNet.toFixed(2)} €
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
            STEP 3 — Detalles
        ═══════════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalles de la solicitud
            </h2>

            {/* Broker selector (internal only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Broker *</Label>
                <BrokerSelect
                  value={brokerName}
                  onChange={(name, id) => { setBrokerName(name); setBrokerId(id); }}
                  placeholder="Seleccionar broker..."
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Referencia del cliente</Label>
              <Input
                value={clientReference}
                onChange={(e) => setClientReference(e.target.value)}
                placeholder="Ref. interna del broker o cliente"
              />
            </div>

            {/* External provider */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="external"
                  checked={isExternalProvider}
                  onCheckedChange={(checked) => setIsExternalProvider(!!checked)}
                />
                <Label htmlFor="external" className="cursor-pointer">Empresa externa</Label>
              </div>
              {isExternalProvider && (
                <div className="space-y-2">
                  <Label>Proveedor externo</Label>
                  <ProviderSelect
                    value={externalProviderName}
                    onChange={setExternalProviderName}
                    placeholder="Seleccionar proveedor..."
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>

            {/* Transfer items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Route className="h-4 w-4 text-primary" />
                  Trayectos ({items.length})
                </h3>
                <Button variant="outline" size="sm" onClick={handleAddItem} className="gap-1">
                  <Plus className="h-3 w-3" /> Añadir
                </Button>
              </div>

              {/* Quick templates */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => handleAddFromTemplate(t)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs hover:bg-muted/50 transition-colors"
                  >
                    {t.icon === 'plane' && <Plane className="h-3 w-3" />}
                    {t.icon === 'ship' && <Ship className="h-3 w-3" />}
                    {t.icon === 'route' && <Route className="h-3 w-3" />}
                    {t.icon === 'building' && <Building2 className="h-3 w-3" />}
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Capacity warning */}
              {capacityWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                    ⚠️ Capacidad excedida
                  </p>
                  {capacityWarnings.map(w => (
                    <p key={w.index} className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Trayecto {w.index}: {w.pax} pax &gt; {w.capacity} plazas del vehículo
                    </p>
                  ))}
                </div>
              )}

              {items.map((item, idx) => (
                <TransferItemFormCard
                  key={item.id}
                  item={item}
                  index={idx}
                  canRemove={items.length > 1}
                  onChange={(field, value) => handleItemChange(item.id, field, value)}
                  onRemove={() => handleRemoveItem(item.id)}
                  isDark={false}
                  hideVehicleType
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════
            STEP 4 — Resumen
        ═══════════════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              Resumen de cambios
            </h2>

            <div className="space-y-4">
              {/* Request info */}
              <div className="p-4 rounded-lg border bg-card space-y-2">
                <p className="text-sm"><strong>Broker:</strong> {brokerName}</p>
                <p className="text-sm"><strong>Cliente:</strong> {clientName}</p>
                {clientReference && <p className="text-sm"><strong>Referencia:</strong> {clientReference}</p>}
                <p className="text-sm"><strong>Tipo:</strong> {clientType === 'broker_client' ? 'Broker' : 'Externo'}</p>
                <p className="text-sm"><strong>Servicio:</strong> {serviceType === 'point_to_point' ? 'Punto a punto' : 'Pack'} — {vehicleInfo?.label}</p>
                {selectedZone && <p className="text-sm"><strong>Zona:</strong> {getZoneLabel(selectedZone)}</p>}
                {isExternalProvider && <p className="text-sm"><strong>Proveedor:</strong> {externalProviderName}</p>}
                {notes && <p className="text-sm"><strong>Notas:</strong> {notes}</p>}
              </div>

              {/* Items summary */}
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <p className="font-medium text-sm">{items.length} trayecto{items.length !== 1 ? 's' : ''}</p>
                {items.map((item, idx) => (
                  <div key={item.id} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
                    <p className="font-medium text-foreground">Trayecto {idx + 1}</p>
                    {item.transfer_date && <p>Fecha: {item.transfer_date}</p>}
                    {item.pickup_location && <p>Recogida: {item.pickup_location} {item.pickup_time && `(${item.pickup_time})`}</p>}
                    {item.dropoff_location && <p>Destino: {item.dropoff_location}</p>}
                    {item.has_return && item.return_pickup_location && <p>Vuelta: {item.return_pickup_location}</p>}
                  </div>
                ))}
              </div>

              {/* Pricing summary */}
              {pricingBreakdown && (
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10 space-y-2">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Precio estimado</p>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <span className="text-muted-foreground">Coste proveedor:</span>
                    <span>{pricingBreakdown.providerTotal.toFixed(2)} €</span>
                    <span className="text-muted-foreground">Precio cliente (sin IVA):</span>
                    <span className="font-bold text-green-700 dark:text-green-300">{pricingBreakdown.clientNet.toFixed(2)} €</span>
                    <span className="text-muted-foreground">Total con IVA 21%:</span>
                    <span className="font-bold">{pricingBreakdown.clientTotal.toFixed(2)} €</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={goBack} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {step < 4 ? (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isUpdating} className="gap-2">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
