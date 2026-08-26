import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Loader2, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { SesBatch } from '@/types/sesHospedajes';

type ResultRow = { status: 'accepted' | 'error'; code: string; message: string };

const BATCH_STATUS: Record<string, { label: string; className: string }> = {
  generated: { label: 'Generado', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  downloaded: { label: 'Descargado', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  uploaded_pending_result: { label: 'Subido · pendiente', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  partially_accepted: { label: 'Aceptación parcial', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  accepted: { label: 'Aceptado', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  error: { label: 'Con errores', className: 'border-red-200 bg-red-50 text-red-700' },
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function officialLotCode(notes: string | null) {
  return notes?.match(/Código oficial de lote:\s*([0-9a-f-]{36})/i)?.[1] ?? null;
}

export function SesBatchPanel({
  batches,
  loading,
  canManage,
  savingUpload,
  savingResult,
  onMarkUploaded,
  onRecordResult,
}: {
  batches: SesBatch[];
  loading: boolean;
  canManage: boolean;
  savingUpload: boolean;
  savingResult: boolean;
  onMarkUploaded: (input: { batchId: string; officialLotCode: string; notes?: string | null }) => Promise<unknown>;
  onRecordResult: (input: {
    batchId: string;
    acceptedDraftIds: string[];
    errors: Array<{ draftId: string; code?: string | null; message: string }>;
    notes?: string | null;
  }) => Promise<unknown>;
}) {
  const [uploadBatch, setUploadBatch] = useState<SesBatch | null>(null);
  const [resultBatch, setResultBatch] = useState<SesBatch | null>(null);
  const [lotCode, setLotCode] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [rows, setRows] = useState<Record<string, ResultRow>>({});

  useEffect(() => {
    if (!uploadBatch) return;
    setLotCode(officialLotCode(uploadBatch.notes) ?? '');
    setUploadNotes('');
  }, [uploadBatch]);

  useEffect(() => {
    if (!resultBatch) return;
    setRows(Object.fromEntries(resultBatch.items.map((item) => [item.draft_id, {
      status: item.result_status === 'error' ? 'error' : 'accepted',
      code: item.result_code ?? '',
      message: item.result_message ?? '',
    }])));
    setResultNotes('');
  }, [resultBatch]);

  const resultCanSave = useMemo(() => resultBatch?.items.every((item) => {
    const row = rows[item.draft_id];
    return row && (row.status === 'accepted' || row.message.trim().length > 0);
  }) ?? false, [resultBatch, rows]);

  return (
    <>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-5 w-5 text-blue-700" />Lotes y resultados</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Registra el código del portal y concilia la aceptación o los errores de cada contrato.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow><TableHead>Generado</TableHead><TableHead>Archivo / lote oficial</TableHead><TableHead>Contratos</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5}><Skeleton className="h-12 w-full" /></TableCell></TableRow>}
              {!loading && batches.slice(0, 10).map((batch) => {
                const status = BATCH_STATUS[batch.status] ?? { label: batch.status, className: '' };
                const code = officialLotCode(batch.notes);
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(batch.generated_at)}</TableCell>
                    <TableCell><div className="max-w-64 truncate font-medium text-slate-800">{batch.file_name}</div><div className="font-mono text-[11px] text-slate-500">{code ?? 'Sin código oficial'}</div></TableCell>
                    <TableCell><div className="text-sm font-medium">{batch.item_count}</div>{batch.result_recorded_at && <div className="text-xs text-slate-500">{batch.accepted_count} aceptados · {batch.error_count} errores</div>}</TableCell>
                    <TableCell><Badge variant="outline" className={status.className}>{status.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canManage && batch.status === 'downloaded' && <Button size="sm" variant="outline" onClick={() => setUploadBatch(batch)}><UploadCloud className="mr-2 h-4 w-4" />Registrar subida</Button>}
                      {canManage && ['uploaded_pending_result', 'partially_accepted', 'accepted', 'error'].includes(batch.status) && <Button size="sm" variant="outline" onClick={() => setResultBatch(batch)}><CheckCircle2 className="mr-2 h-4 w-4" />{batch.result_recorded_at ? 'Revisar resultado' : 'Registrar resultado'}</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && batches.length === 0 && <TableRow><TableCell colSpan={5} className="h-28 text-center text-sm text-slate-500">Todavía no se ha generado ningún lote XML.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(uploadBatch)} onOpenChange={(open) => !open && setUploadBatch(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Registrar subida manual</DialogTitle><DialogDescription>Copia el código de lote que muestra SES.HOSPEDAJES después de recibir el XML.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2"><div className="space-y-2"><Label>Código oficial del lote</Label><Input value={lotCode} onChange={(event) => setLotCode(event.target.value.trim())} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono" /></div><div className="space-y-2"><Label>Notas opcionales</Label><Textarea value={uploadNotes} onChange={(event) => setUploadNotes(event.target.value)} placeholder="Observaciones del acuse de envío" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setUploadBatch(null)}>Cancelar</Button><Button disabled={savingUpload || lotCode.length !== 36} onClick={async () => { if (!uploadBatch) return; await onMarkUploaded({ batchId: uploadBatch.id, officialLotCode: lotCode, notes: uploadNotes || null }); setUploadBatch(null); }}>{savingUpload && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar acuse</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resultBatch)} onOpenChange={(open) => !open && setResultBatch(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Conciliar resultado del lote</DialogTitle><DialogDescription>Marca cada contrato según el resultado mostrado en “Mis comunicaciones → Lote”. No supongas una aceptación si el portal aún está procesando.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            {resultBatch?.items.map((item) => {
              const row = rows[item.draft_id] ?? { status: 'accepted', code: '', message: '' };
              return <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">Contrato #{item.draft?.reference ?? item.item_order}</p><p className="text-xs text-slate-500">Versión {item.draft_version}</p></div><Select value={row.status} onValueChange={(value: 'accepted' | 'error') => setRows((current) => ({ ...current, [item.draft_id]: { ...row, status: value } }))}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="accepted">Aceptado</SelectItem><SelectItem value="error">Con error</SelectItem></SelectContent></Select></div>{row.status === 'error' && <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]"><Input value={row.code} onChange={(event) => setRows((current) => ({ ...current, [item.draft_id]: { ...row, code: event.target.value } }))} placeholder="Código (opcional)" /><Textarea value={row.message} onChange={(event) => setRows((current) => ({ ...current, [item.draft_id]: { ...row, message: event.target.value } }))} placeholder="Mensaje exacto del portal" /></div>}</div>;
            })}
            <div className="space-y-2"><Label>Notas generales opcionales</Label><Textarea value={resultNotes} onChange={(event) => setResultNotes(event.target.value)} placeholder="Observaciones sobre el procesamiento del lote" /></div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />Si el portal indica que sigue procesando, cierra este diálogo y vuelve a comprobarlo más tarde.</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setResultBatch(null)}>Cancelar</Button><Button disabled={savingResult || !resultCanSave} onClick={async () => { if (!resultBatch) return; const acceptedDraftIds = resultBatch.items.filter((item) => rows[item.draft_id]?.status === 'accepted').map((item) => item.draft_id); const errors = resultBatch.items.filter((item) => rows[item.draft_id]?.status === 'error').map((item) => ({ draftId: item.draft_id, code: rows[item.draft_id]?.code || null, message: rows[item.draft_id]?.message.trim() || '' })); await onRecordResult({ batchId: resultBatch.id, acceptedDraftIds, errors, notes: resultNotes || null }); setResultBatch(null); }}>{savingResult && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar resultado</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
