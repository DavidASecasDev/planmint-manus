import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useWorkshops } from '@/hooks/useWorkshops';
import type { Workshop, WorkshopFormData } from '@/types/garatech';
import { toast } from 'sonner';

interface WorkshopFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop?: Workshop | null;
}

export function WorkshopFormDialog({ open, onOpenChange, workshop }: WorkshopFormDialogProps) {
  const { createWorkshop, updateWorkshop } = useWorkshops();
  const isEditing = !!workshop;

  const [form, setForm] = useState<WorkshopFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    if (workshop) {
      setForm({
        name: workshop.name,
        address: workshop.address || '',
        phone: workshop.phone || '',
        email: workshop.email || '',
        notes: workshop.notes || '',
        is_active: workshop.is_active,
      });
    } else {
      setForm({
        name: '',
        address: '',
        phone: '',
        email: '',
        notes: '',
        is_active: true,
      });
    }
  }, [workshop, open]);

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('El nombre es requerido');
      return;
    }
    try {
      if (isEditing && workshop) {
        await updateWorkshop.mutateAsync({ id: workshop.id, data: form });
      } else {
        await createWorkshop.mutateAsync(form);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Taller' : 'Añadir Taller'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre del taller"
            />
          </div>

          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Dirección completa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+34 XXX XXX XXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="taller@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
            />
            <Label>Taller activo</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name}>
            {isEditing ? 'Guardar' : 'Añadir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
