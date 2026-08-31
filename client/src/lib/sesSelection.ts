import type { SesContractDraft } from '@/types/sesHospedajes';

export function canSelectSesDraftForXml(draft: Pick<SesContractDraft, 'operationalStatus' | 'readyForXml' | 'sesDuplicateWarning'>) {
  return draft.operationalStatus === 'ready' && draft.readyForXml;
}
