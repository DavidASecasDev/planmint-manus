import React from 'react';
import { SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SesContractDraft } from '@/types/sesHospedajes';

const LOCKED_STATUSES = new Set(['batched', 'uploaded_pending_result', 'accepted']);

export function SesDraftActions({
  draft, canExport, schemaMigrationRequired, checking, onCheck, onComplete, onException,
}: {
  draft: SesContractDraft;
  canExport: boolean;
  schemaMigrationRequired: boolean;
  checking: boolean;
  onCheck: () => void;
  onComplete: () => void;
  onException?: () => void;
}) {
  const locked = LOCKED_STATUSES.has(draft.status);
  const canUseException = canExport && !locked && (
    draft.eligibility_errors?.some((issue) => issue.code === 'terminated_never_reported')
    || typeof draft.eligibility_snapshot?.manual_exception_id === 'string'
  );
  return <div className="flex flex-wrap justify-end gap-1">
    {canExport && !locked && <Button size="sm" variant="outline" disabled={schemaMigrationRequired || checking} onClick={(event) => { event.stopPropagation(); onCheck(); }}><SearchCheck className="mr-1 h-4 w-4" />Comprobar SES</Button>}
    <Button size="sm" variant="outline" disabled={schemaMigrationRequired || locked} onClick={(event) => { event.stopPropagation(); onComplete(); }}>{schemaMigrationRequired ? 'Solo lectura' : locked ? 'Bloqueado' : draft.status === 'ready' ? 'Revisar' : 'Completar'}</Button>
    {canUseException && onException && <Button size="sm" variant="outline" disabled={schemaMigrationRequired} onClick={(event) => { event.stopPropagation(); onException(); }}>{typeof draft.eligibility_snapshot?.manual_exception_id === 'string' ? 'Revocar excepción' : 'Excepción'}</Button>}
  </div>;
}
