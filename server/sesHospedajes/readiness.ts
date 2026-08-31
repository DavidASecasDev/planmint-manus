import type { SesOfficialClearance } from './officialInventory';

export type SesGateState = {
  isComplete: boolean;
  isEligible: boolean;
  isOfficiallyClear: boolean;
  readyForXml: boolean;
  status: 'pending_sync' | 'incomplete' | 'ready' | 'needs_revision';
};

export function isSesDraftLocked(status: unknown) {
  return ['batched', 'uploaded_pending_result', 'accepted'].includes(String(status));
}

export function deriveSesGateState(input: {
  validationIssueCount: number;
  eligible?: boolean;
  eligibilityRequiresReview?: boolean;
  officialClearance?: SesOfficialClearance;
}): SesGateState {
  const isComplete = input.validationIssueCount === 0;
  const isEligible = true;
  const isOfficiallyClear = input.officialClearance?.clear ?? false;
  const readyForXml = isComplete;
  const status = readyForXml ? 'ready' : 'incomplete';
  return { isComplete, isEligible, isOfficiallyClear, readyForXml, status };
}

export function assertUniqueSesExportSelection(ids: string[], references?: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new Error('La selección contiene el mismo contrato más de una vez');
  }
  if (references && new Set(references).size !== references.length) {
    throw new Error('La selección contiene referencias de contrato duplicadas');
  }
}
