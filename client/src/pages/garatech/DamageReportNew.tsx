import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, LinkIcon, Loader2, ShieldAlert } from 'lucide-react';
import { useVehicles } from '@/hooks/useVehicles';
import { useDamageReports } from '@/hooks/useDamageReports';
import { useAuth } from '@/contexts/AuthContext';
import type { DamageReportFormData } from '@/types/garatech';

export default function DamageReportNew() {
  const navigate = useNavigate();
  const { vehicles } = useVehicles();
  const { createReport, canManage, permissionsLoading } = useDamageReports();
  const { profile } = useAuth();

  if (permissionsLoading) {
    return (
      <AppLayout title="Nuevo Informe de Daños">
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return (
      <AppLayout title="Nuevo Informe de Daños">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground mb-4">No tienes permiso para crear informes de daños</p>
          <Button variant="outline" onClick={() => navigate('/garatech/damages?tab=informes')}>Volver al listado</Button>
        </div>
      </AppLayout>
    );
  }

  const [form, setForm] = useState<DamageReportFormData>({
    vehicle_id: '',
    damage_date: new Date().toISOString().slice(0, 10),
    customer_name: '',
    customer_document: '',
    notes: '',
  });

  // Fetch reservations for the selected vehicle
  const { data: vehicleReservations = [] } = useQuery({
    queryKey: ['vehicle-reservations-for-damage', form.vehicle_id],
    queryFn: async () => {
      if (!form.vehicle_id || !profile?.organization_id) return [];
      // Find vehicle matricula
      const vehicle = vehicles.find(v => v.id === form.vehicle_id);
      if (!vehicle) return [];

      const { data, error } = await supabase
        .from('reservations')
        .select('id, external_reservation_id, codigo, cliente_nombre, cliente_apellido, documento_cliente, desde, hasta, auto')
        .eq('organization_id', profile.organization_id)
        .eq('auto', vehicle.matricula)
        .order('desde', { ascending: false })
        .limit(20);

      if (error) return [];
      return data || [];
    },
    enabled: !!form.vehicle_id && !!profile?.organization_id,
  });

  const handleReservationSelect = (reservationId: string) => {
    const reservation = vehicleReservations.find(r => r.id === reservationId);
    if (!reservation) return;

    const vehicle = vehicles.find(v => v.id === form.vehicle_id);
    const clientName = [reservation.cliente_nombre, reservation.cliente_apellido].filter(Boolean).join(' ');

    setForm(prev => ({
      ...prev,
      reservation_id: reservationId,
      customer_name: clientName || prev.customer_name,
      customer_document: reservation.documento_cliente || prev.customer_document,
      external_reservation_number: reservation.external_reservation_id || reservation.codigo || undefined,
      contract_start_date: reservation.desde || undefined,
      contract_end_date: reservation.hasta || undefined,
      vehicle_plate: vehicle?.matricula || undefined,
      vehicle_model: vehicle?.modelo || undefined,
      vehicle_brand: vehicle?.fleet_info?.marca || undefined,
    }));
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.damage_date) return;
    try {
      const result = await createReport.mutateAsync(form);
      navigate(`/garatech/reports/${result.id}`);
    } catch (error) {}
  };

  return (
    <AppLayout title="Nuevo Informe de Daños">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/damages?tab=informes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Nuevo Informe de Daños</h1>
          </div>
        </div>

        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del Informe</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehículo *</Label>
                  <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v, reservation_id: undefined })}>
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

              {/* Reservation selector */}
              {form.vehicle_id && vehicleReservations.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Vincular a reserva (opcional)
                  </Label>
                  <Select value={form.reservation_id || ''} onValueChange={handleReservationSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar reserva para auto-rellenar datos..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleReservations.map((r) => {
                        const label = [
                          r.external_reservation_id || r.codigo,
                          r.cliente_nombre,
                          r.desde ? `desde ${r.desde.slice(0, 10)}` : null,
                        ].filter(Boolean).join(' · ');
                        return <SelectItem key={r.id} value={r.id}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  {form.reservation_id && (
                    <p className="text-xs text-muted-foreground">
                      Datos del cliente y contrato auto-rellenados desde la reserva
                    </p>
                  )}
                </div>
              )}

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

              {/* Contract dates (auto-filled or manual) */}
              {(form.contract_start_date || form.contract_end_date || form.external_reservation_number) && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  {form.external_reservation_number && (
                    <div className="space-y-1">
                      <Label className="text-xs">Nº Reserva</Label>
                      <p className="text-sm font-medium">{form.external_reservation_number}</p>
                    </div>
                  )}
                  {form.contract_start_date && (
                    <div className="space-y-1">
                      <Label className="text-xs">Inicio contrato</Label>
                      <p className="text-sm font-medium">{form.contract_start_date.slice(0, 10)}</p>
                    </div>
                  )}
                  {form.contract_end_date && (
                    <div className="space-y-1">
                      <Label className="text-xs">Fin contrato</Label>
                      <p className="text-sm font-medium">{form.contract_end_date.slice(0, 10)}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/garatech/damages?tab=informes')}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.damage_date}>Crear Informe</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
