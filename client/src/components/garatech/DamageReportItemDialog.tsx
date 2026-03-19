import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDamageCatalog } from '@/hooks/useDamageCatalog';
import { useDamageReports } from '@/hooks/useDamageReports';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { VEHICLE_LOCATION_GROUPS, type DamageReportItemFormData, type DamageCatalogItem } from '@/types/garatech';
import { toast } from 'sonner';
import { Camera, X, Loader2 } from 'lucide-react';

interface DamageReportItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
}

const getPriceForLevel = (item: DamageCatalogItem | null, level: number): number => {
  if (!item) return 0;
  const prices = [item.price_level_1, item.price_level_2, item.price_level_3, item.price_level_4, item.price_level_5];
  return prices[level - 1] || 0;
};

export function DamageReportItemDialog({ open, onOpenChange, reportId }: DamageReportItemDialogProps) {
  const { catalog } = useDamageCatalog();
  const { addReportItem } = useDamageReports();
  const { profile } = useAuth();
  const activeItems = catalog.filter(c => c.is_active);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<DamageReportItemFormData>({
    catalog_item_id: '',
    custom_description: '',
    severity_level: 1,
    quantity: 1,
    unit_price: 0,
    location_on_vehicle: '',
    notes: '',
    photo_urls: [],
  });

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  const selectedItem = catalog.find(c => c.id === form.catalog_item_id) || null;

  useEffect(() => {
    if (open) {
      setForm({
        catalog_item_id: '',
        custom_description: '',
        severity_level: 1,
        quantity: 1,
        unit_price: 0,
        location_on_vehicle: '',
        notes: '',
        photo_urls: [],
      });
      setPhotoPreviewUrls([]);
    }
  }, [open]);

  useEffect(() => {
    if (selectedItem) {
      setForm(f => ({ ...f, unit_price: getPriceForLevel(selectedItem, f.severity_level) }));
    }
  }, [selectedItem, form.severity_level]);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !profile?.organization_id) return;

    setUploadingPhotos(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${profile.organization_id}/${reportId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('damage-report-photos')
          .upload(path, file, { upsert: true });

        if (uploadError) {
          toast.error(`Error al subir ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('damage-report-photos')
          .getPublicUrl(path);

        newUrls.push(urlData.publicUrl);
      }

      setForm(f => ({ ...f, photo_urls: [...(f.photo_urls || []), ...newUrls] }));
      setPhotoPreviewUrls(prev => [...prev, ...newUrls]);
    } catch (error) {
      toast.error('Error al subir fotos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setForm(f => ({
      ...f,
      photo_urls: (f.photo_urls || []).filter((_, i) => i !== index),
    }));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.catalog_item_id && !form.custom_description) {
      toast.error('Selecciona un item del catálogo o añade una descripción');
      return;
    }
    if (form.unit_price <= 0) {
      toast.error('El precio debe ser mayor que 0');
      return;
    }
    try {
      await addReportItem.mutateAsync({ reportId, item: form });
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir Item al Informe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Item del catálogo</Label>
            <Select 
              value={form.catalog_item_id || ''} 
              onValueChange={(v) => setForm({ ...form, catalog_item_id: v, custom_description: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar del catálogo..." />
              </SelectTrigger>
              <SelectContent>
                {activeItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name_es}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!form.catalog_item_id && (
            <div className="space-y-2">
              <Label>O descripción personalizada</Label>
              <Input
                value={form.custom_description}
                onChange={(e) => setForm({ ...form, custom_description: e.target.value })}
                placeholder="Descripción del daño"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Gravedad (1-5)</Label>
              <Select 
                value={String(form.severity_level)} 
                onValueChange={(v) => setForm({ ...form, severity_level: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      Nivel {level}
                      {selectedItem && ` (${getPriceForLevel(selectedItem, level)}€)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Precio unitario (€)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ubicación en vehículo</Label>
            <Select 
              value={form.location_on_vehicle || ''} 
              onValueChange={(v) => setForm({ ...form, location_on_vehicle: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_LOCATION_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Fotos del daño</Label>
            <div className="flex flex-wrap gap-2">
              {photoPreviewUrls.map((url, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhotos}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex items-center justify-center transition-colors"
              >
                {uploadingPhotos ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoUpload(e.target.files)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Total del item:</p>
            <p className="text-lg font-bold">{(form.unit_price * form.quantity).toFixed(2)}€</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={uploadingPhotos}>Añadir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
