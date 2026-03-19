import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useAccidents } from '@/hooks/useAccidents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Car, User, DollarSign, Wrench, Save, X } from 'lucide-react';
import {
  ACCIDENT_SEVERITY_LABELS,
  FAULT_ASSESSMENT_LABELS,
  type Accident,
  type AccidentFormData,
  type AccidentSeverity,
  type FaultAssessment,
} from '@/types/garatech';

interface Props {
  accident: Accident;
  onSave: () => void;
  onCancel: () => void;
}

export function AccidentEditForm({ accident, onSave, onCancel }: Props) {
  const { vehicles } = useVehicles();
  const { updateAccident } = useAccidents();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [form, setForm] = useState<AccidentFormData>({
    vehicle_id: accident.vehicle_id || '',
    accident_date: accident.accident_date.slice(0, 16),
    location: accident.location || '',
    description: accident.description,
    severity: accident.severity,
    has_injuries: accident.has_injuries,
    police_report_number: accident.police_report_number || '',
    insurance_claim_number: accident.insurance_claim_number || '',
    claim_number: accident.claim_number || '',
    fault_assessment: (accident.fault_assessment as FaultAssessment) || 'pendiente',
    third_party_name: accident.third_party_name || '',
    third_party_vehicle: accident.third_party_vehicle || '',
    third_party_plate: accident.third_party_plate || '',
    third_party_insurance: accident.third_party_insurance || '',
    third_party_policy_number: accident.third_party_policy_number || '',
    third_party_phone: accident.third_party_phone || '',
    estimated_cost: accident.estimated_cost ?? undefined,
    insurance_coverage: accident.insurance_coverage ?? undefined,
    linked_repair_id: accident.linked_repair_id || '',
    notes: accident.notes || '',
  });

  const { data: repairs = [] } = useQuery({
    queryKey: ['repairs-for-linking', orgId, form.vehicle_id],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('repairs')
        .select('id, repair_number, description, vehicle_id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (form.vehicle_id) {
        query = query.eq('vehicle_id', form.vehicle_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const set = (patch: Partial<AccidentFormData>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!form.description) return;
    try {
      await updateAccident.mutateAsync({ id: accident.id, data: form });
      onSave();
    } catch {}
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Datos del accidente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos del Accidente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehículo</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => set({ vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.matricula} - {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha y hora *</Label>
                <Input type="datetime-local" value={form.accident_date} onChange={(e) => set({ accident_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={form.location} onChange={(e) => set({ location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gravedad</Label>
                <Select value={form.severity} onValueChange={(v) => set({ severity: v as AccidentSeverity })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_SEVERITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Culpabilidad</Label>
                <Select value={form.fault_assessment || 'pendiente'} onValueChange={(v) => set({ fault_assessment: v as FaultAssessment })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FAULT_ASSESSMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="injuries-edit" checked={form.has_injuries} onCheckedChange={(checked) => set({ has_injuries: !!checked })} />
              <Label htmlFor="injuries-edit">Hay heridos</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº Atestado Policial</Label>
                <Input value={form.police_report_number} onChange={(e) => set({ police_report_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nº Siniestro</Label>
                <Input value={form.claim_number} onChange={(e) => set({ claim_number: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehículo contrario */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Vehículo Contrario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre conductor</Label>
                <Input value={form.third_party_name} onChange={(e) => set({ third_party_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.third_party_phone} onChange={(e) => set({ third_party_phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input value={form.third_party_plate} onChange={(e) => set({ third_party_plate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vehículo (marca/modelo)</Label>
                <Input value={form.third_party_vehicle} onChange={(e) => set({ third_party_vehicle: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aseguradora</Label>
                <Input value={form.third_party_insurance} onChange={(e) => set({ third_party_insurance: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nº Póliza</Label>
                <Input value={form.third_party_policy_number} onChange={(e) => set({ third_party_policy_number: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos económicos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Datos Económicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coste estimado (€)</Label>
                <Input type="number" step="0.01" value={form.estimated_cost ?? ''} onChange={(e) => set({ estimated_cost: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div className="space-y-2">
                <Label>Cobertura seguro (€)</Label>
                <Input type="number" step="0.01" value={form.insurance_coverage ?? ''} onChange={(e) => set({ insurance_coverage: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reparación vinculada */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Reparación Vinculada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Reparación</Label>
              <Select value={form.linked_repair_id || '__none__'} onValueChange={(v) => set({ linked_repair_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin vincular</SelectItem>
                  {repairs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.repair_number} — {r.description?.slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!form.description || updateAccident.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
