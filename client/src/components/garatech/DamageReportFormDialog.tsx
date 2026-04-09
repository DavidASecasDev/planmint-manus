import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { VehicleSelect } from '@/components/garatech/VehicleSelect';
import { useDamageReports } from '@/hooks/useDamageReports';
import type { DamageReportFormData } from '@/types/garatech';

interface DamageReportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DamageReportFormDialog({ open, onOpenChange }: DamageReportFormDialogProps) {
  const { createReport } = useDamageReports();

  const [form, setForm] = useState<DamageReportFormData>({
    vehicle_id: '',
    damage_date: new Date().toISOString().slice(0, 10),
    customer_name: '',
    customer_document: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setForm({ vehicle_id: '', damage_date: new Date().toISOString().slice(0, 10), customer_name: '', customer_document: '', notes: '' });
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.damage_date) return;
    try {
      await createReport.mutateAsync(form);
      onOpenChange(false);
    } catch (error) {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo Informe de Daños</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <VehicleSelect
                value={form.vehicle_id}
                onValueChange={(v) => setForm({ ...form, vehicle_id: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha del daño *</Label>
              <Input type="date" value={form.damage_date} onChange={(e) => setForm({ ...form, damage_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre cliente</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Documento cliente</Label>
              <Input value={form.customer_document} onChange={(e) => setForm({ ...form, customer_document: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.damage_date}>Crear Informe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
