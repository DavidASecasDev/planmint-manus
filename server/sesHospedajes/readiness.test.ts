import { describe, expect, it } from 'vitest';
import { assertUniqueSesExportSelection, deriveSesGateState } from './readiness';

const clear = { status: 'clear' as const, clear: true, reasons: [], matchingCommunicationCode: null };

describe('SES readiness gates', () => {
  it('requires complete, eligible and officially clear simultaneously', () => {
    expect(deriveSesGateState({ validationIssueCount: 0, eligible: true, officialClearance: clear })).toMatchObject({
      isComplete: true, isEligible: true, isOfficiallyClear: true, readyForXml: true, status: 'ready',
    });
    expect(deriveSesGateState({ validationIssueCount: 1, eligible: true, officialClearance: clear }).readyForXml).toBe(false);
    expect(deriveSesGateState({ validationIssueCount: 0, eligible: false, officialClearance: clear }).readyForXml).toBe(false);
  });

  it('routes official duplicates to review instead of ready', () => {
    const blocked = { status: 'blocked' as const, clear: false, reasons: ['duplicate'], matchingCommunicationCode: 'official' };
    expect(deriveSesGateState({ validationIssueCount: 0, eligible: true, officialClearance: blocked })).toMatchObject({
      readyForXml: false, status: 'requires_review',
    });
  });

  it('rejects duplicate ids and duplicate references before XML generation', () => {
    expect(() => assertUniqueSesExportSelection(['a', 'a'])).toThrow('mismo contrato');
    expect(() => assertUniqueSesExportSelection(['a', 'b'], ['100', '100'])).toThrow('referencias');
    expect(() => assertUniqueSesExportSelection(['a', 'b'], ['100', '101'])).not.toThrow();
  });
});
