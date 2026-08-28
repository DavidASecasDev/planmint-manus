import { describe, expect, it } from 'vitest';
import { mergeSesFilterPreferences, readSesFilterPreferences } from './filterPreferences';

const filtersA = { dateFrom: '2026-08-01', dateTo: '2026-08-31', status: 'incomplete' as const, search: '4130' };
const filtersB = { dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'ready' as const, search: '' };

describe('SES account filter metadata', () => {
  it('keeps each account metadata independent', () => {
    const accountA = mergeSesFilterPreferences({ display_name: 'A' }, filtersA);
    const accountB = mergeSesFilterPreferences({ display_name: 'B' }, filtersB);
    expect(readSesFilterPreferences(accountA)).toEqual(filtersA);
    expect(readSesFilterPreferences(accountB)).toEqual(filtersB);
    expect(readSesFilterPreferences(accountA)).not.toEqual(readSesFilterPreferences(accountB));
  });

  it('preserves unrelated user metadata and PlanMint preferences', () => {
    const metadata = mergeSesFilterPreferences({
      display_name: 'Usuario',
      planmint_preferences: { another_module: { view: 'calendar' } },
    }, filtersA);
    expect(metadata.display_name).toBe('Usuario');
    expect((metadata.planmint_preferences as Record<string, unknown>).another_module).toEqual({ view: 'calendar' });
  });

  it('ignores malformed stored preferences safely', () => {
    expect(readSesFilterPreferences({ planmint_preferences: { ses_hospedajes_filters: { status: 'unknown' } } })).toBeNull();
  });
});
