import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VehicleWithTasks } from '@/types/vehicles';
import {
  AUDIT_CHECKLIST,
  CHECKLIST_CATEGORIES,
  ChecklistResult,
  ChecklistItemResult,
  VehicleAuditPhoto,
  isChecklistComplete,
  hasDefects,
  calculateAuditScore,
} from '@/types/audits';
import { useVehicleAudits } from '@/hooks/useVehicleAudits';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Car,
  Armchair,
  Wrench,
  FileText,
  CheckCircle2,
  XCircle,
  Circle,
  ShieldCheck,
  ShieldX,
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  History,
  Camera,
  ImagePlus,
  X,
  ZoomIn,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  exterior: Car,
  interior: Armchair,
  mecanica: Wrench,
  documentacion: FileText,
};

// ── Editable Caption Component ──
function EditableCaption({
  photo,
  onSave,
  isEditable,
}: {
  photo: VehicleAuditPhoto;
  onSave: (photoId: string, caption: string) => Promise<void>;
  isEditable: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(photo.caption || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync value when photo data changes externally
  useEffect(() => {
    if (!isEditing) {
      setValue(photo.caption || '');
    }
  }, [photo.caption, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    // Only save if actually changed
    if (trimmed === (photo.caption || '')) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(photo.id, trimmed);
      setIsEditing(false);
    } catch {
      // Error handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setValue(photo.caption || '');
      setIsEditing(false);
    }
  };

  // Read-only mode
  if (!isEditable) {
    if (!photo.caption) return null;
    return (
      <p className="text-[11px] text-muted-foreground leading-tight mt-1 max-w-[80px] truncate" title={photo.caption}>
        {photo.caption}
      </p>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="flex items-center gap-0.5 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="Descripción..."
          maxLength={120}
          disabled={isSaving}
          className="w-[72px] text-[10px] px-1 py-0.5 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        {isSaving && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />}
      </div>
    );
  }

  // Display mode with edit trigger
  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-0.5 mt-1 group/caption max-w-[80px]"
      title={photo.caption || 'Añadir descripción'}
    >
      {photo.caption ? (
        <span className="text-[11px] text-muted-foreground leading-tight truncate group-hover/caption:text-foreground transition-colors">
          {photo.caption}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground/50 group-hover/caption:text-muted-foreground transition-colors flex items-center gap-0.5">
          <Pencil className="h-2.5 w-2.5" />
          Describir
        </span>
      )}
    </button>
  );
}

// ── Photo Lightbox Component ──
function PhotoLightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: VehicleAuditPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const photo = photos[index];

  const handlePrev = () => setIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  const handleNext = () => setIndex((i) => (i < photos.length - 1 ? i + 1 : 0));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.photo_url}
          alt={photo.caption || 'Foto de auditoría'}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
        {photo.caption && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
            <p className="text-white text-sm">{photo.caption}</p>
          </div>
        )}
        {/* Navigation */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
              {index + 1} / {photos.length}
            </div>
          </>
        )}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Photo Thumbnail Grid with Editable Captions ──
