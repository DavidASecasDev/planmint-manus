import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useQueryClient } from '@tanstack/react-query';
import type { Workshop, WorkshopFormData } from '@/types/garatech';
import { toast } from 'sonner';

interface WorkshopEditFormProps {
  workshop: Workshop;
  onSave: () => void;
  onCancel: () => void;
}

export function WorkshopEditForm({ workshop, onSave, onCancel }: WorkshopEditFormProps) {
  const { updateWorkshop } = useWorkshops();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<WorkshopFormData>({
    name: workshop.name,
    address: workshop.address || '',
    phone: workshop.phone || '',
    email: workshop.email || '',
    notes: workshop.notes || '',
    is_active: workshop.is_active,
  });

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('El nombre es requerido');
      return;
    }
    try {
      await updateWorkshop.mutateAsync({ id: workshop.id, data: form });
      queryClient.invalidateQueries({ queryKey: ['workshop', workshop.id] });
      onSave();
    } catch (error) {}
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Datos del Taller</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            <Label>Taller activo</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={!form.name}>Guardar</Button>
      </div>
    </div>
  );
}
