import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useFleetInspection,
  useUpdateInspection,
  useAddInspectionPhoto,
  useDeleteInspectionPhoto,
  useUploadInspectionReceipt,
  useDeleteInspectionReceipt,
} from '@/hooks/useFleetInspections';
import { useFleetVehicle } from '@/hooks/useFleetVehicles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Loader2, Fuel, Save, Camera, X, Plus, FileText, Upload, Trash2, ExternalLink,
} from 'lucide-react';
import type { InspectionType, FleetInspectionPhoto } from '@/types/fleet';
import { PHOTO_CATEGORIES } from '@/types/fleet';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

function useSignedUrls(photos: FleetInspectionPhoto[] | undefined) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = useMemo(() => (photos || []).map(p => p.storage_path), [photos]);

  useEffect(() => {
    if (paths.length === 0) return;
    let cancelled = false;
    async function generate() {
      const result: Record<string, string> = {};
      await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage.from('repair-files').createSignedUrl(path, 3600);
          if (data?.signedUrl) result[path] = data.signedUrl;
        })
      );
      if (!cancelled) setUrls(prev => ({ ...prev, ...result }));
    }
    generate();
    return () => { cancelled = true; };
  }, [paths]);

  return urls;
}

function useSignedUrl(storagePath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!storagePath) { setUrl(null); return; }
    let cancelled = false;
    supabase.storage.from('repair-files').createSignedUrl(storagePath, 3600)
      .then(({ data }) => { if (!cancelled && data?.signedUrl) setUrl(data.signedUrl); });
    return () => { cancelled = true; };
  }, [storagePath]);
  return url;
}

