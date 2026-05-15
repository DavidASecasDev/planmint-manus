import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Building2, Loader2, ShieldAlert } from 'lucide-react';
import { useWorkshops } from '@/hooks/useWorkshops';
import type { WorkshopFormData } from '@/types/garatech';
import { toast } from 'sonner';

export default function WorkshopNew() {
  const navigate = useNavigate();
  const { createWorkshop, canManage, permissionsLoading } = useWorkshops();

  if (permissionsLoading) {
    return (
      <AppLayout title="Añadir Taller">
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return (
      <AppLayout title="Añadir Taller">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground mb-4">No tienes permiso para añadir talleres</p>
          <Button variant="outline" onClick={() => navigate('/garatech/workshops')}>Volver al listado</Button>
        </div>
      </AppLayout>
    );
  }

  const [form, setForm] = useState<WorkshopFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
    notes: '',
    is_active: true,
  });

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('El nombre es requerido');
      return;
    }
    try {
      const result = await createWorkshop.mutateAsync(form);
      navigate(`/garatech/workshops/${result.id}`);
    } catch (error) {
      toast.error('Error al crear el taller');
      console.error('[WorkshopNew] Create failed:', error);
    }
  };

  return (
    <AppLayout title="Añadir Taller">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/workshops')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Añadir Taller</h1>
          </div>
        </div>

        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del Taller</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del taller" />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección completa" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+34 XXX XXX XXX" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="taller@ejemplo.com" />
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
            <Button variant="outline" onClick={() => navigate('/garatech/workshops')}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name}>Añadir Taller</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
