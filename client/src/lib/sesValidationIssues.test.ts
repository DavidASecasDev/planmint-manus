import { describe, expect, it } from 'vitest';
import type { SesContractDraft } from '@/types/sesHospedajes';
import { getActionableSesIssues } from './sesValidationIssues';

function draftWithIssues(paths: string[]): SesContractDraft {
  const sharedPerson = { id: 'person-1' };
  return {
    holder: sharedPerson,
    primary_driver: sharedPerson,
    validation_errors: paths.map((path) => ({ path, code: 'required', message: 'Falta el código postal' })),
  } as SesContractDraft;
}

describe('SES actionable validation issues', () => {
  it('counts one missing postal code when holder and driver are the same profile', () => {
    const issues = getActionableSesIssues(draftWithIssues([
      'payment_type',
      'pickup_location.postal_code',
      'return_location.postal_code',
      'holder.postal_code',
      'primary_driver.postal_code',
    ]));
    expect(issues).toHaveLength(4);
    expect(issues.filter((issue) => issue.section === 'person')).toHaveLength(1);
    expect(issues.find((issue) => issue.section === 'person')?.sourcePaths).toEqual([
      'holder.postal_code',
      'primary_driver.postal_code',
    ]);
  });

  it('keeps the same field separate for two different people', () => {
    const draft = draftWithIssues(['holder.postal_code', 'primary_driver.postal_code']);
    draft.primary_driver = { id: 'person-2' } as SesContractDraft['primary_driver'];
    expect(getActionableSesIssues(draft)).toHaveLength(2);
  });
});