function PhotoThumbnailGrid({
  photos,
  onDelete,
  onUpdateCaption,
  isDeletingPhoto,
  isEditable,
}: {
  photos: VehicleAuditPhoto[];
  onDelete?: (photoId: string, photoUrl: string) => void;
  onUpdateCaption?: (photoId: string, caption: string) => Promise<void>;
  isDeletingPhoto?: boolean;
  isEditable: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {photos.map((photo, idx) => (
          <div key={photo.id} className="flex flex-col items-center">
            <div className="relative group">
              <button
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <img
                  src={photo.photo_url}
                  alt={photo.caption || 'Foto'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              {isEditable && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(photo.id, photo.photo_url)}
                  disabled={isDeletingPhoto}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {/* Editable caption below the thumbnail */}
            {onUpdateCaption ? (
              <EditableCaption
                photo={photo}
                onSave={onUpdateCaption}
                isEditable={isEditable}
              />
            ) : (
              photo.caption && (
                <p className="text-[11px] text-muted-foreground leading-tight mt-1 max-w-[80px] truncate" title={photo.caption}>
                  {photo.caption}
                </p>
              )
            )}
          </div>
        ))}
      </div>
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

// ── Photo Upload Section for a Checklist Item ──
function ChecklistItemPhotoSection({
  itemKey,
  itemLabel,
  auditId,
  photos,
  onUpload,
  onDelete,
  onUpdateCaption,
  isUploading,
  isDeletingPhoto,
  isEditable,
}: {
  itemKey: string;
  itemLabel: string;
  auditId: string;
  photos: VehicleAuditPhoto[];
  onUpload: (auditId: string, file: File, checklistItemKey: string) => Promise<void>;
  onDelete: (photoId: string, photoUrl: string) => void;
  onUpdateCaption: (photoId: string, caption: string) => Promise<void>;
  isUploading: boolean;
  isDeletingPhoto: boolean;
  isEditable: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          await onUpload(auditId, file, itemKey);
        }
      } catch {
        // Error handled in hook
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [auditId, itemKey, onUpload],
  );

  const itemPhotos = photos.filter((p) => p.checklist_item_key === itemKey);

  if (!isEditable && itemPhotos.length === 0) return null;

  return (
    <div className="mt-1.5 pl-1">
      {itemPhotos.length > 0 && (
        <PhotoThumbnailGrid
          photos={itemPhotos}
          onDelete={onDelete}
          onUpdateCaption={onUpdateCaption}
          isDeletingPhoto={isDeletingPhoto}
          isEditable={isEditable}
        />
      )}
      {isEditable && (
        <div className="mt-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isUploading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
            {uploading ? 'Subiendo...' : 'Añadir foto'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── General Photos Section (not linked to specific item) ──
function GeneralPhotosSection({
  auditId,
  photos,
  onUpload,
  onDelete,
  onUpdateCaption,
  isUploading,
  isDeletingPhoto,
  isEditable,
}: {
  auditId: string;
  photos: VehicleAuditPhoto[];
  onUpload: (auditId: string, file: File, checklistItemKey: string | null) => Promise<void>;
  onDelete: (photoId: string, photoUrl: string) => void;
  onUpdateCaption: (photoId: string, caption: string) => Promise<void>;
  isUploading: boolean;
  isDeletingPhoto: boolean;
  isEditable: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          await onUpload(auditId, file, null);
        }
      } catch {
        // Error handled in hook
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [auditId, onUpload],
  );

  const generalPhotos = photos.filter((p) => !p.checklist_item_key);

  if (!isEditable && generalPhotos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ImagePlus className="h-4 w-4 text-muted-foreground" />
        <span>Fotos generales</span>
        {generalPhotos.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {generalPhotos.length}
          </Badge>
        )}
      </div>
      {generalPhotos.length > 0 && (
        <PhotoThumbnailGrid
          photos={generalPhotos}
          onDelete={onDelete}
          onUpdateCaption={onUpdateCaption}
          isDeletingPhoto={isDeletingPhoto}
          isEditable={isEditable}
        />
      )}
      {isEditable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isUploading}
            className="w-full h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Camera className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {uploading ? 'Subiendo fotos...' : 'Añadir fotos del vehículo'}
            </span>
          </button>
        </>
      )}
    </div>
  );
}

// ── Main Dialog ──
interface VehicleAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleWithTasks | null;
}

export function VehicleAuditDialog({ open, onOpenChange, vehicle }: VehicleAuditDialogProps) {
  const {
    latestAudit,
    isLoadingLatestAudit,
    auditHistory,
    auditPhotos,
    isLoadingPhotos,
    createAudit,
    isCreatingAudit,
    updateChecklistItem,
    completeAudit,
    isCompletingAudit,
    uploadPhoto,
    isUploadingPhoto,
    deletePhoto,
    isDeletingPhoto,
    updatePhotoCaption,
    isUpdatingCaption,
  } = useVehicleAudits(vehicle?.id);

  const [localResults, setLocalResults] = useState<Record<string, ChecklistResult>>({});
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Sync local state with latest audit data
  useEffect(() => {
    if (latestAudit?.status === 'in_progress' && latestAudit.checklist_results) {
      setLocalResults(latestAudit.checklist_results as Record<string, ChecklistResult>);
      setNotes(latestAudit.notes || '');
    }
  }, [latestAudit]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowHistory(false);
      setShowRejectForm(false);
      setRejectionReason('');
    }
  }, [open]);

  const activeAudit = latestAudit?.status === 'in_progress' ? latestAudit : null;
  const lastCompletedAudit = latestAudit?.status !== 'in_progress' ? latestAudit : null;

  const checkedCount = useMemo(() => {
    return Object.values(localResults).filter((r) => r.result !== 'not_checked').length;
  }, [localResults]);

  const approvedCount = useMemo(() => {
    return Object.values(localResults).filter((r) => r.result === 'approved').length;
  }, [localResults]);

  const defectCount = useMemo(() => {
    return Object.values(localResults).filter((r) => r.result === 'defect').length;
  }, [localResults]);

  const progressPercent = (checkedCount / AUDIT_CHECKLIST.length) * 100;
  const score = calculateAuditScore(localResults);
  const complete = isChecklistComplete(localResults);

  const handleToggleItem = (key: string, result: ChecklistItemResult) => {
    if (!activeAudit) return;

    const currentResult = localResults[key];
    // Toggle: if same result, go back to not_checked
    const newResult: ChecklistItemResult = currentResult?.result === result ? 'not_checked' : result;

    const updatedResults = {
      ...localResults,
      [key]: { key, result: newResult, notes: currentResult?.notes },
    };

    setLocalResults(updatedResults);

    // Debounce save to DB
    updateChecklistItem({
      auditId: activeAudit.id,
      checklistResults: updatedResults,
    });
  };

  const handleStartAudit = () => {
    if (!vehicle) return;
    createAudit({ vehicleId: vehicle.id });
  };

  const handleUploadPhoto = useCallback(
    async (auditId: string, file: File, checklistItemKey: string | null) => {
      await uploadPhoto({
        auditId,
        file,
        checklistItemKey,
      });
    },
    [uploadPhoto],
  );

  const handleDeletePhoto = useCallback(
    (photoId: string, photoUrl: string) => {
      deletePhoto({ photoId, photoUrl });
    },
    [deletePhoto],
  );

  const handleUpdateCaption = useCallback(
    async (photoId: string, caption: string) => {
      await updatePhotoCaption({ photoId, caption });
    },
    [updatePhotoCaption],
  );

  const handleApprove = () => {
    if (!activeAudit) return;
    completeAudit({
      auditId: activeAudit.id,
      status: 'approved',
      notes,
      checklistResults: localResults,
    });
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!activeAudit || !rejectionReason.trim()) return;
    completeAudit({
      auditId: activeAudit.id,
      status: 'rejected',
      rejectionReason: rejectionReason.trim(),
      notes,
      checklistResults: localResults,
    });
    onOpenChange(false);
  };

  // Get photos count for a specific checklist item
  const getItemPhotoCount = (itemKey: string) => {
    return auditPhotos.filter((p) => p.checklist_item_key === itemKey).length;
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                Auditoría de Calidad — {vehicle.matricula}
              </DialogTitle>
              <DialogDescription>
                {vehicle.modelo || 'Sin modelo'} · {vehicle.categoria || 'Sin categoría'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* ── Loading State ── */}
          {isLoadingLatestAudit && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* ── No Active Audit: Show start button or last result ── */}
          {!isLoadingLatestAudit && !activeAudit && !showHistory && (
            <div className="space-y-4 py-4">
              {/* Last audit result */}
              {lastCompletedAudit && (
                <div
                  className={`rounded-lg border p-4 ${
                    lastCompletedAudit.status === 'approved'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {lastCompletedAudit.status === 'approved' ? (
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold text-sm">
                      Última auditoría:{' '}
                      {lastCompletedAudit.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </span>
                    <Badge
                      variant={
                        lastCompletedAudit.status === 'approved' ? 'default' : 'destructive'
                      }
                      className="ml-auto"
                    >
                      {lastCompletedAudit.overall_score}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastCompletedAudit.auditor_profile?.name || 'Auditor desconocido'} ·{' '}
                    {lastCompletedAudit.completed_at
                      ? format(new Date(lastCompletedAudit.completed_at), 'd MMM yyyy, HH:mm', {
                          locale: es,
                        })
                      : 'Sin fecha'}
                  </p>
                  {lastCompletedAudit.status === 'rejected' &&
                    lastCompletedAudit.rejection_reason && (
                      <p className="text-xs text-red-700 mt-2">
                        <strong>Motivo:</strong> {lastCompletedAudit.rejection_reason}
                      </p>
                    )}

                  {/* Show photos from completed audit */}
                  {auditPhotos.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-current/10">
                      <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                        <Camera className="h-3 w-3" />
                        {auditPhotos.length} foto{auditPhotos.length !== 1 ? 's' : ''} adjunta
                        {auditPhotos.length !== 1 ? 's' : ''}
                      </p>
                      <PhotoThumbnailGrid
                        photos={auditPhotos}
                        isEditable={false}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Start new audit */}
              <div className="text-center py-6">
                <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="font-semibold mb-1">
                  {vehicle.status === 'limpio'
                    ? 'Vehículo listo para auditar'
                    : 'Iniciar auditoría de calidad'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Revisa el checklist de 13 puntos para verificar la preparación del vehículo.
                </p>
                <Button
                  onClick={handleStartAudit}
                  disabled={isCreatingAudit}
                  className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90"
                >
                  {isCreatingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                  )}
                  Iniciar Auditoría
                </Button>
              </div>

              {/* History button */}
              {auditHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowHistory(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Ver historial ({auditHistory.length} auditorías)
                </Button>
              )}
            </div>
          )}

          {/* ── History View ── */}
          {showHistory && (
            <div className="space-y-3 py-4">
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                ← Volver
              </Button>
              <h3 className="font-semibold text-sm">Historial de Auditorías</h3>
              {auditHistory.map((audit) => (
                <div key={audit.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {audit.status === 'approved' ? (
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                    ) : audit.status === 'rejected' ? (
                      <ShieldX className="h-4 w-4 text-red-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {audit.status === 'approved'
                        ? 'Aprobada'
                        : audit.status === 'rejected'
                          ? 'Rechazada'
                          : 'En progreso'}
                    </span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {audit.overall_score}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {audit.auditor_profile?.name || 'Desconocido'} ·{' '}
                    {format(new Date(audit.created_at), 'd MMM yyyy, HH:mm', { locale: es })}
                  </p>
                  {audit.rejection_reason && (
                    <p className="text-xs text-red-600">Motivo: {audit.rejection_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Active Audit: Checklist ── */}
          {activeAudit && !showHistory && (
            <div className="space-y-4 py-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso del checklist</span>
                  <span className="font-medium">
                    {checkedCount}/{AUDIT_CHECKLIST.length}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> {approvedCount} aprobados
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3 w-3" /> {defectCount} defectos
                  </span>
                  {auditPhotos.length > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Camera className="h-3 w-3" /> {auditPhotos.length} fotos
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Checklist by category */}
              {CHECKLIST_CATEGORIES.map((category) => {
                const CategoryIcon = CATEGORY_ICONS[category.key] || FileText;
                const items = AUDIT_CHECKLIST.filter((i) => i.category === category.key);

                return (
                  <div key={category.key} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <CategoryIcon className="h-4 w-4" />
                      {category.label}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const result = localResults[item.key];
                        const status = result?.result || 'not_checked';
                        const photoCount = getItemPhotoCount(item.key);

                        return (
                          <div key={item.key}>
                            <div
                              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                                status === 'approved'
                                  ? 'bg-green-50 border-green-200'
                                  : status === 'defect'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-background hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{item.label}</span>
                                {photoCount > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 h-4"
                                  >
                                    <Camera className="h-2.5 w-2.5 mr-0.5" />
                                    {photoCount}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 rounded-full ${
                                    status === 'approved'
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'text-muted-foreground hover:text-green-600 hover:bg-green-50'
                                  }`}
                                  onClick={() => handleToggleItem(item.key, 'approved')}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 rounded-full ${
                                    status === 'defect'
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                      : 'text-muted-foreground hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  onClick={() => handleToggleItem(item.key, 'defect')}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {/* Photo section for defect items */}
                            {status === 'defect' && (
                              <ChecklistItemPhotoSection
                                itemKey={item.key}
                                itemLabel={item.label}
                                auditId={activeAudit.id}
                                photos={auditPhotos}
                                onUpload={handleUploadPhoto}
                                onDelete={handleDeletePhoto}
                                onUpdateCaption={handleUpdateCaption}
                                isUploading={isUploadingPhoto}
                                isDeletingPhoto={isDeletingPhoto}
                                isEditable={true}
                              />
                            )}
                            {/* Show photos for approved items too (read-only thumbnails but editable captions) */}
                            {status === 'approved' && getItemPhotoCount(item.key) > 0 && (
                              <ChecklistItemPhotoSection
                                itemKey={item.key}
                                itemLabel={item.label}
                                auditId={activeAudit.id}
                                photos={auditPhotos}
                                onUpload={handleUploadPhoto}
                                onDelete={handleDeletePhoto}
                                onUpdateCaption={handleUpdateCaption}
                                isUploading={isUploadingPhoto}
                                isDeletingPhoto={isDeletingPhoto}
                                isEditable={true}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <Separator />

              {/* General photos section */}
              <GeneralPhotosSection
                auditId={activeAudit.id}
                photos={auditPhotos}
                onUpload={handleUploadPhoto}
                onDelete={handleDeletePhoto}
                onUpdateCaption={handleUpdateCaption}
                isUploading={isUploadingPhoto}
                isDeletingPhoto={isDeletingPhoto}
                isEditable={true}
              />

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Observaciones generales</label>
                <Textarea
                  placeholder="Notas adicionales sobre el estado del vehículo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Rejection reason form */}
              {showRejectForm && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Motivo del rechazo
                  </div>
                  <Textarea
                    placeholder="Describe por qué se rechaza la preparación..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                    className="border-red-200"
                  />
                  <p className="text-xs text-red-600">
                    El vehículo volverá a estado &quot;Sucio&quot; para re-preparación.
                  </p>
                </div>
              )}

              {/* Score preview */}
              {complete && (
                <div
                  className={`rounded-lg border p-3 text-center ${
                    !hasDefects(localResults)
                      ? 'bg-green-50 border-green-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <span className="text-2xl font-bold">{score}%</span>
                  <p className="text-xs text-muted-foreground mt-1">Puntuación de calidad</p>
                  {auditPhotos.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      {auditPhotos.length} foto{auditPhotos.length !== 1 ? 's' : ''} adjunta
                      {auditPhotos.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer Actions ── */}
        {activeAudit && !showHistory && (
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {!showRejectForm ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!complete || isCompletingAudit}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <ShieldX className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={!complete || hasDefects(localResults) || isCompletingAudit}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isCompletingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Aprobar
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setShowRejectForm(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || isCompletingAudit}
                >
                  {isCompletingAudit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldX className="h-4 w-4 mr-2" />
                  )}
                  Confirmar Rechazo
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
