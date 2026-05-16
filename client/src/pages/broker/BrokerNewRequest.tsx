/*
 * Azul Cars Brand — New Request Wizard (4 steps)
 * Step 1: Client type (external_client / broker_client)
 * Step 2: Service type (point_to_point / pack) + vehicle selection
 * Step 3: Transfer details (items)
 * Step 4: Review & submit
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrokerRequests, type CreateBrokerRequestData } from '@/hooks/useBrokerRequests';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  getEstimatedPointToPoint,
  getEstimatedPack,
  getVehicleInfo,
  getZoneLabel,
} from '@/lib/transferPricing';
import type { ClientType, ServiceType, PackDuration } from '@/types/transfers';
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
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Tipo de cliente' },
  { id: 2, label: 'Tipo de servicio' },
  { id: 3, label: 'Detalles' },
  { id: 4, label: 'Resumen' },
];

export default function BrokerNewRequest() {
  const navigate = useNavigate();
  const { createRequest, isCreating } = useBrokerRequests();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1: Client type
  const [clientType, setClientType] = useState<ClientType | null>(null);

  // Step 2: Service type + vehicle
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [vehicleType, setVehicleType] = useState('v_class');
  const [packDuration, setPackDuration] = useState<PackDuration>('4h');
  // For point_to_point, zone is used for estimated pricing
  const [selectedZone, setSelectedZone] = useState('');

  // Step 3: Details
  const [clientName, setClientName] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemFormData[]>([createEmptyItem()]);

  // Estimated price calculation
  const estimatedPrice = useMemo(() => {
    if (!clientType || !serviceType) return null;
    if (serviceType === 'point_to_point' && selectedZone) {
      return getEstimatedPointToPoint(selectedZone, vehicleType, clientType);
    }
    if (serviceType === 'pack') {
      return getEstimatedPack(vehicleType, packDuration, clientType);
    }
    return null;
  }, [clientType, serviceType, vehicleType, selectedZone, packDuration]);

  // Navigation helpers
  const canGoNext = () => {
    switch (step) {
      case 1: return clientType !== null;
      case 2: return serviceType !== null;
      case 3: return clientName.trim().length > 0 && items.length > 0;
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

  // Item management
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

  // Submit
  const handleSubmit = async () => {
    if (!clientType || !serviceType || !clientName.trim()) return;

    const data: CreateBrokerRequestData = {
      client_name: clientName.trim(),
      client_type: clientType,
      service_type: serviceType,
      client_reference: clientReference.trim() || undefined,
      notes: notes.trim() || undefined,
      items: serializeItems(items).map(item => ({
        ...item,
        vehicle_type: vehicleType,
        pack_duration: serviceType === 'pack' ? packDuration : undefined,
        estimated_price: estimatedPrice ?? undefined,
      })),
    };

    try {
      await createRequest(data);
      navigate('/broker');
    } catch {
      // Error handled by hook
    }
  };

  const vehicleInfo = getVehicleInfo(vehicleType);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => step > 1 ? goBack() : navigate('/broker')}
          className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          style={{ fontFamily: 'Barlow, sans-serif', fontWeight: 500 }}
        >
          <ArrowLeft className="h-4 w-4" />
          {step > 1 ? 'Paso anterior' : 'Volver al listado'}
        </button>

        <h1
          className="text-2xl mb-2 text-foreground"
          style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
        >
          Nueva Solicitud de Transfer
        </h1>
        <div
          className="w-16 h-1 rounded"
          style={{ background: 'linear-gradient(90deg, oklch(0.72 0.10 80), transparent)' }}
        />
      </div>

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
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                }
              `}
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <span
              className={`hidden sm:block text-xs ${step >= s.id ? 'text-foreground' : 'text-muted-foreground'}`}
              style={{ fontFamily: 'Barlow, sans-serif', fontWeight: step === s.id ? 600 : 400 }}
            >
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
        <div className="space-y-4">
          <p
            className="text-muted-foreground mb-6"
            style={{ fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}
          >
            ¿Para quién es este transfer?
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* External Client */}
            <button
              type="button"
              onClick={() => setClientType('external_client')}
              className={`
                p-6 rounded-lg border-2 text-left transition-all
                ${clientType === 'external_client'
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border bg-card hover:border-foreground/30'
                }
              `}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${clientType === 'external_client' ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                  <Users className={`h-5 w-5 ${clientType === 'external_client' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <span
                  className="text-foreground"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '15px' }}
                >
                  Cliente directo
                </span>
              </div>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                Un cliente final que contacta directamente. Se aplica la tarifa con comisión.
              </p>
            </button>

            {/* Broker Client */}
            <button
              type="button"
              onClick={() => setClientType('broker_client')}
              className={`
                p-6 rounded-lg border-2 text-left transition-all
                ${clientType === 'broker_client'
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-border bg-card hover:border-foreground/30'
                }
              `}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${clientType === 'broker_client' ? 'bg-blue-500/10' : 'bg-muted'}`}>
                  <Briefcase className={`h-5 w-5 ${clientType === 'broker_client' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <span
                  className="text-foreground"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '15px' }}
                >
                  Cliente de broker
                </span>
              </div>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                Un cliente que viene a través de un broker/agencia. Se aplica la tarifa B2B.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* STEP 2: Service Type + Vehicle */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-6">
          <p
            className="text-muted-foreground mb-2"
            style={{ fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}
          >
            ¿Qué tipo de servicio necesita?
          </p>

          {/* Service type selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setServiceType('point_to_point')}
              className={`
                p-5 rounded-lg border-2 text-left transition-all
                ${serviceType === 'point_to_point'
                  ? 'border-violet-500 bg-violet-500/5'
                  : 'border-border bg-card hover:border-foreground/30'
                }
              `}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${serviceType === 'point_to_point' ? 'bg-violet-500/10' : 'bg-muted'}`}>
                  <MapPin className={`h-5 w-5 ${serviceType === 'point_to_point' ? 'text-violet-600' : 'text-muted-foreground'}`} />
                </div>
                <span
                  className="text-foreground"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '14px' }}
                >
                  Punto a punto
                </span>
              </div>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                Transfer de un origen a un destino específico.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setServiceType('pack')}
              className={`
                p-5 rounded-lg border-2 text-left transition-all
                ${serviceType === 'pack'
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-border bg-card hover:border-foreground/30'
                }
              `}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${serviceType === 'pack' ? 'bg-amber-500/10' : 'bg-muted'}`}>
                  <Clock className={`h-5 w-5 ${serviceType === 'pack' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                </div>
                <span
                  className="text-foreground"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '14px' }}
                >
                  Pack por horas
                </span>
              </div>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                Disposición del vehículo por un período de tiempo.
              </p>
            </button>
          </div>

          {/* Vehicle type selection */}
          {serviceType && (
            <div className="rounded-lg p-5 bg-card border border-border space-y-4">
              <h3
                className="text-muted-foreground"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                }}
              >
                Vehículo
              </h3>

              <div>
                <Label className="flex items-center gap-1.5 text-foreground">
                  <Car className="h-3.5 w-3.5 text-muted-foreground" />
                  Tipo de vehículo
                </Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                    <SelectValue placeholder="Seleccionar vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.label} ({v.capacity} pax)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pack duration (only for pack) */}
              {serviceType === 'pack' && (
                <div>
                  <Label className="flex items-center gap-1.5 text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Duración del pack
                  </Label>
                  <Select value={packDuration} onValueChange={(v) => setPackDuration(v as PackDuration)}>
                    <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                      <SelectValue placeholder="Seleccionar duración" />
                    </SelectTrigger>
                    <SelectContent>
                      {PACK_DURATIONS.map((d) => (
                        <SelectItem key={d.key} value={d.key}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Zone selection (only for point_to_point, optional for estimate) */}
              {serviceType === 'point_to_point' && (
                <div>
                  <Label className="flex items-center gap-1.5 text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Zona (para estimación de precio)
                  </Label>
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger className="mt-1.5 bg-background border-input text-foreground">
                      <SelectValue placeholder="Seleccionar zona (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFER_ZONES.map((z) => (
                        <SelectItem key={z.key} value={z.key}>
                          {z.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Estimated price display */}
              {estimatedPrice !== null && (
                <div
                  className="mt-4 p-4 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm text-muted-foreground"
                      style={{ fontFamily: 'Barlow, sans-serif' }}
                    >
                      Precio estimado {clientType === 'external_client' ? '(con comisión)' : '(B2B)'}
                    </span>
                    <span
                      className="text-xl text-foreground"
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                    >
                      {estimatedPrice} €
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: 'Barlow, sans-serif' }}>
                    Precio por trayecto, sin IVA. Precio final sujeto a confirmación.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* STEP 3: Transfer Details */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Client Info */}
          <div className="rounded-lg p-6 bg-card border border-border">
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

              <div className="sm:col-span-2">
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
                  placeholder="Ej: Reserva #1234, Yate Azul..."
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
          <div className="space-y-4">
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* STEP 4: Review & Submit */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-6">
          <p
            className="text-muted-foreground mb-2"
            style={{ fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}
          >
            Revisa los datos antes de enviar la solicitud.
          </p>

          {/* Summary card */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h3
                className="text-foreground"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '15px' }}
              >
                Resumen de la solicitud
              </h3>
            </div>

            <div className="p-5 space-y-4">
              {/* Client type & service type badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  clientType === 'external_client'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                }`}>
                  {clientType === 'external_client' ? <Users className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                  {clientType === 'external_client' ? 'Cliente directo' : 'Cliente de broker'}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  serviceType === 'point_to_point'
                    ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}>
                  {serviceType === 'point_to_point' ? <MapPin className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {serviceType === 'point_to_point' ? 'Punto a punto' : `Pack ${packDuration}`}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>Cliente</span>
                  <span className="text-foreground font-medium">{clientName}</span>
                </div>
                {clientReference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>Referencia</span>
                    <span className="text-foreground font-medium">{clientReference}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>Vehículo</span>
                  <span className="text-foreground font-medium">{vehicleInfo?.label || vehicleType}</span>
                </div>
                {serviceType === 'point_to_point' && selectedZone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>Zona</span>
                    <span className="text-foreground font-medium">{getZoneLabel(selectedZone)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>Trayectos</span>
                  <span className="text-foreground font-medium">{items.length}</span>
                </div>
              </div>

              {/* Estimated price */}
              {estimatedPrice !== null && (
                <div className="pt-3 mt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                      Precio estimado por trayecto
                    </span>
                    <span
                      className="text-lg text-foreground"
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                    >
                      {estimatedPrice} €
                    </span>
                  </div>
                  {items.length > 1 && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                        Total estimado ({items.length} trayectos)
                      </span>
                      <span
                        className="text-lg text-foreground"
                        style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                      >
                        {estimatedPrice * items.length} €
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2" style={{ fontFamily: 'Barlow, sans-serif' }}>
                    Precios sin IVA. El precio final será confirmado por el equipo.
                  </p>
                </div>
              )}

              {/* Notes */}
              {notes && (
                <div className="pt-3 mt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>Notas</span>
                  <p className="text-sm text-foreground mt-1">{notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Transfer items summary */}
          <div className="space-y-3">
            <h3
              className="text-muted-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              Detalle de trayectos
            </h3>
            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-foreground"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '13px' }}
                  >
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
          onClick={() => step > 1 ? goBack() : navigate('/broker')}
          disabled={isCreating}
          className="border-border text-muted-foreground"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step > 1 ? 'Anterior' : 'Cancelar'}
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={!canGoNext()}
            className="hover:brightness-110 bg-foreground text-background"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Siguiente
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating || !clientName.trim()}
            className="hover:brightness-110 bg-foreground text-background"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
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
  );
}
