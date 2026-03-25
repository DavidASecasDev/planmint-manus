import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Camera, CheckCircle, XCircle, Trash2, User, FileText, Truck, Package, Car, Sparkles, Pencil, Upload, Eye, X, FileUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PlateCamera } from '@/components/movements/PlateCamera';
import { useMovements, ocrPlate, uploadMovementPhoto, uploadMovementFile, VehicleMovement, MovementType } from '@/hooks/useMovements';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TYPE_CONFIG: Record<MovementType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  entrega: { label: 'Entrega', icon: Truck, color: 'text-primary', bgColor: 'bg-primary/10' },
  recogida: { label: 'Recogida', icon: Package, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  escoba: { label: 'Escoba', icon: Car, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  limpieza: { label: 'Limpieza', icon: Sparkles, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500/10' },
};

const STATUS_LABELS = { en_curso: 'En curso', completado: 'Completado', cancelado: 'Cancelado' } as const;

export default function MovementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { endMovement, cancelMovement, deleteMovement, updateMovement } = useMovements();
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const canManage = !permLoading && hasPermission('movements.manage');
  const canEditPhotos = !permLoading && hasPermission('movements.edit_photos');
  const canUploadReceipt = !permLoading && hasPermission('movements.upload_receipt');

  const [showEndCamera, setShowEndCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [endGps, setEndGps] = useState<{ lat: number; lng: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<'start' | 'end' | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const startPhotoRef = useRef<HTMLInputElement>(null);
  const endPhotoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  const { data: movement, isLoading } = useQuery({
    queryKey: ['vehicle-movement', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_movements')
        .select('*, driver:profiles!vehicle_movements_driver_id_fkey(id, name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as VehicleMovement;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setEndGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const handleEndCapture = async (base64: string) => {
    if (!movement || !profile?.organization_id) return;
    setIsProcessing(true);
    try {
      // OCR is best-effort: if it fails, we still close the movement
      try {
        const ocrResult = await ocrPlate(base64);
        if (ocrResult.success && ocrResult.plate !== movement.matricula) {
          toast({ title: 'Matrícula diferente', description: `Se detectó ${ocrResult.plate} pero el movimiento es de ${movement.matricula}. Se finalizará igualmente.`, variant: 'destructive' });
        }
      } catch (ocrErr) {
        console.warn('[OCR] Plate recognition failed, continuing with movement close:', ocrErr);
      }
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
      const byteArray = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const photoUrl = await uploadMovementPhoto(blob, profile.organization_id);
      await endMovement.mutateAsync({ id: movement.id, end_photo_url: photoUrl, end_lat: endGps?.lat, end_lng: endGps?.lng });
      navigate('/movements');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setShowEndCamera(false);
    }
  };

  const handleCancel = async () => {
    if (!movement) return;
    await cancelMovement.mutateAsync(movement.id);
    navigate('/movements');
  };

  const handleReplacePhoto = async (type: 'start' | 'end', file: File) => {
    if (!movement || !profile?.organization_id) return;
    setIsUploadingPhoto(type);
    try {
      const url = await uploadMovementFile(file, profile.organization_id);
      const updateField = type === 'start' ? { start_photo_url: url } : { end_photo_url: url };
      await updateMovement.mutateAsync({ id: movement.id, ...updateField });
      queryClient.invalidateQueries({ queryKey: ['vehicle-movement', id] });
      toast({ title: 'Foto actualizada' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingPhoto(null);
    }
  };

  const handleUploadReceipt = async (file: File) => {
    if (!movement || !profile?.organization_id) return;
    setIsUploadingReceipt(true);
    try {
      const url = await uploadMovementFile(file, profile.organization_id);
      await updateMovement.mutateAsync({ id: movement.id, receipt_url: url });
      queryClient.invalidateQueries({ queryKey: ['vehicle-movement', id] });
      toast({ title: 'Justificante subido' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleRemoveReceipt = async () => {
    if (!movement) return;
    setIsUploadingReceipt(true);
    try {
      await updateMovement.mutateAsync({ id: movement.id, receipt_url: null });
      queryClient.invalidateQueries({ queryKey: ['vehicle-movement', id] });
      toast({ title: 'Justificante eliminado' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const movementDetailSkeleton = (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md shrink-0" />
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Details card */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 pb-3">
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="px-6 pb-6 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 py-3" style={{ opacity: 1 - i * 0.15 }}>
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Photos section */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 pb-3">
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="aspect-video w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="aspect-video w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Notes section */}
      <div className="rounded-lg border bg-card p-6 space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );

  if (!movement) {
    return (
      <AppLayout title="Movimiento">
        <div className="text-center text-muted-foreground py-12">Movimiento no encontrado.</div>
      </AppLayout>
    );
  }

  const typeConf = TYPE_CONFIG[movement.movement_type];
  const TypeIcon = typeConf.icon;
  const isPdf = movement.receipt_url?.toLowerCase().endsWith('.pdf');

  return (
    <AppLayout title="Detalle Movimiento">
      <SkeletonTransition isLoading={isLoading} skeleton={movementDetailSkeleton}>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/movements')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', typeConf.bgColor)}>
            <TypeIcon className={cn('h-6 w-6', typeConf.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-mono tracking-wider text-foreground">{movement.matricula}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline">{typeConf.label}</Badge>
              <Badge variant={movement.status === 'en_curso' ? 'default' : movement.status === 'completado' ? 'secondary' : 'destructive'}>
                {STATUS_LABELS[movement.status]}
              </Badge>
            </div>
          </div>
          {canManage && (
            <Button variant="outline" size="icon" onClick={() => setEditOpen(true)} className="shrink-0">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <DetailRow icon={Clock} iconClass="text-primary" label="Inicio" value={format(new Date(movement.started_at), "dd MMM yyyy · HH:mm", { locale: es })} />
            
            {movement.ended_at && (
              <>
                <Separator />
                <DetailRow icon={CheckCircle} iconClass="text-emerald-600 dark:text-emerald-400" label="Fin" value={format(new Date(movement.ended_at), "dd MMM yyyy · HH:mm", { locale: es })} />
              </>
            )}

            {movement.driver?.name && (
              <>
                <Separator />
                <DetailRow icon={User} iconClass="text-muted-foreground" label="Conductor" value={movement.driver.name} />
              </>
            )}

            {movement.start_lat && movement.start_lng && (
              <>
                <Separator />
                <DetailRow icon={MapPin} iconClass="text-primary" label="Ubicación inicio" value={`${movement.start_lat.toFixed(5)}, ${movement.start_lng.toFixed(5)}`} />
              </>
            )}

            {movement.end_lat && movement.end_lng && (
              <>
                <Separator />
                <DetailRow icon={MapPin} iconClass="text-emerald-600 dark:text-emerald-400" label="Ubicación fin" value={`${movement.end_lat.toFixed(5)}, ${movement.end_lng.toFixed(5)}`} />
              </>
            )}

            {movement.notes && (
              <>
                <Separator />
                <DetailRow icon={FileText} iconClass="text-muted-foreground" label="Notas" value={movement.notes} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        {(movement.start_photo_url || movement.end_photo_url) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fotos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {movement.start_photo_url && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Inicio</p>
                  <div className="relative group aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                    <img src={movement.start_photo_url} alt="Inicio" className="w-full h-full object-cover" />
                    {canEditPhotos && (
                      <button
                        onClick={() => startPhotoRef.current?.click()}
                        disabled={isUploadingPhoto === 'start'}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        {isUploadingPhoto === 'start' ? (
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Camera className="h-5 w-5 text-white" />
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={startPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReplacePhoto('start', file);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
              {movement.end_photo_url && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Fin</p>
                  <div className="relative group aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                    <img src={movement.end_photo_url} alt="Fin" className="w-full h-full object-cover" />
                    {canEditPhotos && (
                      <button
                        onClick={() => endPhotoRef.current?.click()}
                        disabled={isUploadingPhoto === 'end'}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        {isUploadingPhoto === 'end' ? (
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Camera className="h-5 w-5 text-white" />
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={endPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReplacePhoto('end', file);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Receipt / Justificante */}
        {canUploadReceipt && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                Justificante
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movement.receipt_url ? (
                <div className="space-y-3">
                  {isPdf ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <FileText className="h-8 w-8 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">Justificante.pdf</p>
                        <p className="text-xs text-muted-foreground">Documento PDF</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={movement.receipt_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                      <a href={movement.receipt_url} target="_blank" rel="noopener noreferrer">
                        <img src={movement.receipt_url} alt="Justificante" className="w-full h-full object-cover" />
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => receiptRef.current?.click()}
                      disabled={isUploadingReceipt}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> Reemplazar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/30">
                          <X className="h-3.5 w-3.5 mr-1" /> Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar justificante?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminará el justificante de este movimiento.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemoveReceipt}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => receiptRef.current?.click()}
                  disabled={isUploadingReceipt}
                >
                  {isUploadingReceipt ? (
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Subir justificante
                </Button>
              )}
              <input
                ref={receiptRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadReceipt(file);
                  e.target.value = '';
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {movement.status === 'en_curso' && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {showEndCamera ? (
                <PlateCamera onCapture={handleEndCapture} isProcessing={isProcessing} />
              ) : (
                <Button onClick={() => setShowEndCamera(true)} className="w-full" size="lg">
                  <Camera className="h-4 w-4 mr-2" />
                  Finalizar movimiento
                </Button>
              )}
              <Button variant="outline" onClick={handleCancel} className="w-full text-destructive hover:bg-destructive/10 border-destructive/30">
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar movimiento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete */}
        <PermissionGate permission="movements.delete" showLoading={false}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar movimiento
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará permanentemente el movimiento de {movement.matricula}. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    await deleteMovement.mutateAsync(movement.id);
                    navigate('/movements');
                  }}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PermissionGate>

        {/* Edit Dialog */}
        {movement && (
          <EditMovementDialog
            movement={movement}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSave={async (updates) => {
              await updateMovement.mutateAsync({ id: movement.id, ...updates });
              queryClient.invalidateQueries({ queryKey: ['vehicle-movement', id] });
              setEditOpen(false);
            }}
            isSaving={updateMovement.isPending}
          />
        )}
      </div>
      </SkeletonTransition>
    </AppLayout>
  );
}

function DetailRow({ icon: Icon, iconClass, label, value }: { icon: React.ElementType; iconClass: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <Icon className={cn('h-4 w-4', iconClass)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function EditMovementDialog({ movement, open, onOpenChange, onSave, isSaving }: {
  movement: VehicleMovement;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (updates: { matricula?: string; movement_type?: MovementType; notes?: string | null }) => Promise<void>;
  isSaving: boolean;
}) {
  const [matricula, setMatricula] = useState(movement.matricula);
  const [movementType, setMovementType] = useState<MovementType>(movement.movement_type);
  const [notes, setNotes] = useState(movement.notes || '');

  useEffect(() => {
    if (open) {
      setMatricula(movement.matricula);
      setMovementType(movement.movement_type);
      setNotes(movement.notes || '');
    }
  }, [open, movement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      matricula: matricula.trim().toUpperCase(),
      movement_type: movementType,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-matricula">Matrícula</Label>
            <Input
              id="edit-matricula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="font-mono uppercase"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-type">Tipo</Label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as MovementType)}>
              <SelectTrigger id="edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrega">Entrega</SelectItem>
                <SelectItem value="recogida">Recogida</SelectItem>
                <SelectItem value="escoba">Escoba</SelectItem>
                <SelectItem value="limpieza">Limpieza</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notas</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !matricula.trim()}>
              {isSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
