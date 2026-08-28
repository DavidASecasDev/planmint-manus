import { describe, expect, it } from 'vitest';
import { intersectRentlyPlanMintCandidates } from './candidateIntersection';

describe('Rently–PlanMint exact SES candidate intersection', () => {
  it('processes all 65 list rows independently from a dashboard widget showing 64', () => {
    const rentlyCandidates = Array.from({ length: 65 }, (_, index) => ({
      Id: index + 1, CurrentStatus: 2, Car: { Plate: `${String(index).padStart(4, '0')}ABC` },
    }));
    const planMintReservations = rentlyCandidates.map((candidate, index) => ({
      id: `local-${index + 1}`, external_reservation_id: String(candidate.Id), auto: candidate.Car.Plate,
    }));
    const result = intersectRentlyPlanMintCandidates({ rentlyCandidates, planMintReservations });
    expect(result.rentlyCandidateCount).toBe(65);
    expect(result.matches).toHaveLength(65);
    expect(result.exclusions).toHaveLength(0);
  });

  it('matches by reservation and normalized plate, not only by booking id', () => {
    const result = intersectRentlyPlanMintCandidates({
      rentlyCandidates: [
        { Id: 10, CurrentStatus: 2, Car: { Plate: '1234-ABC' } },
        { Id: 11, CurrentStatus: 2, Car: { Plate: '9999XYZ' } },
      ],
      planMintReservations: [
        { id: 'match', external_reservation_id: '10', auto: '1234ABC' },
        { id: 'mismatch', external_reservation_id: '11', auto: '1111AAA' },
      ],
    });
    expect(result.matches.map((entry) => entry.reservation.id)).toEqual(['match']);
    expect(result.exclusions).toContainEqual(expect.objectContaining({ reservationId: 'mismatch', code: 'plate_mismatch' }));
  });

  it('does not create candidates from PlanMint rows absent from the filtered Rently list', () => {
    const result = intersectRentlyPlanMintCandidates({
      rentlyCandidates: [],
      planMintReservations: [{ id: 'local-only', external_reservation_id: '900', auto: '1234ABC' }],
    });
    expect(result.matches).toHaveLength(0);
    expect(result.exclusions).toContainEqual(expect.objectContaining({ reservationId: 'local-only', code: 'missing_in_rently' }));
  });
});
