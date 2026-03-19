import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useDamageCatalog } from '@/hooks/useDamageCatalog';
import { DAMAGE_CATEGORY_LABELS, type DamageCatalogItem, type DamageCatalogFormData, type DamageCategory } from '@/types/garatech';

interface DamageCatalogItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: DamageCatalogItem | null;
}

export function DamageCatalogItemDialog({ open, onOpenChange, item }: DamageCatalogItemDialogProps) {
  const { createItem, updateItem } = useDamageCatalog();
  const isEditing = !!item;

  const [form, setForm] = useState<DamageCatalogFormData>({
    name_es: '', name_en: '', category: 'general', price_level_1: 0, price_level_2: 0, price_level_3: 0, price_level_4: 0, price_level_5: 0, is_active: true,
  });

  useEffect(() => {
    if (item) {
      setForm({ name_es: item.name_es, name_en: item.name_en || '', category: item.category, price_level_1: item.price_level_1 || 0, price_level_2: item.price_level_2 || 0, price_level_3: item.price_level_3 || 0, price_level_4: item.price_level_4 || 0, price_level_5: item.price_level_5 || 0, is_active: item.is_active });
    } else if (open) {
      setForm({ name_es: '', name_en: '', category: 'general', price_level_1: 0, price_level_2: 0, price_level_3: 0, price_level_4: 0, price_level_5: 0, is_active: true });
    }
  }, [item, open]);

  const handleSubmit = async () => {
    if (!form.name_es) return;
    try {
      if (isEditing && item) { await updateItem.mutateAsync({ id: item.id, data: form }); }
      else { await createItem.mutateAsync(form); }
      onOpenChange(false);
    } catch (error) {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEditing ? 'Editar Item' : 'Añadir Item al Catálogo'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre (ES) *</Label><Input value={form.name_es} onChange={(e) => setForm({ ...form, name_es: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nombre (EN)</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as DamageCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DAMAGE_CATEGORY_LABELS).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6"><Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /><Label>Activo</Label></div>
          </div>
          <div className="space-y-2">
            <Label>Precios por nivel (€)</Label>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5].map((level) => (
                <div key={level} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nivel {level}</Label>
                  <Input type="number" min={0} value={(form as any)[`price_level_${level}`] || 0} onChange={(e) => setForm({ ...form, [`price_level_${level}`]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name_es}>{isEditing ? 'Guardar' : 'Añadir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
