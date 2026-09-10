import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, SearchCheck, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { SesContractDraft } from '@/types/sesHospedajes';

type FoundCommunication = {
  officialCommunicationCode: string;
  officialLotCode?: string | null;
  reference: string;
  communicationType: 'ALQUILER_VEHICULO';
  contractDate: string;
  vehiclePlate?: string | null;
  status: 'active' | 'accepted' | 'annulled' | 'error';
  notes?: string | null;
};

export function SesOfficialCheckDialog({
  draft, open, onOpenChange, checking, onCheck,
}: {
  draft: SesContractDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checking: boolean;
  onCheck: (input: { draftId: string; outcome: 'not_found' | 'found'; communication?: FoundCommunication }) => Promise<unknown>;
}) {
  const [outcome, setOutcome] = useState<'not_found' | 'found'>('not_found');
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState<FoundCommunication>({
    officialCommunicationCode: '', officialLotCode: '', reference: '', communicationType: 'ALQUILER_VEHICULO',
    contractDate: '', vehiclePlate: '', status: 'accepted', notes: '',
  });

  useEffect(() => {
    if (!draft || !open) return;
    setOutcome('not_found');
    setConfirmed(false);
    setForm({
      officialCommunicationCode: '', officialLotCode: '', reference: draft.reference,
      communicationType: 'ALQUILER_VEHICULO', contractDate: draft.contract_date?.slice(0, 10) ?? '',
      vehiclePlate: draft.vehicle_plate ?? '', status: 'accepted', notes: '',
    });
  }, [draft, open]);

  const requiresReview = useMemo(() => {
    if (!draft || outcome !== 'found') return false;
    const normalized = (value: string | null | undefined) => (value ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return form.status === 'annulled' || form.status === 'error'
      || form.reference.trim() !== draft.reference.trim()
      || form.contractDate !== draft.contract_date?.slice(0, 10)
      || (Boolean(draft.vehicle_plate) && normalized(form.vehiclePlate) !== normalized(draft.vehicle_plate));
  }, [draft, form, outcome]);

  if (!draft) return null;
  const foundComplete = Boolean(form.officialCommunicationCode.trim() && form.reference.trim() && form.contractDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><SearchCheck className="h-5 w-5 text-blue-700" />Registro de evidencia SES · #{draft.reference}</DialogTitle>
          <DialogDescription>PlanMint no consulta el portal oficial. Registra aquí el resultado que tú hayas comprobado fuera de PlanMint para este contrato concreto, sin introducir credenciales ni inventar valores.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
            <div><span className="text-slate-500">Referencia</span><p className="font-semibold">{draft.reference}</p></div>
            <div><span className="text-slate-500">Fecha</span><p className="font-semibold">{draft.contract_date?.slice(0, 10) || '—'}</p></div>
            <div><span className="text-slate-500">Matrícula</span><p className="font-semibold">{draft.vehicle_plate || '—'}</p></div>
          </div>

          <div className="space-y-2">
            <Label>Resultado observado por el operador</Label>
            <Select value={outcome} onValueChange={(value: 'not_found' | 'found') => { setOutcome(value); setConfirmed(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_found">No se encontró ninguna comunicación</SelectItem>
                <SelectItem value="found">Se encontró una comunicación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {outcome === 'found' && (
            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Código oficial de comunicación</Label><Input value={form.officialCommunicationCode} onChange={(event) => setForm({ ...form, officialCommunicationCode: event.target.value.trim() })} /></div>
              <div className="space-y-2"><Label>Código de lote (opcional)</Label><Input value={form.officialLotCode ?? ''} onChange={(event) => setForm({ ...form, officialLotCode: event.target.value.trim() })} /></div>
              <div className="space-y-2"><Label>Estado oficial</Label><Select value={form.status} onValueChange={(value: FoundCommunication['status']) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="accepted">Aceptada</SelectItem><SelectItem value="annulled">Anulada</SelectItem><SelectItem value="error">Con error</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Referencia oficial</Label><Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></div>
              <div className="space-y-2"><Label>Fecha de contrato</Label><Input type="date" value={form.contractDate} onChange={(event) => setForm({ ...form, contractDate: event.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Matrícula oficial</Label><Input value={form.vehiclePlate ?? ''} onChange={(event) => setForm({ ...form, vehiclePlate: event.target.value.toUpperCase() })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Nota interna (opcional)</Label><Textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            </div>
          )}

          {outcome === 'not_found' && <Alert className="border-blue-200 bg-blue-50 text-blue-950"><ShieldCheck className="h-4 w-4" /><AlertTitle>Resultado sin coincidencias</AlertTitle><AlertDescription>Solo se registrará para la identidad exacta actual. Si cambia referencia, fecha o matrícula, la comprobación deja de ser válida automáticamente.</AlertDescription></Alert>}
          {requiresReview && <Alert className="border-amber-300 bg-amber-50 text-amber-950"><AlertCircle className="h-4 w-4" /><AlertTitle>Aviso para el operador</AlertTitle><AlertDescription>La comunicación está anulada, tiene error o no coincide exactamente con fecha o matrícula. Se conservará como aviso informativo, pero no bloqueará la selección ni la descarga XML.</AlertDescription></Alert>}

          {outcome === 'found' && !requiresReview && <Alert className="border-amber-300 bg-amber-50 text-amber-950"><AlertCircle className="h-4 w-4" /><AlertTitle>Posible comunicación previa</AlertTitle><AlertDescription>La coincidencia se mostrará como advertencia en la bandeja. PlanMint no tomará la decisión por el operador ni desactivará la descarga XML.</AlertDescription></Alert>}

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
            <span>Confirmo que yo he comprobado fuera de PlanMint la referencia, tipo, fecha y matrícula, y que los datos registrados reproducen el resultado observado.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!confirmed || checking || (outcome === 'found' && !foundComplete)} onClick={async () => {
            await onCheck({ draftId: draft.id, outcome, ...(outcome === 'found' ? { communication: form } : {}) });
            onOpenChange(false);
          }}>
            {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar evidencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
