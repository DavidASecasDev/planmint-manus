import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VehicleSelect } from '@/components/garatech/VehicleSelect';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useRepairs } from '@/hooks/useRepairs';
import { REPAIR_TYPE_LABELS, REPAIR_STATUS_LABELS, type Repair, type RepairFormData, type RepairType, type RepairStatus } from '@/types/garatech';
import { toast } from 'sonner';

interface RepairFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair?: Repair | null;
}

export function RepairFormDialog({ open, onOpenChange, repair }: RepairFormDialogProps) {

  const { activeWorkshops } = useWorkshops();
  const { createRepair, updateRepair } = useRepairs();
  const isEditing = !!repair;

  const [form, setForm] = useState<RepairFormData>({
    vehicle_id: '',
    workshop_id: '',
    repair_type: 'reparacion',
    description: '',
    status: 'pendiente_aprobacion',
    scheduled_date: '',
    cost_estimate: 0,
    km_at_repair: 0,
    notes: '',
  });

  useEffect(() => {
    if (repair) {
      setForm({
        vehicle_id: repair.vehicle_id || '',
        workshop_id: repair.workshop_id || '',
        repair_type: repair.repair_type,
        description: repair.description,
        status: repair.status,
        scheduled_date: repair.scheduled_date?.slice(0, 10) || '',
        cost_estimate: repair.cost_estimate || 0,
        km_at_repair: repair.km_at_repair || 0,
        notes: repair.notes || '',
      });
    } else {
      setForm({
        vehicle_id: '',
        workshop_id: '',
        repair_type: 'reparacion',
        description: '',
        status: 'pendiente_aprobacion',
        scheduled_date: '',
        cost_estimate: 0,
        km_at_repair: 0,
        notes: '',
      });
    }
  }, [repair, open]);

  const handleSubmit = async () => {
    if (!form.description) {
      toast.error('La descripción es requerida');
      return;
    }
    try {
      if (isEditing && repair) {
        await updateRepair.mutateAsync({ id: repair.id, data: form, previousStatus: repair.status });
      } else {
        await createRepair.mutateAsync(form);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Reparación' : 'Nueva Reparación'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehículo</Label>
              <VehicleSelect
                value={form.vehicle_id || ''}
                onValueChange={(v) => setForm({ ...form, vehicle_id: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Taller</Label>
              <Select value={form.workshop_id || ''} onValueChange={(v) => setForm({ ...form, workshop_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {activeWorkshops.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select 
                value={form.repair_type} 
                onValueChange={(v) => setForm({ ...form, repair_type: v as RepairType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPAIR_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEditing && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={form.status} 
                  onValueChange={(v) => setForm({ ...form, status: v as RepairStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del trabajo a realizar"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fecha programada</Label>
              <Input
                type="date"
                value={form.scheduled_date ?? ''}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Coste estimado (€)</Label>
              <Input
                type="number"
                min={0}
                value={form.cost_estimate || ''}
                onChange={(e) => setForm({ ...form, cost_estimate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Kilómetros</Label>
              <Input
                type="number"
                min={0}
                value={form.km_at_repair || ''}
                onChange={(e) => setForm({ ...form, km_at_repair: parseInt(e.target.value) || 0 })}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.description}>
            {isEditing ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
