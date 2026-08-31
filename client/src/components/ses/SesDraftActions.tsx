import React from 'react';
import { SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SesContractDraft } from '@/types/sesHospedajes';

const LOCKED_STATUSES = new Set(['batched', 'uploaded_pending_result', 'accepted']);

export function SesDraftActions({
  draft, canExport, schemaMigrationRequired, checking, onCheck, onComplete,
}: {
  draft: SesContractDraft;
  canExport: boolean;
  schemaMigrationRequired: boolean;
  checking: boolean;
  onCheck: () => void;
  onComplete: () => void;
}) {
  const locked = draft.operationalStatus === 'xml_generated' || LOCKED_STATUSES.has(draft.status);
  return <div className="flex flex-wrap justify-end gap-1">
    {canExport && !locked && <Button size="sm" variant="outline" disabled={schemaMigrationRequired || checking} onClick={(event) => { event.stopPropagation(); onCheck(); }}><SearchCheck className="mr-1 h-4 w-4" />Comprobar SES</Button>}
    <Button size="sm" variant="outline" disabled={schemaMigrationRequired || locked} onClick={(event) => { event.stopPropagation(); onComplete(); }}>{schemaMigrationRequired ? 'Solo lectura' : locked ? 'Histórico' : draft.operationalStatus === 'ready' ? 'Revisar' : 'Completar'}</Button>
  </div>;
}
