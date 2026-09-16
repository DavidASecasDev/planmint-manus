import type { SesContractDraft } from '@/types/sesHospedajes';

export function canSelectSesDraftForXml(draft: Pick<SesContractDraft, 'operationalStatus' | 'readyForXml' | 'sesDuplicateWarning' | 'cancellationDisposition'>) {
  if (draft.cancellationDisposition?.blocksXml) return false;
  if (['cancelled_not_applicable', 'cancellation_review', 'source_check_required'].includes(draft.operationalStatus)) return false;
  return draft.operationalStatus === 'ready' && draft.readyForXml;
}