export default function FleetInspectionEdit() {
  const { id, inspId } = useParams<{ id: string; inspId: string }>();
  const navigate = useNavigate();
  const { data: inspection, isLoading } = useFleetInspection(inspId);
  const { data: vehicle } = useFleetVehicle(id);
  const updateInspection = useUpdateInspection();
  const addPhoto = useAddInspectionPhoto();
  const deletePhoto = useDeleteInspectionPhoto();
  const uploadReceipt = useUploadInspectionReceipt();
  const deleteReceipt = useDeleteInspectionReceipt();

  const [form, setForm] = useState({
    inspection_type: 'recogida' as InspectionType,
    inspection_date: '',
    km: '',
    nivel_combustible: '',
    notas: '',
  });

  const [addPhotoCategory, setAddPhotoCategory] = useState('general');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const signedUrls = useSignedUrls(inspection?.photos);
  const receiptUrl = useSignedUrl(inspection?.receipt_url);

  useEffect(() => {
    if (inspection) {
      setForm({
        inspection_type: inspection.inspection_type,
        inspection_date: inspection.inspection_date?.slice(0, 16) || '',
        km: inspection.km != null ? String(inspection.km) : '',
        nivel_combustible: inspection.nivel_combustible || '',
        notas: inspection.notas || '',
      });
    }
  }, [inspection]);

  const handleSubmit = async () => {
    if (!inspId) return;
    await updateInspection.mutateAsync({
      inspectionId: inspId,
      data: {
        inspection_type: form.inspection_type,
        inspection_date: form.inspection_date ? new Date(form.inspection_date).toISOString() : undefined,
        km: form.km ? parseInt(form.km) : null,
        nivel_combustible: form.nivel_combustible || null,
        notas: form.notas || null,
      },
    });
    navigate(`/fleet/${id}/inspection/${inspId}`);
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !inspId || !id) return;
    await addPhoto.mutateAsync({ inspectionId: inspId, vehicleId: id, file, category: addPhotoCategory });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!inspId || !id) return;
    await deletePhoto.mutateAsync({ photoId, storagePath, inspectionId: inspId, vehicleId: id });
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !inspId || !id) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF');
      return;
    }
    await uploadReceipt.mutateAsync({ inspectionId: inspId, vehicleId: id, file });
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  const handleDeleteReceipt = async () => {
    if (!inspection?.receipt_url || !inspId || !id) return;
    await deleteReceipt.mutateAsync({ inspectionId: inspId, vehicleId: id, storagePath: inspection.receipt_url });
  };

  const isPdf = (path: string | null | undefined) => path?.toLowerCase().endsWith('.pdf');

  if (isLoading) {
    return (
      <AppLayout title="Editar Inspección">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!inspection) {
    return (
      <AppLayout title="Inspección no encontrada">
        <div className="text-center py-16">
          <p className="text-muted-foreground">La inspección no existe.</p>
          <Button variant="outline" onClick={() => navigate(`/fleet/${id}`)} className="mt-4 rounded-xl">Volver</Button>
        </div>
      </AppLayout>
    );
  }

  const photos = inspection.photos || [];

  return (
    <AppLayout title={`Editar Inspección — ${vehicle?.matricula || ''}`}>
      <div className="max-w-2xl mx-auto pb-8">
        <Button variant="ghost" onClick={() => navigate(`/fleet/${id}/inspection/${inspId}`)} className="mb-4 rounded-xl -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
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

          {/* ========== PHOTOS SECTION ========== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Fotos ({photos.length})
              </h3>
              <div className="flex items-center gap-2">
                <Select value={addPhotoCategory} onValueChange={setAddPhotoCategory}>
                  <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHOTO_CATEGORIES.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={addPhoto.isPending}
                >
                  {addPhoto.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Añadir
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAddPhoto}
                />
              </div>
            </div>

            {photos.length > 0 ? (
              PHOTO_CATEGORIES.map(cat => {
                const catPhotos = photos.filter(p => p.photo_category === cat.key);
                if (catPhotos.length === 0) return null;
                return (
                  <div key={cat.key} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1 border-b border-border/30">{cat.label}</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {catPhotos.map(photo => {
                        const url = signedUrls[photo.storage_path];
                        if (!url) return null;
                        return (
                          <div key={photo.id} className="relative group">
                            <button
                              onClick={() => setLightboxUrl(url)}
                              className="rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all active:scale-95 w-full"
                            >
                              <img
                                src={url}
                                alt={photo.description || photo.file_name}
                                className="w-full aspect-square object-cover"
                                loading="lazy"
                                onError={(e) => { e.currentTarget.style.display = 'none'; const p = document.createElement('div'); p.className = 'w-full aspect-square bg-muted/50 flex items-center justify-center'; p.innerHTML = '<span class="text-xs text-muted-foreground/60">No disponible</span>'; e.currentTarget.parentElement?.appendChild(p); }}
                              />
                            </button>
                            <button
                              onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                              title="Eliminar foto"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 rounded-2xl bg-card border border-border/50">
                <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Sin fotos en esta inspección</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl text-xs gap-1"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Plus className="h-3 w-3" />
                  Añadir primera foto
                </Button>
              </div>
            )}
          </div>

          {/* ========== RECEIPT / JUSTIFICANTE SECTION ========== */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Justificante</h3>
              </div>
              {inspection.receipt_url && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-xs h-7 gap-1"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={uploadReceipt.isPending}
                  >
                    {uploadReceipt.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Reemplazar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-lg text-xs h-7 text-destructive hover:text-destructive gap-1">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar justificante?</AlertDialogTitle>
                        <AlertDialogDescription>Se eliminará el archivo subido.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={handleDeleteReceipt}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            <div className="p-4">
              {inspection.receipt_url && receiptUrl ? (
                isPdf(inspection.receipt_url) ? (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Justificante PDF</p>
                      <p className="text-xs text-muted-foreground">Pulsa para abrir</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </a>
                ) : (
                  <button
                    onClick={() => setLightboxUrl(receiptUrl)}
                    className="rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all active:scale-95 w-full max-w-xs mx-auto block"
                  >
                    <img src={receiptUrl} alt="Justificante" className="w-full aspect-[4/3] object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; const p = document.createElement('div'); p.className = 'w-full aspect-[4/3] bg-muted/50 flex items-center justify-center'; p.innerHTML = '<span class="text-xs text-muted-foreground/60">No disponible</span>'; e.currentTarget.parentElement?.appendChild(p); }} />
                  </button>
                )
              ) : (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground mb-3">Sin justificante</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs gap-1"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={uploadReceipt.isPending}
                  >
                    {uploadReceipt.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Subir justificante
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleUploadReceipt}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 pb-4">
            <Button type="button" variant="outline" onClick={() => navigate(`/fleet/${id}/inspection/${inspId}`)} className="flex-1 rounded-2xl h-12">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={updateInspection.isPending}
              className="flex-1 rounded-2xl h-12 text-base"
            >
              {updateInspection.isPending ? 'Guardando...' : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/20 backdrop-blur-sm text-white flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxUrl}
              alt=""
              className="max-w-full max-h-full rounded-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
