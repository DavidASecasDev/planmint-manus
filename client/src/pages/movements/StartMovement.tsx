import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Package, Car, Check, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PlateCamera } from '@/components/movements/PlateCamera';
import { PlateConfirm } from '@/components/movements/PlateConfirm';
import { useMovements, MovementType, ocrPlate, uploadMovementPhoto } from '@/hooks/useMovements';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import {
  saveDraftMeta, loadDraftMeta, clearAllDraft, saveDraftImage, loadDraftImage,
  type DraftMeta,
} from '@/lib/movementDraftStorage';

const log = createLogger({ context: 'StartMovement' });

type Step = 'type' | 'camera' | 'confirm' | 'saving';

const TYPE_OPTIONS: { value: MovementType; label: string; icon: React.ElementType; desc: string; color: string; bgColor: string }[] = [
  { value: 'entrega', label: 'Entrega', icon: Truck, desc: 'Entregar un vehículo al cliente', color: 'text-primary', bgColor: 'bg-primary/10' },
  { value: 'recogida', label: 'Recogida', icon: Package, desc: 'Recoger un vehículo del cliente', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  { value: 'escoba', label: 'Escoba', icon: Car, desc: 'Vehículo de acompañamiento', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  { value: 'limpieza', label: 'Limpieza', icon: Sparkles, desc: 'Limpieza de un vehículo', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10' },
];

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'Tipo' },
  { key: 'camera', label: 'Foto' },
  { key: 'confirm', label: 'Confirmar' },
];

export default function StartMovement() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { startMovement } = useMovements();
  const userId = profile?.id ?? '';
  const orgId = profile?.organization_id ?? '';

  // ── Draft restoration ───────────────────────────────────────────────
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [step, setStep] = useState<Step>('type');
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [detectedPlate, setDetectedPlate] = useState('');
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState('');

  const metaRef = useRef<DraftMeta | null>(null);

  // Restore draft on mount (once)
  useEffect(() => {
    if (!userId || !orgId) return;
    const meta = loadDraftMeta(userId, orgId);
    if (meta) {
      log.debug('Draft meta restored:', meta);
      const restoredStep = meta.step === 'saving' ? 'confirm' : meta.step;
      setStep(restoredStep as Step);
      setMovementType((meta.movementType as MovementType) ?? null);
      setDetectedPlate(meta.detectedPlate);
      setOcrSuccess(meta.ocrSuccess);
      setNotes(meta.notes);
      metaRef.current = { ...meta, step: restoredStep as Step };

      if (meta.hasImage) {
        loadDraftImage(userId, orgId).then((img) => {
          if (img) {
            log.debug('Draft image restored from IndexedDB');
            setImageBase64(img);
          } else {
            log.warn('Draft meta says hasImage but IndexedDB returned null');
            if (restoredStep === 'confirm') {
              setStep('camera');
              persistMeta({ step: 'camera', hasImage: false });
            }
          }
          setDraftLoaded(true);
        });
        return;
      }
    }
    setDraftLoaded(true);
  }, [userId, orgId]);

  const persistMeta = useCallback((partial: Partial<DraftMeta>) => {
    if (!userId || !orgId) return;
    metaRef.current = saveDraftMeta(userId, orgId, partial, metaRef.current ?? undefined);
  }, [userId, orgId]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => log.warn('GPS error:', err.message)
      );
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSelectType = useCallback((type: MovementType) => {
    setMovementType(type);
    setStep('camera');
    persistMeta({ step: 'camera', movementType: type });
    log.debug('Type selected:', type);
  }, [persistMeta]);

  const handleBeforeOpenCamera = useCallback(() => {
    persistMeta({ step: 'camera' });
  }, [persistMeta]);

  const handleFileSelected = useCallback((base64: string) => {
    log.debug('File selected, saving to IndexedDB');
    setImageBase64(base64);
    persistMeta({ hasImage: true });
    if (userId && orgId) {
      saveDraftImage(userId, orgId, base64).catch((err) =>
        log.error('Failed to persist image to IndexedDB', err)
      );
    }
  }, [persistMeta, userId, orgId]);

  const handlePhotoCapture = useCallback(async (base64: string) => {
    log.debug('Photo confirmed, calling OCR');
    setImageBase64(base64);
    setIsProcessingOcr(true);
    try {
      const result = await ocrPlate(base64);
      log.debug('OCR result:', result);
      setDetectedPlate(result.plate);
      setOcrSuccess(result.success);
      setStep('confirm');
      persistMeta({ step: 'confirm', detectedPlate: result.plate, ocrSuccess: result.success });
    } catch (err) {
      log.error('OCR error:', err);
      setDetectedPlate('');
      setOcrSuccess(false);
      setStep('confirm');
      persistMeta({ step: 'confirm', detectedPlate: '', ocrSuccess: false });
      toast({ title: 'Error OCR', description: 'No se pudo leer la matrícula. Introdúcela manualmente.', variant: 'destructive' });
    } finally {
      setIsProcessingOcr(false);
    }
  }, [persistMeta]);

  const handleBack = useCallback(() => {
    if (step === 'camera') {
      setStep('type');
      persistMeta({ step: 'type' });
    } else if (step === 'confirm') {
      setStep('camera');
      persistMeta({ step: 'camera' });
    }
  }, [step, persistMeta]);

  const handleConfirmPlate = useCallback(async (plate: string) => {
    if (!movementType || !orgId || !imageBase64) return;
    setStep('saving');
    log.debug('Saving movement for plate:', plate);
    try {
      // Validate plate exists in the organization's fleet (fleet_vehicles table)
      const cleanPlate = plate.replace(/\s+/g, '');
      const { data: fleetVehicles, error: fleetError } = await supabase
        .from('fleet_vehicles')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('matricula', cleanPlate)
        .limit(1);

      if (fleetError) {
        log.error('Fleet vehicle lookup error:', fleetError);
        throw new Error('Error al verificar la matrícula. Inténtalo de nuevo.');
      }

      // Also check the vehicles table (operational vehicles)
      let vehicleId: string | undefined;
      const { data: opVehicles } = await supabase
        .from('vehicles')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('matricula', cleanPlate)
        .is('archived_at', null)
        .limit(1);

      if (opVehicles && opVehicles.length > 0) {
        vehicleId = opVehicles[0].id;
      }

      // If not found in either table, show error
      if ((!fleetVehicles || fleetVehicles.length === 0) && !vehicleId) {
        log.warn('Plate not found in fleet:', plate);
        toast({
          title: 'Matrícula no encontrada',
          description: `La matrícula "${plate}" no está registrada en la flota. Verifica que sea correcta o regístrala primero en Estado Coches.`,
          variant: 'destructive',
        });
        setStep('confirm');
        persistMeta({ step: 'confirm' });
        return;
      }

      log.debug('Vehicle found in fleet:', fleetVehicles?.[0]?.id, 'operational:', vehicleId);

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const byteArray = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const photoUrl = await uploadMovementPhoto(blob, orgId);

      await startMovement.mutateAsync({
        matricula: plate,
        movement_type: movementType,
        start_photo_url: photoUrl,
        start_lat: gps?.lat,
        start_lng: gps?.lng,
        vehicle_id: vehicleId,
        notes: notes || undefined,
      });
      log.debug('Movement created successfully');
      await clearAllDraft(userId, orgId);
      toast({ title: 'Movimiento creado', description: `Matrícula ${plate} registrada correctamente.` });
      navigate('/movements');
    } catch (err: any) {
      log.error('Start movement error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setStep('confirm');
      persistMeta({ step: 'confirm' });
    }
  }, [movementType, orgId, imageBase64, gps, notes, startMovement, navigate, persistMeta, userId]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  if (!draftLoaded && userId && orgId) {
    return (
      <AppLayout title="Nuevo Movimiento">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Nuevo Movimiento">
      <div className="min-h-[calc(100vh-10rem)] flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              if (step === 'type') {
                clearAllDraft(userId, orgId);
                navigate('/movements');
              } else {
                handleBack();
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Nuevo Movimiento</h1>
            <p className="text-sm text-muted-foreground">
              {step === 'type' && 'Selecciona el tipo de movimiento'}
              {step === 'camera' && 'Captura la matrícula del vehículo'}
              {step === 'confirm' && 'Confirma los datos del movimiento'}
              {step === 'saving' && 'Guardando...'}
            </p>
          </div>
        </div>

        {/* Stepper */}
        {step !== 'saving' && (
          <div className="flex items-center gap-1 mb-8 px-1">
            {STEPS.map((s, i) => {
              const isActive = i === currentStepIndex;
              const isDone = i < currentStepIndex;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold transition-all',
                        isDone && 'bg-primary text-primary-foreground shadow-sm',
                        isActive && 'bg-primary/15 text-primary ring-2 ring-primary/30',
                        !isDone && !isActive && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      'flex-1 h-0.5 mx-3 rounded-full mt-[-1rem]',
                      isDone ? 'bg-primary' : 'bg-border'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          {step === 'type' && (
            <div className="space-y-3">
              {TYPE_OPTIONS.map((opt) => (
                <Card
                  key={opt.value}
                  className={cn(
                    'cursor-pointer transition-all hover-lift border-2 active:scale-[0.98]',
                    movementType === opt.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent hover:border-border'
                  )}
                  onClick={() => handleSelectType(opt.value)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn('p-3 rounded-xl shrink-0', opt.bgColor)}>
                      <opt.icon className={cn('h-6 w-6', opt.color)} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-base text-foreground">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 'camera' && (
            <PlateCamera
              onCapture={handlePhotoCapture}
              onBeforeOpen={handleBeforeOpenCamera}
              onFileSelected={handleFileSelected}
              restoredPreview={imageBase64}
              isProcessing={isProcessingOcr}
            />
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <PlateConfirm
                detectedPlate={detectedPlate}
                onConfirm={handleConfirmPlate}
                ocrSuccess={ocrSuccess}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Notas (opcional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    persistMeta({ notes: e.target.value });
                  }}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="resize-none"
                />
              </div>
              {gps && (
                <p className="text-xs text-muted-foreground text-center">
                  📍 {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </p>
              )}
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Guardando movimiento…</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
