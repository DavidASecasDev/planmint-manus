import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useFleetInspection,
  useFleetInspections,
  useDeleteInspection,
  useAddInspectionPhoto,
  useDeleteInspectionPhoto,
  useReplaceInspectionPhoto,
  useAddMultipleInspectionPhotos,
  useUploadInspectionReceipt,
  useDeleteInspectionReceipt,
} from '@/hooks/useFleetInspections';
import { useFleetVehicle } from '@/hooks/useFleetVehicles';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, X, Camera, Calendar, Gauge, Fuel, User,
  Pencil, Trash2, Plus, FileText, Upload, Download, ExternalLink,
  ImagePlus, RefreshCw, Images,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_GROUPS, DAMAGE_ZONES } from '@/types/fleet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import type { FleetInspectionPhoto, PhotoCategory } from '@/types/fleet';
import { toast } from 'sonner';

function useSignedUrls(photos: FleetInspectionPhoto[] | undefined) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  const paths = useMemo(
    () => (photos || []).map(p => p.storage_path),
    [photos]
  );

  useEffect(() => {
    if (paths.length === 0) return;
    let cancelled = false;

    async function generate() {
      const result: Record<string, string> = {};
      await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage
            .from('repair-files')
            .createSignedUrl(path, 3600);
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
    supabase.storage
      .from('repair-files')
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [storagePath]);

  return url;
}

export default function FleetInspectionDetail() {
  const { id, inspId } = useParams<{ id: string; inspId: string }>();
  const navigate = useNavigate();
  const { data: inspection, isLoading } = useFleetInspection(inspId);
  const { data: vehicle } = useFleetVehicle(id);
  const { data: allInspections = [] } = useFleetInspections(id);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('fleet.manage');

  const deleteInspection = useDeleteInspection();
  const addPhoto = useAddInspectionPhoto();
  const deletePhoto = useDeleteInspectionPhoto();
  const replacePhoto = useReplaceInspectionPhoto();
  const addMultiplePhotos = useAddMultipleInspectionPhotos();
  const uploadReceipt = useUploadInspectionReceipt();
  const deleteReceipt = useDeleteInspectionReceipt();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'compare'>('current');
  const [addPhotoCategory, setAddPhotoCategory] = useState<string>('general');
  const [failedPaths, setFailedPaths] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const multiPhotoInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const categoryUploadRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ photoId: string; storagePath: string } | null>(null);
  const [categoryUploadTarget, setCategoryUploadTarget] = useState<PhotoCategory | null>(null);

  const counterpart = inspection
    ? allInspections.find(
        i => i.id !== inspection.id && i.inspection_type !== inspection.inspection_type
      )
    : null;

  const allPhotos = useMemo(() => [
    ...(inspection?.photos || []),
    ...(counterpart?.photos || []),
  ], [inspection?.photos, counterpart?.photos]);
  const signedUrls = useSignedUrls(allPhotos);
  const receiptUrl = useSignedUrl(inspection?.receipt_url);

  // Track which photos failed to load
  const handleImageError = useCallback((storagePath: string) => {
    setFailedPaths(prev => new Set(prev).add(storagePath));
  }, []);

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !inspId || !id) return;
    await addPhoto.mutateAsync({
      inspectionId: inspId,
      vehicleId: id,
      file,
      category: addPhotoCategory,
    });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleMultiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !inspId || !id) return;
    await addMultiplePhotos.mutateAsync({
      inspectionId: inspId,
      vehicleId: id,
      files: Array.from(files),
      category: addPhotoCategory,
    });
    if (multiPhotoInputRef.current) multiPhotoInputRef.current.value = '';
  };

  const handleReplacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTarget || !inspId || !id) return;
    await replacePhoto.mutateAsync({
      photoId: replaceTarget.photoId,
      oldStoragePath: replaceTarget.storagePath,
      inspectionId: inspId,
      vehicleId: id,
      file,
    });
    setReplaceTarget(null);
    setFailedPaths(prev => {
      const next = new Set(prev);
      next.delete(replaceTarget.storagePath);
      return next;
    });
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const handleCategoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !categoryUploadTarget || !inspId || !id) return;
    if (files.length === 1) {
      await addPhoto.mutateAsync({
        inspectionId: inspId,
        vehicleId: id,
        file: files[0],
        category: categoryUploadTarget,
      });
    } else {
      await addMultiplePhotos.mutateAsync({
        inspectionId: inspId,
        vehicleId: id,
        files: Array.from(files),
        category: categoryUploadTarget,
      });
    }
    setCategoryUploadTarget(null);
    if (categoryUploadRef.current) categoryUploadRef.current.value = '';
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!inspId || !id) return;
    await deletePhoto.mutateAsync({ photoId, storagePath, inspectionId: inspId, vehicleId: id });
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canManage) setIsDragging(true);
  }, [canManage]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!canManage || !inspId || !id) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    if (files.length === 1) {
      await addPhoto.mutateAsync({
        inspectionId: inspId,
        vehicleId: id,
        file: files[0],
        category: addPhotoCategory,
      });
    } else {
      await addMultiplePhotos.mutateAsync({
        inspectionId: inspId,
        vehicleId: id,
        files,
        category: addPhotoCategory,
      });
    }
  }, [canManage, inspId, id, addPhotoCategory, addPhoto, addMultiplePhotos]);

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
    await deleteReceipt.mutateAsync({
      inspectionId: inspId,
      vehicleId: id,
      storagePath: inspection.receipt_url,
    });
  };

  if (isLoading) {
    return (
      <AppLayout title="Inspección">
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

  const severityConfig = (s: string) => {
    if (s === 'grave') return { color: 'bg-destructive', label: 'Grave', textColor: 'text-destructive' };
    if (s === 'moderado') return { color: 'bg-yellow-500', label: 'Moderado', textColor: 'text-yellow-600' };
    return { color: 'bg-green-500', label: 'Leve', textColor: 'text-green-600' };
  };

  const isPdf = (path: string | null | undefined) => path?.toLowerCase().endsWith('.pdf');

  // Compute which categories have photos and which are missing
  const photosPerCategory = useMemo(() => {
    const map = new Map<string, FleetInspectionPhoto[]>();
    for (const p of (inspection.photos || [])) {
      const existing = map.get(p.photo_category) || [];
      existing.push(p);
      map.set(p.photo_category, existing);
    }
    return map;
  }, [inspection.photos]);

  // Categories that are expected but have no photos (excluding 'general' and 'dano_detalle')
  const missingCategories = useMemo(() => {
    const expectedKeys = PHOTO_CATEGORY_GROUPS
      .flatMap(g => g.items.map(i => i.key))
      .filter(k => k !== 'general' && k !== 'dano_detalle');
    return expectedKeys.filter(k => !photosPerCategory.has(k));
  }, [photosPerCategory]);

  const isUploading = addPhoto.isPending || addMultiplePhotos.isPending || replacePhoto.isPending;

  const renderPhotos = (photos: typeof inspection.photos, editable = false) => {
    if (!photos || photos.length === 0) return null;
    return PHOTO_CATEGORIES.map(cat => {
      const catPhotos = photos.filter(p => p.photo_category === cat.key);
      if (catPhotos.length === 0) return null;
      return (
        <div key={cat.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1 border-b border-border/30 flex-1">{cat.label}</h4>
            {editable && canManage && (
              <button
                onClick={() => {
                  setCategoryUploadTarget(cat.key);
                  setTimeout(() => categoryUploadRef.current?.click(), 50);
                }}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                title={`Añadir foto a ${cat.label}`}
              >
                <Plus className="h-3 w-3" />
                Añadir
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {catPhotos.map(photo => {
              const url = signedUrls[photo.storage_path];
              const isFailed = failedPaths.has(photo.storage_path) || !url;

              if (isFailed) {
                // Show "missing photo" placeholder with upload option
                return (
                  <div key={photo.id} className="relative group">
                    <div className="rounded-xl overflow-hidden border-2 border-dashed border-amber-400/60 w-full">
                      <div className="w-full aspect-square bg-amber-50/50 dark:bg-amber-950/20 flex flex-col items-center justify-center gap-1.5 p-2">
                        <Camera className="h-6 w-6 text-amber-500/60" />
                        <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 text-center leading-tight">
                          No disponible
                        </span>
                        {canManage && (
                          <button
                            onClick={() => {
                              setReplaceTarget({ photoId: photo.id, storagePath: photo.storage_path });
                              setTimeout(() => replaceInputRef.current?.click(), 50);
                            }}
                            disabled={replacePhoto.isPending}
                            className="mt-1 flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-lg px-2 py-1 transition-all"
                          >
                            {replacePhoto.isPending && replaceTarget?.photoId === photo.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Upload className="h-3 w-3" />
                            }
                            Subir foto
                          </button>
                        )}
                      </div>
                    </div>
                    {editable && canManage && (
                      <button
                        onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        title="Eliminar registro"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              }

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
                      onError={() => handleImageError(photo.storage_path)}
                    />
                  </button>
                  {editable && canManage && (
                    <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setReplaceTarget({ photoId: photo.id, storagePath: photo.storage_path });
                          setTimeout(() => replaceInputRef.current?.click(), 50);
                        }}
                        className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
                        title="Reemplazar foto"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                        className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                        title="Eliminar foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <AppLayout title={`Inspección — ${vehicle?.matricula || ''}`}>
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <Button variant="ghost" onClick={() => navigate(`/fleet/${id}`)} className="rounded-xl -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {vehicle?.matricula || 'Volver'}
        </Button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4 relative"
        >
          {/* Action buttons */}
          <div className="absolute top-4 right-0 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/fleet/${id}/inspection/${inspId}/edit`)}
              className="rounded-xl"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar inspección?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán todos los datos, fotos y daños asociados. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      await deleteInspection.mutateAsync({ inspectionId: inspId!, vehicleId: id! });
                      navigate(`/fleet/${id}`);
                    }}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
            inspection.inspection_type === 'recogida' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
          }`}>
            <Camera className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {inspection.inspection_type === 'recogida' ? 'Recogida' : 'Devolución'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(inspection.inspection_date), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card border border-border/50 shadow-sm divide-y divide-border/50"
        >
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center"><Gauge className="h-4 w-4 text-muted-foreground" /></div>
            <span className="text-sm text-muted-foreground flex-1">Kilómetros</span>
            <span className="text-sm font-medium text-foreground">{inspection.km != null ? `${inspection.km.toLocaleString()} km` : '—'}</span>
          </div>
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center"><Fuel className="h-4 w-4 text-muted-foreground" /></div>
            <span className="text-sm text-muted-foreground flex-1">Combustible</span>
            <span className="text-sm font-medium text-foreground">{inspection.nivel_combustible || '—'}</span>
          </div>
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
            <span className="text-sm text-muted-foreground flex-1">Inspector</span>
            <span className="text-sm font-medium text-foreground">{inspection.inspector_profile?.name || '—'}</span>
          </div>
          {inspection.notas && (
            <div className="px-4 py-3">
              <p className="text-sm text-foreground">{inspection.notas}</p>
            </div>
          )}
        </motion.div>

        {/* Segmented Control for Photos */}
        {counterpart && counterpart.photos && counterpart.photos.length > 0 && (
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'current' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              {inspection.inspection_type === 'recogida' ? 'Recogida' : 'Devolución'}
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'compare' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              {counterpart.inspection_type === 'recogida' ? 'Recogida' : 'Devolución'}
            </button>
          </div>
        )}

        {/* Photos */}
        <AnimatePresence mode="wait">
          {activeTab === 'current' && (
            <motion.div
              key="current"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Header with upload controls */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Fotos ({inspection.photos?.length || 0})
                </h3>
                {canManage && (
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
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Añadir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1"
                      onClick={() => multiPhotoInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Images className="h-3 w-3" />
                      Varias
                    </Button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAddPhoto}
                    />
                    <input
                      ref={multiPhotoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleMultiPhotoUpload}
                    />
                  </div>
                )}
              </div>

              {/* Drag & drop overlay */}
              {isDragging && canManage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-8 text-center"
                >
                  <ImagePlus className="h-10 w-10 mx-auto mb-2 text-primary/60" />
                  <p className="text-sm font-medium text-primary">Suelta las fotos aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se añadirán a la categoría: {PHOTO_CATEGORIES.find(c => c.key === addPhotoCategory)?.label || addPhotoCategory}
                  </p>
                </motion.div>
              )}

              {/* Photo grid */}
              {!isDragging && inspection.photos && inspection.photos.length > 0
                ? renderPhotos(inspection.photos, true)
                : !isDragging && (
                  <div className="text-center py-10 rounded-2xl bg-card border border-border/50">
                    <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Sin fotos en esta inspección</p>
                    {canManage && (
                      <div className="flex flex-col items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs gap-1"
                          onClick={() => photoInputRef.current?.click()}
                        >
                          <Plus className="h-3 w-3" />
                          Añadir primera foto
                        </Button>
                        <p className="text-xs text-muted-foreground">o arrastra imágenes aquí</p>
                      </div>
                    )}
                  </div>
                )}

              {/* Missing categories section */}
              {!isDragging && canManage && missingCategories.length > 0 && inspection.photos && inspection.photos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                    <ImagePlus className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Categorías sin fotos ({missingCategories.length})
                    </h4>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {missingCategories.map(catKey => {
                        const catLabel = PHOTO_CATEGORIES.find(c => c.key === catKey)?.label || catKey;
                        return (
                          <button
                            key={catKey}
                            onClick={() => {
                              setCategoryUploadTarget(catKey as PhotoCategory);
                              setTimeout(() => categoryUploadRef.current?.click(), 50);
                            }}
                            disabled={isUploading}
                            className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 p-3 transition-all group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0">
                              <Camera className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                            </div>
                            <div className="text-left min-w-0">
                              <p className="text-xs font-medium text-foreground/80 truncate">{catLabel}</p>
                              <p className="text-[10px] text-muted-foreground">Subir foto</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
          {activeTab === 'compare' && counterpart?.photos && (
            <motion.div
              key="compare"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Fotos — {counterpart.inspection_type === 'recogida' ? 'Recogida' : 'Devolución'}
                <span className="ml-2 normal-case font-normal">
                  ({format(new Date(counterpart.inspection_date), 'dd MMM yyyy', { locale: es })})
                </span>
              </h3>
              {renderPhotos(counterpart.photos)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receipt / Justificante */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Justificante</h3>
            </div>
            {canManage && inspection.receipt_url && (
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
                  <img
                    src={receiptUrl}
                    alt="Justificante"
                    className="w-full aspect-[4/3] object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const placeholder = document.createElement('div');
                      placeholder.className = 'w-full aspect-[4/3] bg-muted/50 flex flex-col items-center justify-center gap-1';
                      placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-xs text-muted-foreground/60">No disponible</span>';
                      target.parentElement?.appendChild(placeholder);
                    }}
                  />
                </button>
              )
            ) : (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-3">Sin justificante</p>
                {canManage && (
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
                )}
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
        </motion.div>

        {/* Damages */}
        {inspection.damages && inspection.damages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Daños ({inspection.damages.length})
            </h3>
            <div className="space-y-2">
              {inspection.damages.map(d => {
                const sev = severityConfig(d.severidad);
                return (
                  <div key={d.id} className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 shadow-sm p-4">
                    <div className={`w-1.5 h-full min-h-[2rem] rounded-full ${sev.color} shrink-0 self-stretch`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {DAMAGE_ZONES.find(z => z.key === d.zona)?.label || d.zona}
                        </span>
                        {d.pieza && <span className="text-xs text-muted-foreground">· {d.pieza}</span>}
                      </div>
                      {d.descripcion && <p className="text-sm text-muted-foreground mt-0.5">{d.descripcion}</p>}
                    </div>
                    <span className={`text-xs font-medium ${sev.textColor} shrink-0`}>
                      {sev.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Hidden inputs for replace and category upload */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplacePhoto}
      />
      <input
        ref={categoryUploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleCategoryUpload}
      />

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
