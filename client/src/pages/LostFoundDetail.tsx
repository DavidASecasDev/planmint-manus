import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  Camera,
  X,
  ExternalLink,
  Calendar,
  MapPin,
  User,
  Car,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useLostFound,
  useLostFoundItem,
  LOST_FOUND_STATUS_META,
  LOST_FOUND_CATEGORY_META,
  type LostFoundStatus,
  type UpdateLostFoundInput,
} from '@/hooks/useLostFound';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function LostFoundDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = usePermissions();
  const { updateItem, deleteItem, uploadPhoto, deletePhoto } = useLostFound();
  const { data: item, isLoading, refetch } = useLostFoundItem(id || '');

  const [isUploading, setIsUploading] = useState(false);
  const [returnedTo, setReturnedTo] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const canUpdate = hasPermission('lost_found.update') || isAdmin;
  const canDelete = isAdmin;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Objeto no encontrado</p>
        <Button variant="link" onClick={() => navigate('/lost-found')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const statusMeta = LOST_FOUND_STATUS_META[item.status];
  const categoryMeta = LOST_FOUND_CATEGORY_META[item.category];

  const handleStatusChange = async (newStatus: LostFoundStatus) => {
    const updates: UpdateLostFoundInput = { id: item.id, status: newStatus };
    if (newStatus === 'returned') {
      updates.returned_date = new Date().toISOString().split('T')[0];
      if (returnedTo) updates.returned_to = returnedTo;
    }
    await updateItem.mutateAsync(updates);
    refetch();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newUrls: string[] = [...(item.photo_urls || [])];
      for (const file of Array.from(files)) {
        const url = await uploadPhoto(file, item.id);
        newUrls.push(url);
      }
      await updateItem.mutateAsync({ id: item.id, photo_urls: newUrls });
      refetch();
      toast.success(`${files.length} foto${files.length > 1 ? 's' : ''} subida${files.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error('Error al subir fotos');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handlePhotoDelete = async (photoUrl: string) => {
    try {
      await deletePhoto(photoUrl);
      const newUrls = (item.photo_urls || []).filter(u => u !== photoUrl);
      await updateItem.mutateAsync({ id: item.id, photo_urls: newUrls });
      refetch();
    } catch (err) {
      toast.error('Error al eliminar foto');
    }
  };

  const handleDelete = async () => {
    await deleteItem.mutateAsync(item.id);
    navigate('/lost-found');
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/lost-found')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{item.description}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={cn("text-xs", statusMeta.color, statusMeta.bgColor)}>
              {statusMeta.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {categoryMeta.emoji} {categoryMeta.label}
            </span>
          </div>
        </div>
        {canUpdate && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/lost-found/${item.id}/edit`)}>
            <Edit2 className="h-4 w-4 mr-1" />
            Editar
          </Button>
        )}
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar objeto</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente el registro de este objeto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="md:col-span-2 space-y-5">
          {/* Photo gallery */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos ({(item.photo_urls || []).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(item.photo_urls || []).length === 0 && !canUpdate ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin fotos</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(item.photo_urls || []).map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        className="h-full w-full object-cover cursor-pointer"
                        onClick={() => setLightboxUrl(url)}
                      />
                      {canUpdate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePhotoDelete(url); }}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {canUpdate && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                      <Camera className="h-6 w-6 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {isUploading ? 'Subiendo...' : 'Añadir'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-muted-foreground text-xs">Fecha encontrado</div>
                    <div className="font-medium">{format(new Date(item.found_date), "d 'de' MMMM yyyy", { locale: es })}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-muted-foreground text-xs">Encontrado por</div>
                    <div className="font-medium">{item.found_by}</div>
                  </div>
                </div>
                {item.found_location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-muted-foreground text-xs">Ubicación</div>
                      <div className="font-medium">{item.found_location}</div>
                    </div>
                  </div>
                )}
                {item.vehicle_plate && (
                  <div className="flex items-start gap-2">
                    <Car className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-muted-foreground text-xs">Vehículo</div>
                      <div className="font-medium">{item.vehicle_plate}</div>
                    </div>
                  </div>
                )}
              </div>

              {item.notes && (
                <>
                  <Separator />
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Notas</div>
                      <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                    </div>
                  </div>
                </>
              )}

              {item.transfer_request_id && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Transfer asociado:</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => navigate(`/transfers/${item.transfer_request_id}`)}
                    >
                      Ver transfer
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Status + Client + Actions */}
        <div className="space-y-5">
          {/* Client info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {item.client_name ? (
                <>
                  <div>
                    <span className="text-muted-foreground">Nombre:</span>{' '}
                    <span className="font-medium">{item.client_name}</span>
                  </div>
                  {item.client_contact && (
                    <div>
                      <span className="text-muted-foreground">Contacto:</span>{' '}
                      <span className="font-medium">{item.client_contact}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-2">Sin datos de cliente</p>
              )}
            </CardContent>
          </Card>

          {/* Status actions */}
          {canUpdate && item.status !== 'returned' && item.status !== 'unclaimed' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.status === 'found' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => handleStatusChange('contacted')}
                    disabled={updateItem.isPending}
                  >
                    <Phone className="h-4 w-4 text-amber-500" />
                    Marcar como contactado
                  </Button>
                )}
                {(item.status === 'found' || item.status === 'contacted') && (
                  <>
                    <div className="space-y-1.5">
                      <Input
                        placeholder="Devuelto a (nombre)"
                        value={returnedTo}
                        onChange={(e) => setReturnedTo(e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => handleStatusChange('returned')}
                        disabled={updateItem.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Registrar devolución
                      </Button>
                    </div>
                    <Separator />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
                      onClick={() => handleStatusChange('unclaimed')}
                      disabled={updateItem.isPending}
                    >
                      <XCircle className="h-4 w-4" />
                      Marcar como no reclamado
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Return info */}
          {item.status === 'returned' && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-sm space-y-1">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Devuelto
                </div>
                {item.returned_date && (
                  <div className="text-muted-foreground">
                    Fecha: {format(new Date(item.returned_date), "d MMM yyyy", { locale: es })}
                  </div>
                )}
                {item.returned_to && (
                  <div className="text-muted-foreground">
                    A: {item.returned_to}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-medium">Registrado</div>
                    <div className="text-muted-foreground">
                      {format(new Date(item.created_at), "d MMM yyyy HH:mm", { locale: es })}
                    </div>
                  </div>
                </div>
                {item.status !== 'found' && (
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-medium">Contactado</div>
                      <div className="text-muted-foreground">
                        {format(new Date(item.updated_at), "d MMM yyyy HH:mm", { locale: es })}
                      </div>
                    </div>
                  </div>
                )}
                {item.status === 'returned' && (
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-medium">Devuelto</div>
                      <div className="text-muted-foreground">
                        {item.returned_date && format(new Date(item.returned_date), "d MMM yyyy", { locale: es })}
                      </div>
                    </div>
                  </div>
                )}
                {item.status === 'unclaimed' && (
                  <div className="flex gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-medium">No reclamado</div>
                      <div className="text-muted-foreground">
                        {format(new Date(item.updated_at), "d MMM yyyy HH:mm", { locale: es })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <img src={lightboxUrl} alt="" className="w-full h-auto" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
