import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCreateInspection } from '@/hooks/useFleetInspections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Camera, AlertTriangle, ChevronLeft, ChevronRight, Check, FileText, CheckCircle2, Fuel, Info } from 'lucide-react';
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_GROUPS, DAMAGE_ZONES, type PhotoCategory, type InspectionType, type DamageSeverity } from '@/types/fleet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  saveDraftMeta,
  loadDraftMeta,
  clearAllInspectionDraft,
  saveDraftPhotos,
  loadDraftPhotos,
  type InspectionDraftMeta,
} from '@/lib/inspectionDraftStorage';
import { DamageCamera } from '@/components/fleet/DamageCamera';
import { PhotoCaptureDialog } from '@/components/fleet/PhotoCaptureDialog';

interface PendingPhoto {
  file: File;
  category: PhotoCategory;
  description: string;
  preview: string;
}

interface PendingDamagePhoto {
  file: File;
  preview: string;
}

interface PendingDamage {
  zona: string;
  pieza: string;
  descripcion: string;
  severidad: DamageSeverity;
  photos: PendingDamagePhoto[];
}

const STEPS = [
  { label: 'Datos', icon: <FileText className="h-4 w-4" />, description: 'Introduce los datos del vehículo' },
  { label: 'Fotos', icon: <Camera className="h-4 w-4" />, description: 'Fotografía el vehículo desde cada ángulo' },
  { label: 'Daños', icon: <AlertTriangle className="h-4 w-4" />, description: 'Registra los daños si los hay' },
];

