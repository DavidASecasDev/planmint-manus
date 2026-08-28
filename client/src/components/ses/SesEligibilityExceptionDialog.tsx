import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SesContractDraft } from '@/types/sesHospedajes';

function defaultExpiry() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function SesEligibilityExceptionDialog({
  draft, open, onOpenChange, saving, onCreate, onRevoke,
}: {
  draft: SesContractDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onCreate: (input: { draftId: string; protocolReference: string; reason: string; expiresAt: string }) => Promise<unknown>;
  onRevoke: (input: { exceptionId: string; reason: string }) => Promise<unknown>;
}) {
  const [protocolReference, setProtocolReference] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [confirmed, setConfirmed] = useState(false);
  const activeExceptionId = useMemo(() => {
    const value = draft?.eligibility_snapshot?.manual_exception_id;
    return typeof value === 'string' && value ? value : null;
  }, [draft]);

  useEffect(() => {
    if (!open) return;
    setProtocolReference('');
    setReason('');
    setExpiresAt(defaultExpiry());
    setConfirmed(false);
  }, [open, draft?.id]);

  if (!draft) return null;
  const canSubmit = confirmed && reason.trim().length >= 10
    && (activeExceptionId ? true : protocolReference.trim().length >= 3 && Boolean(expiresAt));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-700" />{activeExceptionId ? 'Revocar excepción manual' : 'Excepción manual temporal'} · #{draft.reference}</DialogTitle>
          <DialogDescription>Solo procede para una reserva Terminada en Rently, no comunicada y respaldada por un protocolo verificable.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert className="border-amber-300 bg-amber-50 text-amber-950"><AlertTriangle className="h-4 w-4" /><AlertTitle>No elimina las demás comprobaciones</AlertTitle><AlertDescription>La excepción no omite matrícula, sucursal, transferencia, entrega real, completitud ni duplicados oficiales. Caduca automáticamente y queda asociada al usuario.</AlertDescription></Alert>
          {!activeExceptionId && <>
            <div className="space-y-2"><Label>Referencia del protocolo o incidencia</Label><Input value={protocolReference} onChange={(event) => setProtocolReference(event.target.value)} maxLength={120} /></div>
            <div className="space-y-2"><Label>Caducidad (máximo 7 días)</Label><Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div>
          </>}
          <div className="space-y-2"><Label>{activeExceptionId ? 'Motivo de revocación' : 'Justificación'}</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Describe la incidencia comprobada (mínimo 10 caracteres)" /></div>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} /><span>Confirmo que la información es verificable y que esta acción quedará registrada en la auditoría SES.</span></label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={activeExceptionId ? 'destructive' : 'default'} disabled={!canSubmit || saving} onClick={async () => {
            if (activeExceptionId) await onRevoke({ exceptionId: activeExceptionId, reason: reason.trim() });
            else await onCreate({ draftId: draft.id, protocolReference: protocolReference.trim(), reason: reason.trim(), expiresAt: new Date(expiresAt).toISOString() });
            onOpenChange(false);
          }}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{activeExceptionId ? 'Revocar excepción' : 'Registrar excepción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
