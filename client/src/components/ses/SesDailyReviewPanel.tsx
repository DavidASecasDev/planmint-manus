import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  AlertTriangle, CalendarRange, CheckCircle2, Clock3, ExternalLink, FileCheck2,
  History, Loader2, Play, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { useSesDailyReview } from '@/hooks/useSesHospedajes';
import type { SesReviewBatch, SesReviewConflict, SesReviewItem, SesReviewProposal } from '@/types/sesHospedajes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSesProposalTargets, getSesReviewIssueLabels, sesDisplayValue, sesFieldLabel, SesFoundDataDialog } from './SesFoundDataDialog';

const STATUS_LABELS: Record<string, string> = {
  queued: 'En cola', running: 'En curso', partial: 'Pendiente de revisión', completed: 'Completado', failed: 'Interrumpido', cancelled: 'Cancelado',
  pending: 'Pendiente', verified_delivery: 'Entrega acreditada', missing_delivery_evidence: 'Falta justificante',
  outside_period: 'Excluida: otro periodo', date_mismatch: 'Fecha contradictoria', evidence_conflict: 'Contradicción de evidencia',
};

function dateInput(value: Date) { return format(value, 'yyyy-MM-dd'); }
function literalDate(value?: string | null) {
  if (!value) return '—';
  return value.replace('T', ' ').replace(/Z$/, ' UTC');
}

