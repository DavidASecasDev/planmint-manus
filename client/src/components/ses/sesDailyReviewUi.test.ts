import { describe, expect, it } from 'vitest';
import { getSesReviewCoveragePercentage, resolveSesReviewSubmittedRange } from './sesDailyReviewUi';

describe('SES daily review UI state', () => {
  it('submits the date visible after native fill even if React state still contains the previous value', () => {
    expect(resolveSesReviewSubmittedRange({
      dateFromState: '2026-09-08', dateToState: '2026-09-14',
      dateFromVisible: '2026-09-09', dateToVisible: '2026-09-14',
    })).toEqual({ dateFrom: '2026-09-09', dateTo: '2026-09-14' });
  });

  it('keeps the keyboard-confirmed range after an unrelated data refresh and falls back safely without DOM refs', () => {
    expect(resolveSesReviewSubmittedRange({
      dateFromState: '2026-09-09', dateToState: '2026-09-14',
      dateFromVisible: '2026-09-09', dateToVisible: '2026-09-14',
    })).toEqual({ dateFrom: '2026-09-09', dateTo: '2026-09-14' });
    expect(resolveSesReviewSubmittedRange({
      dateFromState: '2026-09-09', dateToState: '2026-09-14',
    })).toEqual({ dateFrom: '2026-09-09', dateTo: '2026-09-14' });
  });

  it('never presents known-candidate completion as confirmed global coverage', () => {
    expect(getSesReviewCoveragePercentage(false)).toBe(0);
    expect(getSesReviewCoveragePercentage(true)).toBe(100);
  });
});