const FUEL_LEVELS = [
  { value: 'vacio', label: 'Vacío', short: 'E', color: 'bg-red-600 text-white', inactiveColor: 'bg-red-600/10 text-red-600 border-red-600/30' },
  { value: '1/8', label: '1/8', short: '⅛', color: 'bg-red-500 text-white', inactiveColor: 'bg-red-500/10 text-red-500 border-red-500/30' },
  { value: '2/8', label: '2/8', short: '¼', color: 'bg-orange-500 text-white', inactiveColor: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  { value: '3/8', label: '3/8', short: '⅜', color: 'bg-orange-400 text-white', inactiveColor: 'bg-orange-400/10 text-orange-500 border-orange-400/30' },
  { value: '4/8', label: '4/8', short: '½', color: 'bg-yellow-500 text-white', inactiveColor: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  { value: '5/8', label: '5/8', short: '⅝', color: 'bg-yellow-400 text-white', inactiveColor: 'bg-yellow-400/10 text-yellow-500 border-yellow-400/30' },
  { value: '6/8', label: '6/8', short: '¾', color: 'bg-lime-500 text-white', inactiveColor: 'bg-lime-500/10 text-lime-600 border-lime-500/30' },
  { value: '7/8', label: '7/8', short: '⅞', color: 'bg-emerald-400 text-white', inactiveColor: 'bg-emerald-400/10 text-emerald-600 border-emerald-400/30' },
  { value: 'lleno', label: 'Lleno', short: 'F', color: 'bg-emerald-600 text-white', inactiveColor: 'bg-emerald-600/10 text-emerald-700 border-emerald-600/30' },
];

const REQUIRED_PHOTO_CATS: PhotoCategory[] = ['frontal', 'trasera', 'lateral_izq', 'lateral_der'];

const SEVERITY_OPTIONS: { value: DamageSeverity; label: string; color: string; activeColor: string }[] = [
  { value: 'leve', label: 'Leve', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30', activeColor: 'bg-emerald-500 text-white border-emerald-500 shadow-sm' },
  { value: 'moderado', label: 'Moderado', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', activeColor: 'bg-yellow-500 text-white border-yellow-500 shadow-sm' },
  { value: 'grave', label: 'Grave', color: 'bg-destructive/10 text-destructive border-destructive/30', activeColor: 'bg-destructive text-destructive-foreground border-destructive shadow-sm' },
];

export default function FleetInspectionNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const createInspection = useCreateInspection();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const restoredRef = useRef(false);

  // ── Restore draft from localStorage (sync) ──────────────────────────
  const savedMeta = useRef(id ? loadDraftMeta(id) : null).current;

  const [step, setStep] = useState(savedMeta?.step ?? 0);
  const [form, setForm] = useState(savedMeta?.form ?? {
    inspection_type: 'recogida' as InspectionType,
    inspection_date: new Date().toISOString().slice(0, 16),
    km: '',
    nivel_combustible: '',
    notas: '',
  });
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [activeDamageCamera, setActiveDamageCamera] = useState<number | null>(null);
  const [activePhotoCategory, setActivePhotoCategory] = useState<PhotoCategory | null>(null);
  const [damages, setDamages] = useState<PendingDamage[]>(
    savedMeta?.damages?.map((d) => ({
      zona: d.zona,
      pieza: d.pieza,
      descripcion: d.descripcion,
      severidad: d.severidad as DamageSeverity,
      photos: [] as PendingDamagePhoto[],
    })) ?? [],
  );

  // ── Restore photos from IndexedDB (async) ───────────────────────────
  useEffect(() => {
    if (!id || !savedMeta) return;
    restoredRef.current = true;

    loadDraftPhotos(id).then((restored) => {
      if (!restored) return;
      if (restored.general.length > 0) {
        setPhotos(restored.general.map((p) => ({
          file: p.file,
          category: p.category as PhotoCategory,
          description: p.description,
          preview: p.preview,
        })));
      }
      if (restored.damages.length > 0) {
        setDamages((prev) =>
          prev.map((d, i) => ({
            ...d,
            photos: restored.damages[i] ?? [],
          })),
        );
      }
    });

    import('sonner').then(({ toast }) => {
      toast.info('Se ha restaurado tu progreso anterior');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist metadata to localStorage on every change ────────────────
  useEffect(() => {
    if (!id) return;
    const meta: InspectionDraftMeta = {
      step,
      form,
      damages: damages.map((d) => ({
        zona: d.zona,
        pieza: d.pieza,
        descripcion: d.descripcion,
        severidad: d.severidad,
        photoCount: d.photos.length,
      })),
      generalPhotoCount: photos.length,
      savedAt: Date.now(),
    };
    saveDraftMeta(id, meta);
  }, [step, form, damages, photos.length, id]);

  // ── Synchronous save + async photo persist before camera ────────────
  const persistBeforeCamera = useCallback(() => {
    if (!id) return;
    // 1. Sync: save metadata to localStorage immediately
    const meta: InspectionDraftMeta = {
      step,
      form,
      damages: damages.map((d) => ({
        zona: d.zona,
        pieza: d.pieza,
        descripcion: d.descripcion,
        severidad: d.severidad,
        photoCount: d.photos.length,
      })),
      generalPhotoCount: photos.length,
      savedAt: Date.now(),
    };
    saveDraftMeta(id, meta);

    // 2. Async: save photos to IndexedDB (fire and forget)
    saveDraftPhotos(
      id,
      photos.map((p) => ({ file: p.file, category: p.category, description: p.description })),
      damages.map((d) => d.photos.map((p) => ({ file: p.file }))),
    );
  }, [id, step, form, damages, photos]);

  const handleFileSelect = (category: PhotoCategory) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: PendingPhoto[] = Array.from(files).map(file => ({
      file,
      category,
      description: '',
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const addDamage = () => {
    setDamages(prev => [...prev, { zona: 'frontal', pieza: '', descripcion: '', severidad: 'leve', photos: [] }]);
  };

  const updateDamage = (idx: number, field: keyof PendingDamage, value: string) => {
    setDamages(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const removeDamage = (idx: number) => {
    setDamages(prev => {
      prev[idx].photos.forEach(p => URL.revokeObjectURL(p.preview));
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDamagePhoto = (damageIdx: number, capture: boolean) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: PendingDamagePhoto[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setDamages(prev => prev.map((d, i) => i === damageIdx ? { ...d, photos: [...d.photos, ...newPhotos] } : d));
    e.target.value = '';
  };

  const removeDamagePhoto = (damageIdx: number, photoIdx: number) => {
    setDamages(prev => prev.map((d, i) => {
      if (i !== damageIdx) return d;
      URL.revokeObjectURL(d.photos[photoIdx].preview);
      return { ...d, photos: d.photos.filter((_, pi) => pi !== photoIdx) };
    }));
  };

  const handleSubmit = async () => {
    await createInspection.mutateAsync({
      inspection: {
        fleet_vehicle_id: id!,
        inspection_type: form.inspection_type,
        inspection_date: new Date(form.inspection_date).toISOString(),
        km: form.km ? parseInt(form.km) : undefined,
        nivel_combustible: form.nivel_combustible || undefined,
        notas: form.notas || undefined,
      },
      damages: damages.map(d => ({
        zona: d.zona,
        pieza: d.pieza || null,
        descripcion: d.descripcion || null,
        severidad: d.severidad as DamageSeverity,
        photos: d.photos.map(p => p.file),
      })),
      photoFiles: photos.map(p => ({
        file: p.file,
        category: p.category,
        description: p.description || undefined,
      })),
    });
    // Clean up draft on success
    if (id) await clearAllInspectionDraft(id);
    navigate(`/fleet/${id}`);
  };

  const canNext = step === 0 ? !!form.inspection_type : true;

  // Photo progress helpers
  const allCatKeys = PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key));
  const coveredCats = new Set(photos.map(p => p.category));
  const coveredCount = allCatKeys.filter(k => coveredCats.has(k)).length;

  // Step 1 field completion indicators
  const step1Fields = [
    { label: 'Tipo', done: !!form.inspection_type },
    { label: 'Fecha', done: !!form.inspection_date },
    { label: 'Km', done: !!form.km },
    { label: 'Combustible', done: !!form.nivel_combustible },
  ];
  const step1Done = step1Fields.filter(f => f.done).length;

  // Helper: trigger camera input with pre-save
  const triggerCameraInput = (inputId: string) => {
    persistBeforeCamera();
    document.getElementById(inputId)?.click();
  };

  return (
    <AppLayout title="Nueva Inspección">
      <div className="max-w-2xl mx-auto flex flex-col min-h-[calc(100vh-120px)]">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate(`/fleet/${id}`)} className="rounded-xl -ml-2 mb-4 self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  i === step
                    ? 'bg-primary text-primary-foreground shadow-sm scale-110'
                    : i < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : s.icon}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 rounded-full transition-colors ${
                  i < step ? 'bg-primary/40' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-foreground">{STEPS[step].label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{STEPS[step].description}</p>
        </div>

        {/* Step Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Completion indicator */}
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  {step1Fields.map((f, i) => (
                    <div key={i} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      f.done ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground'
                    }`}>
                      {f.done ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />}
                      {f.label}
                    </div>
                  ))}
                </div>

                {/* Type Toggle */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo de inspección</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['recogida', 'devolucion'] as InspectionType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, inspection_type: type }))}
                        className={`p-4 rounded-2xl border-2 text-center transition-all ${
                          form.inspection_type === type
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border/50 bg-card text-muted-foreground hover:border-border'
                        }`}
                      >
                        <span className="text-2xl block mb-1">{type === 'recogida' ? '📥' : '📤'}</span>
                        <span className="text-sm font-medium">{type === 'recogida' ? 'Recogida' : 'Devolución'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border/50 shadow-sm divide-y divide-border/50">
                  <div className="flex items-center gap-4 px-4 py-3">
                    <Label className="text-sm text-muted-foreground w-24 shrink-0">Fecha</Label>
                    <Input
                      type="datetime-local"
                      value={form.inspection_date}
                      onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))}
                      className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-4 px-4 py-3">
                    <Label className="text-sm text-muted-foreground w-24 shrink-0">Kilómetros</Label>
                    <Input
                      type="number"
                      value={form.km}
                      onChange={e => setForm(f => ({ ...f, km: e.target.value }))}
                      placeholder="Km actuales"
                      className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                </div>

                {/* Fuel Level Visual Bar */}
                <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm text-muted-foreground">Nivel de combustible</Label>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                    {FUEL_LEVELS.map(level => {
                      const isActive = form.nivel_combustible === level.value;
                      return (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, nivel_combustible: level.value }))}
                          className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border-2 transition-all active:scale-95 ${
                            isActive
                              ? `${level.color} border-transparent shadow-md`
                              : `${level.inactiveColor} hover:opacity-80`
                          }`}
                        >
                          <span className="text-lg font-bold leading-none">{level.short}</span>
                          <span className="text-[10px] font-medium leading-none">{level.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Notas</Label>
                  <Textarea
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    placeholder="Observaciones generales..."
                    className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none min-h-[60px] mt-2"
                  />
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {/* Progress counter */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground">
                    Toca cada zona para añadir fotos
                  </p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    coveredCount === allCatKeys.length
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/60 text-muted-foreground'
                  }`}>
                    {coveredCount} / {allCatKeys.length} zonas
                  </span>
                </div>

                {activePhotoCategory ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground px-1">
                      {PHOTO_CATEGORIES.find(c => c.key === activePhotoCategory)?.label}
                    </h4>
                    <PhotoCaptureDialog
                      label={`Foto: ${PHOTO_CATEGORIES.find(c => c.key === activePhotoCategory)?.label}`}
                      onConfirm={(files) => {
                        const newPhotos: PendingPhoto[] = files.map(f => ({
                          file: f.file,
                          category: activePhotoCategory,
                          description: '',
                          preview: f.preview,
                        }));
                        setPhotos(prev => [...prev, ...newPhotos]);
                        setActivePhotoCategory(null);
                      }}
                      onClose={() => setActivePhotoCategory(null)}
                      multiple={true}
                    />
                  </div>
                ) : (
                  PHOTO_CATEGORY_GROUPS.map(group => (
                    <div key={group.group} className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{group.group}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {group.items.map(cat => {
                          const catPhotos = photos.filter(p => p.category === cat.key);
                          const hasPhoto = catPhotos.length > 0;
                          const isRequired = REQUIRED_PHOTO_CATS.includes(cat.key);
                          return (
                            <button
                              key={cat.key}
                              type="button"
                              onClick={() => {
                                persistBeforeCamera();
                                setActivePhotoCategory(cat.key);
                              }}
                              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95 ${
                                hasPhoto
                                  ? 'bg-primary/5 border-primary/30'
                                  : 'bg-card border-border/50 hover:border-primary/30'
                              }`}
                            >
                              {hasPhoto ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <Camera className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className="text-[11px] font-medium text-foreground leading-tight text-center">{cat.label}</span>
                              {isRequired && !hasPhoto && (
                                <span className="text-[9px] text-muted-foreground/70">requerida</span>
                              )}
                              {catPhotos.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                                  {catPhotos.length}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}

                {photos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground px-1">{photos.length} fotos seleccionadas</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {photos.map((p, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden border border-border/50 shadow-sm">
                          <img src={p.preview} alt="" className="w-full aspect-square object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm py-1 px-2">
                            <span className="text-[10px] text-foreground">
                              {PHOTO_CATEGORIES.find(c => c.key === p.category)?.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Guide text */}
                <div className="flex items-start gap-2.5 rounded-2xl bg-muted/40 border border-border/50 p-3">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ¿El vehículo tiene algún daño? Añade cada daño con su zona y severidad. Si no hay daños, puedes guardar directamente.
                  </p>
                </div>

                <Button type="button" onClick={addDamage} variant="outline" className="w-full rounded-2xl h-12">
                  <Plus className="h-5 w-5 mr-2" />
                  Añadir Daño
                </Button>

                {damages.length === 0 && (
                  <div className="text-center py-10 rounded-2xl bg-card border border-border/50">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-primary/30" />
                    <p className="text-sm text-muted-foreground">Sin daños registrados</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">¡Perfecto! Pulsa "Guardar" para finalizar</p>
                  </div>
                )}

                <AnimatePresence>
                  {damages.map((d, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Daño #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeDamage(idx)}
                            className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Zona — visual buttons */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Zona del vehículo</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {DAMAGE_ZONES.map(z => (
                              <button
                                key={z.key}
                                type="button"
                                onClick={() => updateDamage(idx, 'zona', z.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                  d.zona === z.key
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-muted/40 text-muted-foreground border-border/50 hover:border-border'
                                }`}
                              >
                                {z.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Severidad — color buttons */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Severidad</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {SEVERITY_OPTIONS.map(sev => (
                              <button
                                key={sev.value}
                                type="button"
                                onClick={() => updateDamage(idx, 'severidad', sev.value)}
                                className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                                  d.severidad === sev.value ? sev.activeColor : sev.color
                                }`}
                              >
                                {sev.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Pieza</Label>
                            <Input value={d.pieza} onChange={e => updateDamage(idx, 'pieza', e.target.value)} placeholder="Ej: Parachoques" className="rounded-xl h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Descripción</Label>
                            <Input value={d.descripcion} onChange={e => updateDamage(idx, 'descripcion', e.target.value)} placeholder="Ej: Ralladura 10cm" className="rounded-xl h-9" />
                          </div>
                        </div>

                        {/* Damage photos */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Fotos del daño</Label>

                          {activeDamageCamera === idx ? (
                            <DamageCamera
                              onCapture={(file, preview) => {
                                setDamages(prev => prev.map((dd, i) =>
                                  i === idx ? { ...dd, photos: [...dd.photos, { file, preview }] } : dd
                                ));
                                setActiveDamageCamera(null);
                              }}
                              onClose={() => setActiveDamageCamera(null)}
                            />
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl flex-1"
                                onClick={() => setActiveDamageCamera(idx)}
                              >
                                <Camera className="h-4 w-4 mr-1.5" />
                                Cámara
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl flex-1"
                                onClick={() => document.getElementById(`damage-attach-${idx}`)?.click()}
                              >
                                <Plus className="h-4 w-4 mr-1.5" />
                                Adjuntar
                              </Button>
                              <input
                                id={`damage-attach-${idx}`}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                className="hidden"
                                onChange={handleDamagePhoto(idx, false)}
                              />
                            </div>
                          )}

                          {d.photos.length > 0 && (
                            <div className="grid grid-cols-4 gap-1.5">
                              {d.photos.map((p, pi) => (
                                <div key={pi} className="relative rounded-lg overflow-hidden border border-border/50 aspect-square">
                                  <img src={p.preview} alt="" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removeDamagePhoto(idx, pi)}
                                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border/50 py-4 mt-6 flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 rounded-2xl h-12"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
          )}
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex-1 rounded-2xl h-12 text-base"
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createInspection.isPending}
              className="flex-1 rounded-2xl h-12 text-base"
            >
              {createInspection.isPending ? 'Guardando...' : 'Guardar Inspección'}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
