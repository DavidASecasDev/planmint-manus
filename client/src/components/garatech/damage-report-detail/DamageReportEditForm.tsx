import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVehicles } from '@/hooks/useVehicles';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DamageReport } from '@/types/garatech';
import { toast } from 'sonner';

interface DamageReportEditFormProps {
  report: DamageReport;
  onSave: () => void;
  onCancel: () => void;
}

export function DamageReportEditForm({ report, onSave, onCancel }: DamageReportEditFormProps) {
  const { vehicles } = useVehicles();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    vehicle_id: report.vehicle_id || '',
    damage_date: report.damage_date.slice(0, 10),
    customer_name: report.customer_name || '',
    customer_document: report.customer_document || '',
    notes: report.notes || '',
  });

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.damage_date) {
      toast.error('Vehículo y fecha son requeridos');
      return;
    }
    try {
      const { error } = await supabase
        .from('damage_reports')
        .update({
          vehicle_id: form.vehicle_id,
          damage_date: form.damage_date,
          customer_name: form.customer_name || null,
          customer_document: form.customer_document || null,
          notes: form.notes || null,
        })
        .eq('id', report.id);
      if (error) throw error;
      toast.success('Informe actualizado');
      queryClient.invalidateQueries({ queryKey: ['damage-report', report.id] });
      queryClient.invalidateQueries({ queryKey: ['damage-reports'] });
      onSave();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Datos del Informe</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.matricula} - {v.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.damage_date}>Guardar</Button>
      </div>
    </div>
  );
}
