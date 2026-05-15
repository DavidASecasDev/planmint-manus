import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { VehicleSelect } from '@/components/garatech/VehicleSelect';
import { useAccidents } from '@/hooks/useAccidents';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ACCIDENT_SEVERITY_LABELS,
  FAULT_ASSESSMENT_LABELS,
  type Accident,
  type AccidentFormData,
  type AccidentSeverity,
  type FaultAssessment,
} from '@/types/garatech';

interface AccidentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accident?: Accident | null;
}

const emptyForm: AccidentFormData = {
  vehicle_id: '',
  accident_date: new Date().toISOString().slice(0, 16),
  location: '',
  description: '',
  severity: 'leve',
  has_injuries: false,
  police_report_number: '',
  insurance_claim_number: '',
  claim_number: '',
  fault_assessment: 'pendiente',
  third_party_name: '',
  third_party_vehicle: '',
  third_party_plate: '',
  third_party_insurance: '',
  third_party_policy_number: '',
  third_party_phone: '',
  estimated_cost: undefined,
  insurance_coverage: undefined,
  linked_repair_id: '',
  notes: '',
};

export function AccidentFormDialog({ open, onOpenChange, accident }: AccidentFormDialogProps) {

  const { createAccident, updateAccident } = useAccidents();
  const { profile } = useAuth();
  const isEditing = !!accident;
  const orgId = profile?.organization_id;

  const [form, setForm] = useState<AccidentFormData>(emptyForm);
  const [thirdPartyOpen, setThirdPartyOpen] = useState(false);
  const [economicOpen, setEconomicOpen] = useState(false);

  // Load repairs for linking
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
    enabled: !!orgId && open,
  });

  useEffect(() => {
    if (accident) {
      setForm({
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
      setThirdPartyOpen(!!(accident.third_party_name || accident.third_party_plate));
      setEconomicOpen(!!(accident.estimated_cost || accident.insurance_coverage));
    } else if (open) {
      setForm(emptyForm);
      setThirdPartyOpen(false);
      setEconomicOpen(false);
    }
  }, [accident, open]);

  const handleSubmit = async () => {
    if (!form.description) return;
    try {
      if (isEditing && accident) {
        await updateAccident.mutateAsync({ id: accident.id, data: form });
      } else {
        await createAccident.mutateAsync(form);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Error al guardar el parte de accidente');
      console.error('[AccidentFormDialog] Save failed:', error);
    }
  };

  const set = (patch: Partial<AccidentFormData>) => setForm(prev => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Accidente' : 'Registrar Accidente'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehículo</Label>
                <VehicleSelect
                  value={form.vehicle_id || ''}
                  onValueChange={(v) => set({ vehicle_id: v })}
                />
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
                    {Object.entries(ACCIDENT_SEVERITY_LABELS).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Culpabilidad</Label>
                <Select value={form.fault_assessment || 'pendiente'} onValueChange={(v) => set({ fault_assessment: v as FaultAssessment })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FAULT_ASSESSMENT_LABELS).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="injuries" checked={form.has_injuries} onCheckedChange={(checked) => set({ has_injuries: !!checked })} />
              <Label htmlFor="injuries">Hay heridos</Label>
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

            <div className="space-y-2">
              <Label>Reparación vinculada</Label>
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

            {/* Third party collapsible */}
            <Collapsible open={thirdPartyOpen} onOpenChange={setThirdPartyOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 font-medium">
                  Datos del Vehículo Contrario
                  <ChevronDown className={`h-4 w-4 transition-transform ${thirdPartyOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
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
              </CollapsibleContent>
            </Collapsible>

            {/* Economic data collapsible */}
            <Collapsible open={economicOpen} onOpenChange={setEconomicOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 font-medium">
                  Datos Económicos
                  <ChevronDown className={`h-4 w-4 transition-transform ${economicOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
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
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.description}>{isEditing ? 'Guardar' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
