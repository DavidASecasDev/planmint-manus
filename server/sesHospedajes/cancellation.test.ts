import { describe, expect, it } from 'vitest';
import { buildSesCancellationReconciliation, deriveSesCancellationDisposition, mergeSesCancellationSnapshot } from './cancellation';

describe('SES cancellation disposition', () => {
  it('classifies 5592 as cancelled and not applicable when no delivery or official fact exists', () => {
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 4 })).toMatchObject({
      kind: 'cancelled_not_applicable',
      blocksXml: true,
      suppressMissingFields: true,
      requiresReview: false,
    });
  });

  it('routes a cancellation after an accredited delivery to specific review', () => {
    expect(deriveSesCancellationDisposition({
      rentlyStatusCode: 4,
      actualDeliveryAt: '2026-09-09T17:56:39.05',
    })).toMatchObject({ kind: 'cancelled_requires_review', reasonCode: 'cancelled_with_delivery' });
  });

  it('preserves prior official or batch history as a cancellation review fact', () => {
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 4, officialCommunicationCount: 1 })).toMatchObject({
      kind: 'cancelled_requires_review', reasonCode: 'cancelled_with_official_history',
    });
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 4, hasHistoricalBatchItem: true }).requiresReview).toBe(true);
  });

  it('restores normal eligibility after an accredited reactivation without duplicating data', () => {
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 2, actualDeliveryAt: '2026-09-10T10:00:00' })).toMatchObject({
      kind: 'active_or_reactivated', blocksXml: false,
    });
  });

  it('never guesses cancellation when the source status is unknown or failed', () => {
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: null })).toMatchObject({
      kind: 'source_status_unknown', cancelled: false, requiresReview: true, blocksXml: true,
    });
    expect(deriveSesCancellationDisposition({ rentlyStatusCode: 'unknown' }).kind).toBe('source_status_unknown');
  });

  it('updates only the cancellation snapshot and preserves prior audit metadata', () => {
    expect(mergeSesCancellationSnapshot({ source_by_field: { vehicle_plate: 'manual' } },
      deriveSesCancellationDisposition({ rentlyStatusCode: 4 }), '2026-09-16T10:00:00.000Z')).toMatchObject({
      source_by_field: { vehicle_plate: 'manual' },
      cancellation: { kind: 'cancelled_not_applicable', checked_at: '2026-09-16T10:00:00.000Z' },
    });
  });

  it('reconciles an imported draft idempotently without losing manual fields or historical validation', () => {
    const existing = {
      status: 'incomplete', is_eligible: true, ready_for_xml: false,
      manual_fields: ['pickup_at', 'vehicle_plate'],
      validation_errors: [{ path: 'holder.postal_code', code: 'required' }],
      eligibility_snapshot: { source_by_field: { vehicle_plate: 'manual' } },
    };
    const first = buildSesCancellationReconciliation({
      existing, rentlyStatusCode: 4, checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(first).toMatchObject({ changed: true, values: {
      manual_fields: ['pickup_at', 'vehicle_plate'],
      validation_errors: [{ path: 'holder.postal_code', code: 'required' }],
      is_eligible: false, ready_for_xml: false,
    } });
    const repeated = buildSesCancellationReconciliation({
      existing: { ...existing, ...first.values }, rentlyStatusCode: 4, checkedAt: '2026-09-16T10:05:00.000Z',
    });
    expect(repeated.changed).toBe(false);
  });

  it('returns to the active path after reactivation without manufacturing a cancellation update', () => {
    const result = buildSesCancellationReconciliation({
      existing: { status: 'incomplete', eligibility_snapshot: { cancellation: { kind: 'cancelled_not_applicable' } } },
      rentlyStatusCode: 2,
      actualDeliveryAt: '2026-09-16T09:00:00',
      checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(result).toMatchObject({ changed: false, values: null, disposition: { kind: 'active_or_reactivated' } });
  });

  it('reconciles an unknown source status as review without guessing cancellation', () => {
    const result = buildSesCancellationReconciliation({
      existing: { status: 'ready', is_eligible: true, ready_for_xml: true, manual_fields: ['vehicle_plate'] },
      rentlyStatusCode: null,
      checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(result).toMatchObject({
      changed: true,
      disposition: { kind: 'source_status_unknown', cancelled: false },
      values: { status: 'needs_revision', is_eligible: false, ready_for_xml: false, manual_fields: ['vehicle_plate'] },
    });
  });
});
