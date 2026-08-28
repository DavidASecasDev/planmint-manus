import { describe, expect, it } from 'vitest';
import { collectAllPages, evaluateSesEligibility, validateSesDateRange } from './eligibility';

const eligible = {
  visibleStatus: 'Entregado', rentlyStatusCode: 2, isTransfer: false,
  deliveryBranchOfficeId: 1, actualDeliveryAt: '2026-08-28T08:00:00Z',
  externalBookingId: '100', detailBookingId: 100,
  reservationPlate: '1234-BCD', detailVehiclePlate: '1234BCD',
};

describe('SES eligibility', () => {
  it('requires every P0 gate simultaneously', () => {
    expect(evaluateSesEligibility(eligible, new Date('2026-08-28T09:00:00Z')).eligible).toBe(true);
    expect(evaluateSesEligibility({ ...eligible, visibleStatus: 'En curso' }, new Date('2026-08-28T09:00:00Z')).eligible).toBe(true);
    expect(evaluateSesEligibility({ ...eligible, isTransfer: true }).eligible).toBe(false);
    expect(evaluateSesEligibility({ ...eligible, deliveryBranchOfficeId: 2 }).eligible).toBe(false);
    expect(evaluateSesEligibility({ ...eligible, actualDeliveryAt: '2026-08-29T08:00:00Z' }, new Date('2026-08-28T09:00:00Z')).eligible).toBe(false);
    expect(evaluateSesEligibility({ ...eligible, detailVehiclePlate: '9999XYZ' }).eligible).toBe(false);
    expect(evaluateSesEligibility({ ...eligible, detailBookingId: 101 }).eligible).toBe(false);
  });

  it('routes terminated never-reported reservations to manual review', () => {
    const result = evaluateSesEligibility({ ...eligible, visibleStatus: 'Terminada', rentlyStatusCode: 3 });
    expect(result.eligible).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toContain('terminated_never_reported');
    expect(evaluateSesEligibility({ ...eligible, visibleStatus: 'Completada', rentlyStatusCode: 3 }).requiresReview).toBe(true);
  });

  it('validates ordering and a bounded inclusive range', () => {
    expect(validateSesDateRange('2026-08-28', '2026-08-27').valid).toBe(false);
    expect(validateSesDateRange('2026-01-01', '2026-12-31').valid).toBe(false);
    expect(validateSesDateRange('2026-08-01', '2026-10-31').valid).toBe(true);
  });

  it('collects more than 500 rows without silent truncation', async () => {
    const source = Array.from({ length: 1_203 }, (_, index) => index + 1);
    const result = await collectAllPages(async (from, to) => source.slice(from, to + 1), 500);
    expect(result).toHaveLength(1_203);
    expect(result.at(-1)).toBe(1_203);
  });
});
