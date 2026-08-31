import { describe, expect, it } from 'vitest';
import { assertUniqueSesExportSelection, deriveSesGateState, isSesDraftLocked } from './readiness';

const clear = { status: 'clear' as const, clear: true, reasons: [], matchingCommunicationCode: null };

describe('SES readiness gates', () => {
  it('deriva listo únicamente de la ausencia de campos pendientes o inválidos', () => {
    expect(deriveSesGateState({ validationIssueCount: 0, eligible: true, officialClearance: clear })).toMatchObject({
      isComplete: true, isEligible: true, isOfficiallyClear: true, readyForXml: true, status: 'ready',
    });
    expect(deriveSesGateState({ validationIssueCount: 1, eligible: true, officialClearance: clear }).readyForXml).toBe(false);
    expect(deriveSesGateState({ validationIssueCount: 0, eligible: false, officialClearance: { status: 'blocked', clear: false, reasons: ['duplicada'] } })).toMatchObject({
      readyForXml: true, status: 'ready',
    });
  });

  it('conserva el duplicado oficial como metadato sin bloquear la disponibilidad', () => {
    const blocked = { status: 'blocked' as const, clear: false, reasons: ['duplicate'], matchingCommunicationCode: 'official' };
    expect(deriveSesGateState({ validationIssueCount: 0, eligible: true, officialClearance: blocked })).toMatchObject({
      readyForXml: true, status: 'ready', isOfficiallyClear: false,
    });
  });

  it('rejects duplicate ids and duplicate references before XML generation', () => {
    expect(() => assertUniqueSesExportSelection(['a', 'a'])).toThrow('mismo contrato');
    expect(() => assertUniqueSesExportSelection(['a', 'b'], ['100', '100'])).toThrow('referencias');
    expect(() => assertUniqueSesExportSelection(['a', 'b'], ['100', '101'])).not.toThrow();
  });

  it('keeps historical batch members and accepted drafts non-resendable regardless of reference', () => {
    for (const status of ['batched', 'uploaded_pending_result', 'accepted']) {
      expect(isSesDraftLocked(status)).toBe(true);
    }
    expect(isSesDraftLocked('ready')).toBe(false);
    expect(isSesDraftLocked('needs_revision')).toBe(false);
  });
});
