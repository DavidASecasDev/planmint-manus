import { describe, expect, it } from 'vitest';
import { collectAllPages, evaluateSesEligibility, validateSesDateRange } from './eligibility';

const eligible = {
  visibleStatus: 'Entregado', rentlyStatusCode: 2, isTransfer: false,
  deliveryBranchOfficeId: 1, actualDeliveryAt: '2026-08-28T08:00:00Z',
  externalBookingId: '100', detailBookingId: 100,
  reservationPlate: '1234-BCD', detailVehiclePlate: '1234BCD', inExactRentlyIntersection: true,
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
    expect(evaluateSesEligibility({ ...eligible, inExactRentlyIntersection: false }).issues.map((issue) => issue.code)).toContain('not_in_rently_intersection');
  });

  it('routes terminated never-reported reservations to manual review', () => {
    const result = evaluateSesEligibility({ ...eligible, visibleStatus: 'Terminada', rentlyStatusCode: 3 });
    expect(result.eligible).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toContain('terminated_never_reported');
    expect(evaluateSesEligibility({ ...eligible, visibleStatus: 'Completada', rentlyStatusCode: 3 }).requiresReview).toBe(true);
  });

  it('allows only a current, attributable protocol exception for a terminated unreported booking', () => {
    const exception = {
      kind: 'terminated_not_reported' as const,
      protocolReference: 'PROTOCOLO-SINTETICO-001',
      reason: 'Incidencia documentada durante la comunicación oficial',
      approvedBy: 'synthetic-user',
      approvedAt: '2026-08-28T08:00:00Z',
      expiresAt: '2026-08-29T08:00:00Z',
    };
    const terminated = { ...eligible, visibleStatus: 'Terminada', rentlyStatusCode: 3, manualException: exception };
    expect(evaluateSesEligibility(terminated, new Date('2026-08-28T09:00:00Z'))).toMatchObject({ eligible: true, manualExceptionApplied: true });
    expect(evaluateSesEligibility({ ...terminated, manualException: { ...exception, expiresAt: '2026-08-28T08:30:00Z' } }, new Date('2026-08-28T09:00:00Z')).eligible).toBe(false);
    expect(evaluateSesEligibility({ ...terminated, manualException: { ...exception, protocolReference: '' } }, new Date('2026-08-28T09:00:00Z')).eligible).toBe(false);
    expect(evaluateSesEligibility({ ...terminated, manualException: { ...exception, revokedAt: '2026-08-28T08:15:00Z' } }, new Date('2026-08-28T09:00:00Z')).eligible).toBe(false);
  });

  it('excludes any reservation whose effective delivery is future, regardless of reference', () => {
    const future = evaluateSesEligibility(
      { ...eligible, externalBookingId: 'RANDOM-7781', detailBookingId: 'RANDOM-7781', actualDeliveryAt: '2026-08-29T09:00:00Z' },
      new Date('2026-08-28T09:00:00Z'),
    );
    expect(future.eligible).toBe(false);
    expect(future.issues.map((issue) => issue.code)).toContain('future_actual_delivery');
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
