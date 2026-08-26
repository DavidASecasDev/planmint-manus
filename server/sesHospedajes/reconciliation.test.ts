import { describe, expect, it } from 'vitest';
import { deriveSesBatchOutcome } from './sesEndpoints';

describe('SES batch reconciliation', () => {
  it('marks a fully accepted batch as accepted', () => {
    expect(deriveSesBatchOutcome(3, 3, 0)).toBe('accepted');
  });

  it('marks a fully rejected batch as error', () => {
    expect(deriveSesBatchOutcome(2, 0, 2)).toBe('error');
  });

  it('marks mixed results as partially accepted', () => {
    expect(deriveSesBatchOutcome(4, 3, 1)).toBe('partially_accepted');
  });

  it('rejects incomplete or inconsistent totals', () => {
    expect(() => deriveSesBatchOutcome(3, 1, 1)).toThrow('cubrir todos');
    expect(() => deriveSesBatchOutcome(0, 0, 0)).toThrow('cubrir todos');
  });
});
