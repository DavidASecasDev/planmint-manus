import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Wrench } from 'lucide-react';
import { useVehicles } from '@/hooks/useVehicles';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useRepairs } from '@/hooks/useRepairs';
import { REPAIR_TYPE_LABELS, type RepairFormData, type RepairType } from '@/types/garatech';
import { toast } from 'sonner';

export default function RepairNew() {
  const navigate = useNavigate();
  const { vehicles } = useVehicles();
  const { activeWorkshops } = useWorkshops();
  const { createRepair } = useRepairs();

  const [form, setForm] = useState<RepairFormData>({
    vehicle_id: '',
    workshop_id: '',
    repair_type: 'reparacion',
    description: '',
    scheduled_date: '',
    cost_estimate: 0,
    km_at_repair: 0,
    notes: '',
  });

  const handleSubmit = async () => {
    if (!form.description) {
      toast.error('La descripción es requerida');
      return;
    }
    try {
      const result = await createRepair.mutateAsync(form);
      navigate(`/garatech/repairs/${result.id}`);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <AppLayout title="Nueva Reparación">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/repairs')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Nueva Reparación</h1>
          </div>
        </div>

        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos de la Reparación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehículo</Label>
                  <Select value={form.vehicle_id || ''} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.matricula} - {v.modelo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Taller</Label>
                  <Select value={form.workshop_id || ''} onValueChange={(v) => setForm({ ...form, workshop_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {activeWorkshops.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.repair_type} onValueChange={(v) => setForm({ ...form, repair_type: v as RepairType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPAIR_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Input type="date" value={form.scheduled_date ?? ''} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Coste estimado (€)</Label>
                  <Input type="number" min={0} value={form.cost_estimate || ''} onChange={(e) => setForm({ ...form, cost_estimate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Kilómetros</Label>
                  <Input type="number" min={0} value={form.km_at_repair || ''} onChange={(e) => setForm({ ...form, km_at_repair: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/garatech/repairs')}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.description}>Crear Reparación</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