function statusBadge(status: string) {
  const tone = status === 'completed' || status === 'verified_delivery'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'failed' || status === 'evidence_conflict'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  return <Badge className={`${tone} hover:bg-inherit`}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function ReviewBatchList({ batches, selectedId, onSelect }: {
  batches: SesReviewBatch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {batches.map((batch) => (
        <button
          type="button"
          key={batch.id}
          onClick={() => onSelect(batch.id)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === batch.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-900">{batch.batch_kind === 'daily' ? batch.review_date : `${batch.historical_from} → ${batch.historical_to}`}</span>
            {statusBadge(batch.status)}
          </div>
          <p className="mt-1 text-xs text-slate-500">{batch.verified_count} acreditadas · {batch.pending_count} pendientes · {batch.error_count} errores</p>
        </button>
      ))}
      {!batches.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">Todavía no hay lotes de revisión.</p>}
    </div>
  );
}

function EvidenceDialog({ batchId, item, open, onOpenChange, onSave, saving }: {
  batchId: string;
  item: SesReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { batchId: string; itemId: string; evidenceReference: string; evidenceGeneratedLiteral: string }) => Promise<unknown>;
  saving: boolean;
}) {
  const [reference, setReference] = useState('');
  const [generated, setGenerated] = useState('');
  useEffect(() => {
    setReference(item?.evidence_reference ?? '');
    setGenerated(item?.evidence_generated_literal ?? '');
  }, [item, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Acreditar justificante Delivery</DialogTitle><DialogDescription>Registra la referencia y el literal visible de generación. No se descarga ni inventa ningún PDF.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Referencia del justificante</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Delivery 0000.pdf" /></div>
          <div className="space-y-2"><Label>Fecha y hora literal</Label><Input value={generated} onChange={(event) => setGenerated(event.target.value)} placeholder="2026-09-09T23:05:19.643" /><p className="text-xs text-slate-500">Si no incluye zona, se interpreta explícitamente con semántica Europe/Madrid.</p></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving || !item || reference.trim().length < 3 || generated.trim().length < 19} onClick={async () => { if (!item) return; await onSave({ batchId, itemId: item.id, evidenceReference: reference.trim(), evidenceGeneratedLiteral: generated.trim() }); onOpenChange(false); }}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar evidencia</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposalDecisionDialog({ proposal, item, open, onOpenChange, onDecide, saving }: {
  proposal: SesReviewProposal | null;
  item: SesReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecide: (input: { proposalId: string; decision: 'accept' | 'reject'; reason: string }) => Promise<unknown>;
  saving: boolean;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [proposal, open]);
  const target = getSesProposalTargets(item).find((candidate) => candidate.type === proposal?.target_type && candidate.id === proposal?.target_id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Decidir propuesta externa</DialogTitle><DialogDescription>La aceptación solo rellena campos vacíos. Cualquier valor distinto queda como contradicción y nunca sustituye una corrección manual.</DialogDescription></DialogHeader>
        <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">Destinatario: {target?.label ?? proposal?.target_type}</p><p>Fuente: {proposal?.source}</p><p className="mt-1 break-all text-xs text-slate-500">Referencia: {proposal?.external_submission_id}</p></div>
        <div className="max-h-56 overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Campo</TableHead><TableHead>Actual</TableHead><TableHead>Propuesto</TableHead></TableRow></TableHeader><TableBody>{Object.entries(proposal?.payload ?? {}).map(([field, value]) => <TableRow key={field}><TableCell>{sesFieldLabel(field)}</TableCell><TableCell className="max-w-40 break-words">{sesDisplayValue(target?.values[field])}</TableCell><TableCell className="max-w-40 break-words font-medium">{sesDisplayValue(value)}</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="space-y-2"><Label>Motivo de la decisión</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe la comprobación realizada" /></div>
        <DialogFooter className="gap-2"><Button variant="outline" disabled={saving || reason.trim().length < 3 || !proposal} onClick={async () => { if (!proposal) return; await onDecide({ proposalId: proposal.id, decision: 'reject', reason: reason.trim() }); onOpenChange(false); }}>Rechazar</Button><Button disabled={saving || reason.trim().length < 3 || !proposal} onClick={async () => { if (!proposal) return; await onDecide({ proposalId: proposal.id, decision: 'accept', reason: reason.trim() }); onOpenChange(false); }}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aceptar con control de conflictos</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictResolutionDialog({ item, open, onOpenChange, onResolve, saving }: {
  item: SesReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (input: { itemId: string; conflictKey: string; reason: string; evidenceReference: string }) => Promise<unknown>;
  saving: boolean;
}) {
  const openConflicts = (item?.conflicts ?? []).filter((conflict) => conflict.status !== 'resolved');
  const [conflictKey, setConflictKey] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  useEffect(() => {
    setConflictKey(openConflicts[0]?.conflictKey ?? '');
    setReason('');
    setEvidenceReference('');
  }, [item?.id, open]);
  const conflict = openConflicts.find((candidate) => candidate.conflictKey === conflictKey) ?? null;
  const targets = getSesProposalTargets(item);
  const target = targets.find((candidate) => candidate.type === (conflict?.targetType ?? 'draft')
    && (!conflict?.targetId || candidate.id === conflict.targetId));
  const currentValue = conflict?.field ? target?.values[conflict.field] : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Resolver contradicción revisada</DialogTitle><DialogDescription>Primero corrige el dato en «Abrir expediente». Esta acción verifica que el valor actual cambió, conserva el historial y registra motivo, actor y evidencia.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Contradicción abierta</Label><Select value={conflictKey} onValueChange={setConflictKey}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{openConflicts.map((candidate: SesReviewConflict) => <SelectItem key={candidate.conflictKey} value={candidate.conflictKey}>{sesFieldLabel(candidate.field ?? candidate.code ?? 'Contradicción')}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Anterior</p><p className="break-words text-sm">{sesDisplayValue(conflict?.currentValue)}</p></div><div><p className="text-xs text-slate-500">Propuesto</p><p className="break-words text-sm">{sesDisplayValue(conflict?.proposedValue)}</p></div><div><p className="text-xs text-slate-500">Actual en expediente</p><p className="break-words text-sm font-semibold">{sesDisplayValue(currentValue)}</p></div></div>
          <div className="space-y-2"><Label>Motivo de resolución</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe la corrección y comprobación" /></div>
          <div className="space-y-2"><Label>Referencia de evidencia</Label><Input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} placeholder="Documento, ticket o comprobación verificable" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving || !item || !conflict || reason.trim().length < 3 || evidenceReference.trim().length < 3} onClick={async () => { if (!item || !conflict) return; await onResolve({ itemId: item.id, conflictKey: conflict.conflictKey, reason: reason.trim(), evidenceReference: evidenceReference.trim() }); onOpenChange(false); }}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Resolver y auditar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SesDailyReviewPanel({ open, onOpenChange, canEdit, onOpenDraft }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onOpenDraft: (item: SesReviewItem) => void;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const review = useSesDailyReview(selectedBatchId, open);
  const [reviewDate, setReviewDate] = useState(() => dateInput(subDays(new Date(), 1)));
  const [historicalFrom, setHistoricalFrom] = useState(() => dateInput(subDays(new Date(), 7)));
  const [historicalTo, setHistoricalTo] = useState(() => dateInput(subDays(new Date(), 1)));
  const [evidenceItem, setEvidenceItem] = useState<SesReviewItem | null>(null);
  const [proposalContext, setProposalContext] = useState<{ proposal: SesReviewProposal; item: SesReviewItem } | null>(null);
  const [foundDataItem, setFoundDataItem] = useState<SesReviewItem | null>(null);
  const [conflictItem, setConflictItem] = useState<SesReviewItem | null>(null);
  const [gmailReference, setGmailReference] = useState('');

  useEffect(() => {
    if (!selectedBatchId && review.batches.length) setSelectedBatchId(review.batches[0].id);
  }, [review.batches, selectedBatchId]);
  useEffect(() => setGmailReference(review.batch?.gmail_draft_reference ?? ''), [review.batch?.gmail_draft_reference]);

  const progressValue = useMemo(() => {
    const processed = review.batch?.processed_count ?? 0;
    const total = review.batch?.candidate_count ?? 0;
    return total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  }, [review.batch]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,1500px)] overflow-hidden p-0">
          <DialogHeader className="border-b bg-slate-950 px-6 py-5 text-white">
            <DialogTitle className="flex items-center gap-2 text-xl"><FileCheck2 className="h-5 w-5 text-amber-400" />Revisar entregas</DialogTitle>
            <DialogDescription className="text-slate-300">Revisa las entregas del periodo, completa datos acreditados y conserva separadas las fechas previstas.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(92vh-104px)]">
            <div className="space-y-5 p-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto]">
                <div className="space-y-2"><Label>Revisión diaria</Label><Input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></div>
                <Button className="self-end" disabled={!canEdit || review.startDaily.isPending} onClick={() => review.startDaily.mutate({ reviewDate })}>{review.startDaily.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Revisar ahora</Button>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>Histórico desde</Label><Input type="date" value={historicalFrom} onChange={(event) => setHistoricalFrom(event.target.value)} /></div><div className="space-y-2"><Label>Hasta</Label><Input type="date" value={historicalTo} onChange={(event) => setHistoricalTo(event.target.value)} /></div></div>
                <Button variant="outline" className="self-end" disabled={!canEdit || review.startHistorical.isPending || historicalTo < historicalFrom} onClick={() => review.startHistorical.mutate({ dateFrom: historicalFrom, dateTo: historicalTo })}><CalendarRange className="mr-2 h-4 w-4" />Iniciar histórico</Button>
              </div>

              {review.error && <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>No se pudo cargar la revisión diaria</AlertTitle><AlertDescription>{review.error instanceof Error ? review.error.message : 'Error de lectura'}</AlertDescription></Alert>}

              <div className="grid min-h-[520px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="rounded-xl border bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900">Historial de lotes</h3><Button size="icon" variant="ghost" onClick={() => review.refetch()} aria-label="Actualizar lotes"><RefreshCw className="h-4 w-4" /></Button></div><ReviewBatchList batches={review.batches} selectedId={selectedBatchId} onSelect={setSelectedBatchId} /></aside>
                <section className="min-w-0 space-y-4">
                  {review.isLoading && <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>}
                  {!review.isLoading && review.batch && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-lg font-semibold">Periodo {review.batch.batch_kind === 'daily' ? review.batch.review_date : `${review.batch.historical_from} → ${review.batch.historical_to}`}</h3>{statusBadge(review.batch.status)}</div><p className="text-xs text-slate-500">Hora de negocio: Europe/Madrid · los literales originales no se redondean</p></div><Button disabled={!canEdit || review.continueReview.isPending || review.batch.status === 'completed'} onClick={() => review.continueReview.mutate(review.batch!.id)}>{review.continueReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Continuar / reintentar</Button></div>
                      <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs text-slate-500">Candidatas</p><p className="text-2xl font-bold">{review.batch.candidate_count}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-emerald-700">Entrega acreditada</p><p className="text-2xl font-bold text-emerald-800">{review.batch.verified_count}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-amber-700">Pendientes</p><p className="text-2xl font-bold text-amber-800">{review.batch.pending_count}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-rose-700">Errores</p><p className="text-2xl font-bold text-rose-800">{review.batch.error_count}</p></CardContent></Card></div>
                      <div className="space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Progreso persistido</span><span>{progressValue}%</span></div><Progress value={progressValue} /></div>
                      {!review.batch.coverage_complete && <Alert className="border-amber-200 bg-amber-50 text-amber-950"><AlertTriangle className="h-4 w-4" /><AlertTitle>Cobertura todavía no confirmada</AlertTitle><AlertDescription>{review.batch.progress?.coverageReason ?? 'Quedan páginas, fuentes o una sincronización Rently completa posterior al periodo.'} No se interpreta como ausencia de datos.</AlertDescription></Alert>}
                      <div className="overflow-hidden rounded-xl border"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Reserva</TableHead><TableHead>Fechas</TableHead><TableHead>Evidencia</TableHead><TableHead>Faltantes / contradicciones</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>
                        {(review.batch.items ?? []).map((item) => {
                          const proposed = item.proposals?.filter((entry) => entry.status === 'proposed') ?? [];
                          const issues = getSesReviewIssueLabels(item);
                          const openConflicts = item.conflicts.filter((conflict) => conflict.status !== 'resolved');
                          return <TableRow key={item.id}><TableCell><p className="font-semibold">#{item.external_booking_id}</p>{statusBadge(item.status)}{item.is_transfer && <p className="mt-1 text-xs text-slate-500">Transferencia excluible</p>}</TableCell><TableCell className="min-w-52"><p className="text-xs text-slate-500">Prevista</p><p className="font-mono text-xs">{literalDate(item.planned_from_literal)}</p><p className="mt-2 text-xs text-slate-500">Entrega real</p><p className="font-mono text-xs font-semibold text-slate-900">{literalDate(item.delivery_actual_literal)}</p><p className="mt-2 text-xs text-slate-500">Devolución</p><p className="font-mono text-xs">{literalDate(item.dropoff_actual_literal)}</p></TableCell><TableCell className="min-w-52"><p className="text-sm font-medium">{item.evidence_reference || 'Sin referencia'}</p><p className="font-mono text-xs text-slate-500">{literalDate(item.evidence_generated_literal)}</p><div className="mt-2 flex flex-wrap gap-1">{item.sources?.map((source) => <Badge key={source.id} variant="outline" className="text-[10px]">{source.source}: {source.status}</Badge>)}</div></TableCell><TableCell><div className="space-y-1"><p className={issues.missing.length ? 'text-sm font-medium text-amber-700' : 'text-sm text-slate-400'}>Faltantes: {issues.missing.length}</p>{issues.missing.map((label) => <p key={label} className="max-w-64 text-xs text-amber-700">{label}</p>)}<p className={issues.conflicts.length ? 'text-sm font-medium text-rose-700' : 'text-sm text-slate-400'}>Contradicciones abiertas: {issues.conflicts.length}</p>{issues.conflicts.map((label) => <p key={label} className="max-w-64 text-xs text-rose-600">{label}</p>)}{issues.resolvedCount > 0 && <p className="text-xs text-emerald-700">Resueltas y auditadas: {issues.resolvedCount}</p>}{item.next_action && <p className="max-w-64 text-xs text-slate-500">Siguiente: {item.next_action}</p>}{proposed.length > 0 && <button type="button" className="text-xs font-medium text-blue-700 underline" onClick={() => setProposalContext({ proposal: proposed[0], item })}>{proposed.length} propuesta(s) por decidir</button>}</div></TableCell><TableCell className="text-right"><div className="flex flex-col items-end gap-2"><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setEvidenceItem(item)}><FileCheck2 className="mr-2 h-3.5 w-3.5" />Acreditar</Button><Button size="sm" variant="outline" disabled={!canEdit || !item.draft_id} onClick={() => setFoundDataItem(item)}>Añadir dato encontrado</Button>{item.draft_id && <Button size="sm" variant="ghost" onClick={() => onOpenDraft(item)}><ExternalLink className="mr-2 h-3.5 w-3.5" />Abrir expediente</Button>}{openConflicts.length > 0 && <Button size="sm" disabled={!canEdit || !item.draft_id} onClick={() => setConflictItem(item)}>Resolver contradicción</Button>}</div></TableCell></TableRow>;
                        })}
                        {!(review.batch.items ?? []).length && <TableRow><TableCell colSpan={5} className="h-36 text-center text-sm text-slate-500">Aún no hay ítems descubiertos en este lote.</TableCell></TableRow>}
                      </TableBody></Table></div>
                      <div className="rounded-xl border bg-slate-50 p-4"><div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-5 w-5 text-slate-500" /><div className="min-w-0 flex-1"><h4 className="font-medium">Seguimiento externo sin envío automático</h4><p className="text-xs text-slate-500">Guarda solo la referencia de un borrador de Gmail creado fuera de PlanMint. Este módulo no envía correos ni mensajes.</p><div className="mt-3 flex gap-2"><Input value={gmailReference} onChange={(event) => setGmailReference(event.target.value)} placeholder="Referencia del borrador" /><Button variant="outline" disabled={!canEdit || gmailReference.trim().length < 3 || review.recordGmailDraft.isPending} onClick={() => review.recordGmailDraft.mutate({ batchId: review.batch!.id, gmailDraftReference: gmailReference.trim() })}>Guardar referencia</Button></div></div></div></div>
                    </>
                  )}
                  {!review.isLoading && !review.batch && <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed text-center"><History className="mb-3 h-9 w-9 text-slate-300" /><p className="font-medium text-slate-700">Selecciona o inicia un lote</p><p className="mt-1 text-sm text-slate-500">Los lotes terminados se reutilizan para el mismo periodo.</p></div>}
                </section>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <EvidenceDialog batchId={review.batch?.id ?? ''} item={evidenceItem} open={Boolean(evidenceItem)} onOpenChange={(next) => !next && setEvidenceItem(null)} onSave={(input) => review.accreditEvidence.mutateAsync(input)} saving={review.accreditEvidence.isPending} />
      <ProposalDecisionDialog proposal={proposalContext?.proposal ?? null} item={proposalContext?.item ?? null} open={Boolean(proposalContext)} onOpenChange={(next) => !next && setProposalContext(null)} onDecide={(input) => review.decideProposal.mutateAsync(input)} saving={review.decideProposal.isPending} />
      <SesFoundDataDialog batchId={review.batch?.id ?? ''} item={foundDataItem} open={Boolean(foundDataItem)} onOpenChange={(next) => !next && setFoundDataItem(null)} onSave={(input) => review.submitProposal.mutateAsync(input)} saving={review.submitProposal.isPending} />
      <ConflictResolutionDialog item={conflictItem} open={Boolean(conflictItem)} onOpenChange={(next) => !next && setConflictItem(null)} onResolve={(input) => review.resolveConflict.mutateAsync(input)} saving={review.resolveConflict.isPending} />
    </>
  );
}
