import { describe, expect, it } from 'vitest';
import { sanitizeSesFilterPreferences, serializeSesFilters, type SesDraftFilters } from './sesFilterPreferences';

const fallback: SesDraftFilters = {
  dateFrom: '2026-08-21',
  dateTo: '2026-09-27',
  status: 'all',
  search: '',
};

describe('SES filter preferences', () => {
  it('restores a valid filter set exactly', () => {
    expect(sanitizeSesFilterPreferences({
      dateFrom: '2026-07-01', dateTo: '2026-12-31', status: 'incomplete', search: '4990',
    }, fallback)).toEqual({
      dateFrom: '2026-07-01', dateTo: '2026-12-31', status: 'incomplete', search: '4990',
    });
  });

  it('rejects invalid dates and statuses without losing valid fields', () => {
    expect(sanitizeSesFilterPreferences({
      dateFrom: 'ayer', dateTo: '2026-09-30', status: 'desconocido', search: 'ABC',
    }, fallback)).toEqual({ ...fallback, dateTo: '2026-09-30', search: 'ABC' });
  });

  it('produces a stable representation for debounce comparisons', () => {
    expect(serializeSesFilters(fallback)).toBe(serializeSesFilters({ ...fallback }));
  });
});
