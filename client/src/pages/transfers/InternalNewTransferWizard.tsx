/**
 * Internal New Transfer Wizard — Unified 4-step wizard
 * Same UX as the broker wizard but with internal-only fields:
 * - Broker selector (step 3)
 * - External provider toggle + selector (step 3)
 * - Pricing mode selector (step 2)
 * - Full internal pricing breakdown (step 4)
 *
 * Uses useTransferRequests (internal) + useTransferItems for creation.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransferRequests } from '@/hooks/useTransferRequests';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
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
import type { ClientType, ServiceType, PackDuration, PricingMode } from '@/types/transfers';
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
  Calculator,
  FileText,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Tipo de cliente' },
  { id: 2, label: 'Servicio y precio' },
  { id: 3, label: 'Detalles' },
  { id: 4, label: 'Resumen' },
];

export default function InternalNewTransferWizard() {
  const navigate = useNavigate();
  const { createRequest, isCreating } = useTransferRequests();
  const { profile } = useAuth();

  // ─── Draft persistence ──────────────────────────────────────────────────────
  const DRAFT_KEY = 'internal_transfer_wizard_draft';

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };

  const savedDraft = loadDraft();
  const [hasDraft, setHasDraft] = useState(!!savedDraft);
  const [draftRestored, setDraftRestored] = useState(false);

  // Wizard state
  const [step, setStep] = useState(savedDraft?.step ?? 1);

  // Step 1: Client type
  const [clientType, setClientType] = useState<ClientType | null>(savedDraft?.clientType ?? null);
  const [associatedService, setAssociatedService] = useState(savedDraft?.associatedService ?? '');

  // Step 2: Service type + vehicle + pricing mode
  const [serviceType, setServiceType] = useState<ServiceType | null>(savedDraft?.serviceType ?? null);
  const [vehicleType, setVehicleType] = useState(savedDraft?.vehicleType ?? 'v_class');
  const [packDuration, setPackDuration] = useState<PackDuration>(savedDraft?.packDuration ?? '4h');
  const [selectedZone, setSelectedZone] = useState(savedDraft?.selectedZone ?? '');
  const [pricingMode, setPricingMode] = useState<PricingMode>(savedDraft?.pricingMode ?? 'zone_tariff');

  // Supplements
  const [airportPickup, setAirportPickup] = useState(savedDraft?.airportPickup ?? false);
  const [nightHours, setNightHours] = useState(savedDraft?.nightHours ?? 0);

  // Step 3: Details (internal-only fields + shared fields)
  const [brokerName, setBrokerName] = useState(savedDraft?.brokerName ?? '');
  const [brokerId, setBrokerId] = useState<string | null>(savedDraft?.brokerId ?? null);
  const [clientName, setClientName] = useState(savedDraft?.clientName ?? '');
  const [clientReference, setClientReference] = useState(savedDraft?.clientReference ?? '');
  const [isExternalProvider, setIsExternalProvider] = useState(savedDraft?.isExternalProvider ?? false);
  const [externalProviderName, setExternalProviderName] = useState(savedDraft?.externalProviderName ?? '');
  const [notes, setNotes] = useState(savedDraft?.notes ?? '');
  const [items, setItems] = useState<TransferItemFormData[]>(savedDraft?.items ?? [createEmptyItem()]);

  // Auto-save draft
  useEffect(() => {
    const draft = {
      step, clientType, associatedService, serviceType, vehicleType,
      packDuration, selectedZone, pricingMode, clientName, clientReference,
      notes, items, airportPickup, nightHours, brokerName, brokerId,
      isExternalProvider, externalProviderName,
      savedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [step, clientType, associatedService, serviceType, vehicleType, packDuration, selectedZone, pricingMode, clientName, clientReference, notes, items, airportPickup, nightHours, brokerName, brokerId, isExternalProvider, externalProviderName]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  };

  useEffect(() => {
    if (savedDraft && !draftRestored) {
      setDraftRestored(true);
    }
  }, []);

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
    if (!clientType || !serviceType || pricingMode === 'provider_quote') return null;
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
    if (!clientType || !serviceType || pricingMode === 'provider_quote') return null;
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
      case 1: return clientType !== null && (clientType !== 'broker_client' || associatedService !== '');
      case 2: return serviceType !== null;
      case 3: return brokerName.trim().length > 0 && clientName.trim().length > 0 && items.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (canGoNext() && step < 4) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

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

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof TransferItemFormData, value: any) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Submit — uses internal createRequest + navigates to detail for item creation
  const handleSubmit = async () => {
    if (!clientType || !serviceType || !clientName.trim() || !brokerName.trim()) return;

    try {
      // Step 1: Create the request
      const newRequest = await createRequest({
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

      if (!newRequest?.id) {
        navigate('/transfers');
        return;
      }

      // Step 2: Create items directly via Supabase
      const serializedItems = serializeItems(items);
      for (let i = 0; i < serializedItems.length; i++) {
        const item = serializedItems[i];
        const estimPrice = pricingBreakdown
          ? (clientType === 'external_client' ? pricingBreakdown.clientNet : pricingBreakdown.providerNet)
          : (estimatedPrice ?? null);

        await supabaseQuery
          .from('transfer_items')
          .insert({
            request_id: newRequest.id,
            organization_id: profile?.organization_id,
            position: i + 1,
            transfer_date: item.transfer_date || null,
            pickup_enabled: item.pickup_enabled ?? true,
            pickup_location: item.pickup_location || null,
            pickup_time: item.pickup_time || null,
            dropoff_enabled: item.dropoff_enabled ?? true,
            dropoff_location: item.dropoff_location || null,
            dropoff_time: item.dropoff_time || null,
            has_return: item.has_return ?? false,
            return_pickup_enabled: item.return_pickup_enabled ?? false,
            return_pickup_location: item.return_pickup_location || null,
            return_pickup_time: item.return_pickup_time || null,
            return_dropoff_enabled: item.return_dropoff_enabled ?? false,
            return_dropoff_location: item.return_dropoff_location || null,
            return_dropoff_time: item.return_dropoff_time || null,
            pax_count: item.pax_count ? parseInt(String(item.pax_count)) : 1,
            vehicle_type: vehicleType,
            pack_duration: serviceType === 'pack' ? packDuration : null,
            flight_number: item.flight_number || null,
            notes: item.notes || null,
            base_price: pricingBreakdown?.basePrice ?? null,
            price_with_commission: estimPrice,
          });
      }

      clearDraft();
      navigate(`/transfers/${newRequest.id}`);
    } catch (err) {
      console.error('Error creating transfer:', err);
    }
  };

  const vehicleInfo = getVehicleInfo(vehicleType);

  return (
    <AppLayout title="Nuevo Transfer">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => step > 1 ? goBack() : navigate('/transfers')}
            className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {step > 1 ? 'Paso anterior' : 'Volver al listado'}
          </button>

          <h1 className="text-2xl font-bold mb-2 text-foreground">
            Nueva Solicitud de Transfer
          </h1>
          <p className="text-sm text-muted-foreground">
            Wizard de creación — Paso {step} de 4
          </p>
        </div>

        {/* Draft restored banner */}
        {draftRestored && hasDraft && (
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Se ha recuperado un borrador guardado automáticamente.
            </span>
            <button
              onClick={() => {
                clearDraft();
                setStep(1); setClientType(null); setAssociatedService('');
                setServiceType(null); setVehicleType('v_class'); setPackDuration('4h');
                setSelectedZone(''); setPricingMode('zone_tariff');
                setClientName(''); setClientReference(''); setNotes('');
                setBrokerName(''); setBrokerId(null);
                setIsExternalProvider(false); setExternalProviderName('');
                setItems([createEmptyItem()]); setDraftRestored(false);
              }}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Descartar borrador
            </button>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                  ${step > s.id
                    ? 'bg-emerald-500 text-white'
                    : step === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span className={`text-xs hidden sm:block ${step >= s.id ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${step > s.id ? 'bg-emerald-500' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 1: Client Type */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                ¿Qué tipo de cliente es?
              </h2>
              <p className="text-sm text-muted-foreground">
                Esto determina la tarifa y el tipo de facturación.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setClientType('external_client')}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  clientType === 'external_client'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Users className={`h-8 w-8 mb-3 ${clientType === 'external_client' ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-foreground">Cliente directo</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente final. Factura con comisión + IVA 21%.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setClientType('broker_client')}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  clientType === 'broker_client'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Briefcase className={`h-8 w-8 mb-3 ${clientType === 'broker_client' ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-foreground">Cliente Isle Of Mallorca</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Servicio asociado a Isle Of Mallorca. Precio B2B.
                </p>
              </button>
            </div>

            {clientType === 'broker_client' && (
              <div className="space-y-2">
                <Label className="text-foreground">Servicio asociado *</Label>
                <Select value={associatedService} onValueChange={setAssociatedService}>
                  <SelectTrigger className="bg-background border-input text-foreground">
                    <SelectValue placeholder="Seleccionar servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charter">Charter</SelectItem>
                    <SelectItem value="concierge">Concierge</SelectItem>
                    <SelectItem value="villa">Villa</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 2: Service Type + Vehicle + Pricing */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Pricing Mode (internal only) */}
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <Label className="font-medium text-primary flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4" />
                Modo de precio
              </Label>
              <RadioGroup
                value={pricingMode}
                onValueChange={(v) => setPricingMode(v as PricingMode)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    pricingMode === 'zone_tariff'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="zone_tariff" className="mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">Tarifa por zona</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Precio calculado automáticamente según zona y tipo de vehículo
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    pricingMode === 'provider_quote'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="provider_quote" className="mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">Presupuesto proveedor</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Precio basado en el presupuesto del proveedor externo
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Service type */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Tipo de servicio
              </h2>
              <p className="text-sm text-muted-foreground">
                ¿Traslado punto a punto o disposición por horas?
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setServiceType('point_to_point')}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  serviceType === 'point_to_point'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <MapPin className={`h-8 w-8 mb-3 ${serviceType === 'point_to_point' ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-foreground">Punto a punto</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Traslado directo de A a B.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setServiceType('pack')}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  serviceType === 'pack'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Clock className={`h-8 w-8 mb-3 ${serviceType === 'pack' ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-foreground">Pack de horas</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Vehículo a disposición por un bloque de horas.
                </p>
              </button>
            </div>

            {/* Vehicle selection */}
            {serviceType && (
              <div className="space-y-3">
                <Label className="text-foreground font-medium">Vehículo</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setVehicleType(v.key)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        vehicleType === v.key
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Car className={`h-5 w-5 ${vehicleType === v.key ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <span className="font-medium text-sm text-foreground">{v.label}</span>
                          <p className="text-xs text-muted-foreground">{v.capacity} pax</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pack duration */}
            {serviceType === 'pack' && (
              <div className="space-y-2">
                <Label className="text-foreground font-medium">Duración del pack</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PACK_DURATIONS.map((pd) => (
                    <button
                      key={pd.key}
                      type="button"
                      onClick={() => setPackDuration(pd.key as PackDuration)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        packDuration === pd.key
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className="font-semibold text-sm text-foreground">{pd.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Zone selection (for point_to_point with zone_tariff pricing) */}
            {serviceType === 'point_to_point' && pricingMode === 'zone_tariff' && (
              <div className="space-y-2">
                <Label className="text-foreground font-medium">Zona de destino</Label>
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger className="bg-background border-input text-foreground">
                    <SelectValue placeholder="Seleccionar zona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_ZONES.map((z) => (
                      <SelectItem key={z.key} value={z.key}>{z.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Supplements (only for zone_tariff) */}
            {pricingMode === 'zone_tariff' && serviceType && (
              <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Suplementos
                </h3>

                {/* Airport pickup */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm text-foreground">Recogida en aeropuerto</span>
                      <p className="text-xs text-muted-foreground">
                        +{vehicleType === 'sprinter' ? '25' : '20'} € por servicio
                      </p>
                    </div>
                  </div>
                  <Switch checked={airportPickup} onCheckedChange={setAirportPickup} />
                </div>

                {/* Night hours */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm text-foreground">Suplemento nocturno</span>
                      <p className="text-xs text-muted-foreground">
                        {getNightHoursDescription(vehicleType)}
                      </p>
                    </div>
                  </div>
                  <Select
                    value={String(nightHours)}
                    onValueChange={(v) => {
                      setNightHoursManuallySet(true);
                      setNightHours(parseInt(v));
                    }}
                  >
                    <SelectTrigger className="w-20 bg-background border-input text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map((h) => (
                        <SelectItem key={h} value={String(h)}>{h}h</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {autoNightHours > 0 && !nightHoursManuallySet && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 ml-7">
                    Detectado automáticamente desde la hora de recogida
                  </p>
                )}
                {nightHoursManuallySet && autoNightHours !== nightHours && (
                  <button
                    type="button"
                    onClick={() => { setNightHoursManuallySet(false); setNightHours(autoNightHours); }}
                    className="text-xs text-primary underline ml-7"
                  >
                    Restaurar detección automática ({autoNightHours}h)
                  </button>
                )}
              </div>
            )}

            {/* Pricing breakdown */}
            {pricingBreakdown && pricingMode === 'zone_tariff' && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tarifa base</span>
                  <span className="text-foreground font-medium">{pricingBreakdown.basePrice} €</span>
                </div>
                {pricingBreakdown.totalSupplements > 0 && (
                  <>
                    {pricingBreakdown.airportPickupFee > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">+ Recogida aeropuerto</span>
                        <span className="text-foreground">{pricingBreakdown.airportPickupFee} €</span>
                      </div>
                    )}
                    {pricingBreakdown.nightFee > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">+ Nocturno ({nightHours}h)</span>
                        <span className="text-foreground">{pricingBreakdown.nightFee} €</span>
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-border" />

                {/* Internal: show FULL breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Coste proveedor (sin IVA)</span>
                    <span className="text-foreground">{pricingBreakdown.providerNet} €</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">IVA proveedor (10%)</span>
                    <span className="text-foreground">{pricingBreakdown.providerVat} €</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Comisión Azul Cars</span>
                    <span className="text-emerald-600 font-medium">{pricingBreakdown.commissionAmount} €</span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {clientType === 'external_client' ? 'Precio cliente (sin IVA)' : 'Precio B2B (sin IVA)'}
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {clientType === 'external_client' ? pricingBreakdown.clientNet : pricingBreakdown.providerNet} €
                    </span>
                  </div>
                  {clientType === 'external_client' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">IVA 21%</span>
                        <span className="text-foreground">{pricingBreakdown.clientVat} €</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Total cliente</span>
                        <span className="text-lg font-bold text-foreground">
                          {pricingBreakdown.clientTotal} €
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Precio por trayecto. Precio final sujeto a confirmación.
                </p>
              </div>
            )}

            {pricingMode === 'provider_quote' && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Modo presupuesto proveedor: los precios se introducirán manualmente después de crear la solicitud.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 3: Details (with internal-only fields) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Internal-only: Broker + Provider */}
            <div className="rounded-lg p-6 bg-card border border-border">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Información Administrativa
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Broker *</Label>
                  <BrokerSelect
                    value={brokerName}
                    onChange={(name, id) => {
                      setBrokerName(name);
                      setBrokerId(id);
                    }}
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

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="external"
                    checked={isExternalProvider}
                    onCheckedChange={(checked) => setIsExternalProvider(!!checked)}
                  />
                  <Label htmlFor="external" className="cursor-pointer">
                    Empresa externa
                  </Label>
                </div>
                {isExternalProvider && (
                  <div className="space-y-2 ml-6">
                    <Label>Proveedor externo</Label>
                    <ProviderSelect
                      value={externalProviderName}
                      onChange={setExternalProviderName}
                      placeholder="Seleccionar proveedor..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Client Info */}
            <div className="rounded-lg p-6 bg-card border border-border">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Información del Cliente
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Referencia del cliente</Label>
                  <Input
                    value={clientReference}
                    onChange={(e) => setClientReference(e.target.value)}
                    placeholder="Ej: Reserva #1234, Yate Azul..."
                    className="mt-1.5"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Notas generales</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instrucciones especiales, preferencias del cliente..."
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Transfer Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Trayectos ({items.length})
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Añadir trayecto
                </Button>
              </div>

              {/* Quick templates */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => handleAddFromTemplate(tpl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-muted/50 hover:bg-muted transition-colors text-foreground"
                  >
                    {tpl.icon === 'plane' && <Plane className="h-3 w-3" />}
                    {tpl.icon === 'ship' && <Ship className="h-3 w-3" />}
                    {tpl.icon === 'route' && <Route className="h-3 w-3" />}
                    {tpl.icon === 'building' && <Building2 className="h-3 w-3" />}
                    {tpl.label}
                  </button>
                ))}
              </div>

              {/* Capacity warning */}
              {capacityWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    {capacityWarnings.map(w =>
                      `Trayecto ${w.index}: ${w.pax} pax excede la capacidad del vehículo (${w.capacity} pax)`
                    ).join('. ')}
                  </p>
                </div>
              )}

              {items.map((item, index) => (
                <TransferItemFormCard
                  key={item.id}
                  item={item}
                  index={index}
                  onChange={(field, value) => handleItemChange(item.id, field, value)}
                  onRemove={() => handleRemoveItem(item.id)}
                  canRemove={items.length > 1}
                  isDark={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP 4: Review & Submit */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Resumen de la solicitud
              </h2>
              <p className="text-sm text-muted-foreground">
                Revisa los datos antes de crear la solicitud.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  clientType === 'external_client'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                }`}>
                  {clientType === 'external_client' ? <Users className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                  {clientType === 'external_client' ? 'Cliente directo' : 'Cliente Isle Of Mallorca'}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  serviceType === 'point_to_point'
                    ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}>
                  {serviceType === 'point_to_point' ? <MapPin className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {serviceType === 'point_to_point' ? 'Punto a punto' : `Pack ${packDuration}`}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  pricingMode === 'zone_tariff'
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                }`}>
                  <Calculator className="h-3 w-3" />
                  {pricingMode === 'zone_tariff' ? 'Tarifa por zona' : 'Ppto. proveedor'}
                </span>
                {airportPickup && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-sky-500/10 text-sky-600 border-sky-500/20">
                    <PlaneTakeoff className="h-3 w-3" />
                    Airport pickup
                  </span>
                )}
                {nightHours > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                    <Moon className="h-3 w-3" />
                    Nocturno {nightHours}h
                  </span>
                )}
              </div>

              {/* Details grid */}
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broker</span>
                  <span className="text-foreground font-medium">{brokerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="text-foreground font-medium">{clientName}</span>
                </div>
                {isExternalProvider && externalProviderName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proveedor externo</span>
                    <span className="text-foreground font-medium">{externalProviderName}</span>
                  </div>
                )}
                {associatedService && clientType === 'broker_client' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicio asociado</span>
                    <span className="text-foreground font-medium capitalize">{associatedService}</span>
                  </div>
                )}
                {clientReference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referencia</span>
                    <span className="text-foreground font-medium">{clientReference}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehículo</span>
                  <span className="text-foreground font-medium">{vehicleInfo?.label || vehicleType}</span>
                </div>
                {serviceType === 'point_to_point' && selectedZone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zona</span>
                    <span className="text-foreground font-medium">{getZoneLabel(selectedZone)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trayectos</span>
                  <span className="text-foreground font-medium">{items.length}</span>
                </div>
              </div>

              {/* Pricing breakdown (internal full view) */}
              {pricingBreakdown && pricingMode === 'zone_tariff' && (
                <div className="pt-3 mt-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tarifa base</span>
                    <span className="text-foreground">{pricingBreakdown.basePrice} €</span>
                  </div>
                  {pricingBreakdown.airportPickupFee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">+ Recogida aeropuerto</span>
                      <span className="text-foreground">{pricingBreakdown.airportPickupFee} €</span>
                    </div>
                  )}
                  {pricingBreakdown.nightFee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">+ Nocturno ({nightHours}h)</span>
                      <span className="text-foreground">{pricingBreakdown.nightFee} €</span>
                    </div>
                  )}
                  <div className="border-t border-border my-1" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Coste proveedor</span>
                    <span className="text-foreground">{pricingBreakdown.providerNet} €</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600">Comisión</span>
                    <span className="text-emerald-600 font-medium">{pricingBreakdown.commissionAmount} €</span>
                  </div>
                  <div className="border-t border-border my-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {clientType === 'external_client' ? 'Precio por trayecto (sin IVA)' : 'Precio B2B por trayecto'}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {clientType === 'external_client' ? pricingBreakdown.clientNet : pricingBreakdown.providerNet} €
                    </span>
                  </div>
                  {items.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Total estimado ({items.length} trayectos, sin IVA)
                      </span>
                      <span className="text-lg font-bold text-foreground">
                        {((clientType === 'external_client' ? pricingBreakdown.clientNet : pricingBreakdown.providerNet) * items.length).toFixed(2)} €
                      </span>
                    </div>
                  )}
                  {clientType === 'external_client' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total con IVA 21%</span>
                      <span className="text-foreground font-semibold">
                        {(pricingBreakdown.clientTotal * items.length).toFixed(2)} €
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Precio final sujeto a confirmación.
                  </p>
                </div>
              )}

              {/* Notes */}
              {notes && (
                <div className="pt-3 mt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">Notas</span>
                  <p className="text-sm text-foreground mt-1">{notes}</p>
                </div>
              )}
            </div>

            {/* Transfer items summary */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Detalle de trayectos
              </h3>
              {items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      Trayecto {index + 1}
                    </span>
                    {item.transfer_date && (
                      <span className="text-xs text-muted-foreground">
                        — {new Date(item.transfer_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {item.pickup_enabled && item.pickup_location && (
                      <div>Recogida: {item.pickup_location} {item.pickup_time && `a las ${item.pickup_time}`}</div>
                    )}
                    {item.dropoff_enabled && item.dropoff_location && (
                      <div>Destino: {item.dropoff_location} {item.dropoff_time && `a las ${item.dropoff_time}`}</div>
                    )}
                    {item.has_return && (
                      <div className="text-xs italic">+ Viaje de vuelta incluido</div>
                    )}
                    {item.pax_count && (
                      <div>{item.pax_count} pasajero{parseInt(item.pax_count) !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Navigation buttons */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="flex justify-between mt-8 pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => step > 1 ? goBack() : navigate('/transfers')}
            disabled={isCreating}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step > 1 ? 'Anterior' : 'Cancelar'}
          </Button>

          {step < 4 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canGoNext()}
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isCreating || !clientName.trim() || !brokerName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Crear Solicitud
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
