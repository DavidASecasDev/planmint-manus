import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, X, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useLostFound,
  useLostFoundItem,
  LOST_FOUND_CATEGORY_META,
  type LostFoundCategory,
  type CreateLostFoundInput,
} from '@/hooks/useLostFound';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TransferOption {
  id: string;
  reference: string;
  client_name: string;
  date: string;
}

export default function LostFoundForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { createItem, updateItem, uploadPhoto } = useLostFound();
  const { data: existingItem, isLoading: itemLoading } = useLostFoundItem(id || '');

  const isEditing = !!id;

  // Form state
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LostFoundCategory>('other');
  const [foundBy, setFoundBy] = useState('');
  const [foundDate, setFoundDate] = useState(new Date().toISOString().split('T')[0]);
  const [foundLocation, setFoundLocation] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [notes, setNotes] = useState('');
  const [transferRequestId, setTransferRequestId] = useState<string | null>(null);
  const [transferSearch, setTransferSearch] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing item data for editing
  useEffect(() => {
    if (existingItem && isEditing) {
      setDescription(existingItem.description);
      setCategory(existingItem.category);
      setFoundBy(existingItem.found_by);
      setFoundDate(existingItem.found_date);
      setFoundLocation(existingItem.found_location || '');
      setVehiclePlate(existingItem.vehicle_plate || '');
      setClientName(existingItem.client_name || '');
      setClientContact(existingItem.client_contact || '');
      setNotes(existingItem.notes || '');
      setTransferRequestId(existingItem.transfer_request_id);
      setExistingPhotos(existingItem.photo_urls || []);
    }
  }, [existingItem, isEditing]);

  // Search transfers for association
  const { data: transferOptions = [] } = useQuery({
    queryKey: ['lost-found-transfer-search', transferSearch],
    queryFn: async () => {
      if (!transferSearch || transferSearch.length < 2) return [];
      const { data, error } = await supabaseQuery
        .from('transfer_requests')
        .select('id, reference, client_name, pickup_date')
        .ilike('client_name', `%${transferSearch}%`)
        .order('pickup_date', { ascending: false })
        .limit(10);

      if (error) return [];
      return (data || []).map((t: any) => ({
        id: t.id,
        reference: t.reference || t.id.slice(0, 8),
        client_name: t.client_name || 'Sin nombre',
        date: t.pickup_date || '',
      })) as TransferOption[];
    },
    enabled: transferSearch.length >= 2,
  });

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setPhotos(prev => [...prev, ...newFiles]);

    // Generate previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeNewPhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }
    if (!foundBy.trim()) {
      toast.error('El campo "Encontrado por" es obligatorio');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && existingItem) {
        // Upload new photos
        let allPhotoUrls = [...existingPhotos];
        for (const file of photos) {
          const url = await uploadPhoto(file, existingItem.id);
          allPhotoUrls.push(url);
        }

        await updateItem.mutateAsync({
          id: existingItem.id,
          description,
          category,
          found_by: foundBy,
          found_date: foundDate,
          found_location: foundLocation || null,
          vehicle_plate: vehiclePlate || null,
          client_name: clientName || null,
          client_contact: clientContact || null,
          notes: notes || null,
          transfer_request_id: transferRequestId,
          photo_urls: allPhotoUrls,
        });
        navigate(`/lost-found/${existingItem.id}`);
      } else {
        // Create new item first (to get ID for photo upload)
        const input: CreateLostFoundInput = {
          description,
          category,
          found_by: foundBy,
          found_date: foundDate,
          found_location: foundLocation || null,
          vehicle_plate: vehiclePlate || null,
          client_name: clientName || null,
          client_contact: clientContact || null,
          notes: notes || null,
          transfer_request_id: transferRequestId,
          photo_urls: [],
        };

        const created = await createItem.mutateAsync(input);

        // Upload photos if any
        if (photos.length > 0 && created) {
          const photoUrls: string[] = [];
          for (const file of photos) {
            const url = await uploadPhoto(file, created.id);
            photoUrls.push(url);
          }
          await updateItem.mutateAsync({ id: created.id, photo_urls: photoUrls });
        }

        navigate('/lost-found');
      }
    } catch (err) {
      // Error already toasted by hook
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && itemLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <AppLayout title={isEditing ? 'Editar Objeto' : 'Registrar Objeto'}>
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEditing ? `/lost-found/${id}` : '/lost-found')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">
          {isEditing ? 'Editar objeto perdido' : 'Registrar objeto perdido'}
        </h1>
      </div>

      {/* Form */}
      <div className="space-y-5">
        {/* Basic info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Información del objeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                placeholder="Ej: iPhone 15 Pro con funda negra, cargador USB-C blanco..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as LostFoundCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOST_FOUND_CATEGORY_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>{meta.emoji} {meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="foundDate">Fecha encontrado *</Label>
                <Input
                  id="foundDate"
                  type="date"
                  value={foundDate}
                  onChange={(e) => setFoundDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="foundBy">Encontrado por *</Label>
                <Input
                  id="foundBy"
                  placeholder="Nombre del conductor/empleado"
                  value={foundBy}
                  onChange={(e) => setFoundBy(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="foundLocation">Ubicación</Label>
                <Input
                  id="foundLocation"
                  placeholder="Ej: asiento trasero, maletero..."
                  value={foundLocation}
                  onChange={(e) => setFoundLocation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Matrícula del vehículo</Label>
              <Input
                id="vehiclePlate"
                placeholder="Ej: 1234 ABC"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Fotos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* Existing photos (edit mode) */}
              {existingPhotos.map((url, idx) => (
                <div key={`existing-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeExistingPhoto(idx)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {/* New photo previews */}
              {photoPreviews.map((preview, idx) => (
                <div key={`new-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeNewPhoto(idx)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {/* Upload button */}
              <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <Camera className="h-6 w-6 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground mt-1">Añadir foto</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Client info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos del cliente (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nombre del cliente</Label>
                <Input
                  id="clientName"
                  placeholder="Nombre completo"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientContact">Contacto (tel/email)</Label>
                <Input
                  id="clientContact"
                  placeholder="Teléfono o email"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transfer association */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asociar a transfer (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transfer por nombre de cliente..."
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {transferRequestId && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
                <span className="text-sm font-medium flex-1">Transfer seleccionado: {transferRequestId.slice(0, 8)}...</span>
                <Button variant="ghost" size="sm" onClick={() => setTransferRequestId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {transferOptions.length > 0 && !transferRequestId && (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {transferOptions.map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm"
                    onClick={() => {
                      setTransferRequestId(t.id);
                      setTransferSearch('');
                      if (t.client_name && !clientName) setClientName(t.client_name);
                    }}
                  >
                    <span className="font-medium">{t.client_name}</span>
                    <span className="text-muted-foreground ml-2">({t.reference})</span>
                    {t.date && <span className="text-muted-foreground ml-2">· {t.date}</span>}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notas adicionales</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Cualquier información adicional relevante..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => navigate(isEditing ? `/lost-found/${id}` : '/lost-found')}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar objeto'}
          </Button>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
