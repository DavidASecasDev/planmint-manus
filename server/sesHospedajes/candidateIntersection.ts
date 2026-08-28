import { normalizeSesPlate } from './eligibility';

export type RentlySesCandidate = {
  Id: string | number;
  CurrentStatus: number;
  Car?: { Plate?: string | null } | null;
};

export type PlanMintSesReservation = {
  id: string;
  external_reservation_id?: string | number | null;
  auto?: string | null;
};

export type SesCandidateExclusion = {
  source: 'rently' | 'planmint';
  externalBookingId: string;
  reservationId?: string;
  code: 'missing_in_planmint' | 'missing_in_rently' | 'ambiguous_planmint_booking' | 'plate_mismatch';
  message: string;
};

export function intersectRentlyPlanMintCandidates<Reservation extends PlanMintSesReservation>(input: {
  rentlyCandidates: RentlySesCandidate[];
  planMintReservations: Reservation[];
}) {
  const rentlyById = new Map<string, RentlySesCandidate>();
  for (const candidate of input.rentlyCandidates) {
    const id = String(candidate.Id ?? '').trim();
    if (id && !rentlyById.has(id)) rentlyById.set(id, candidate);
  }

  const planMintByExternalId = new Map<string, Reservation[]>();
  for (const reservation of input.planMintReservations) {
    const id = String(reservation.external_reservation_id ?? '').trim();
    if (!id) continue;
    const rows = planMintByExternalId.get(id) ?? [];
    rows.push(reservation);
    planMintByExternalId.set(id, rows);
  }

  const matches: Array<{ reservation: Reservation; rentlyCandidate: RentlySesCandidate }> = [];
  const exclusions: SesCandidateExclusion[] = [];
  const matchedReservationIds = new Set<string>();

  for (const [externalBookingId, candidate] of Array.from(rentlyById.entries())) {
    const reservations = planMintByExternalId.get(externalBookingId) ?? [];
    if (reservations.length === 0) {
      exclusions.push({ source: 'rently', externalBookingId, code: 'missing_in_planmint', message: 'La reserva entregada de Rently no existe en PlanMint' });
      continue;
    }
    if (reservations.length !== 1) {
      exclusions.push({ source: 'planmint', externalBookingId, code: 'ambiguous_planmint_booking', message: 'Más de una reserva de PlanMint comparte el mismo identificador Rently' });
      continue;
    }
    const reservation = reservations[0];
    const planMintPlate = normalizeSesPlate(reservation.auto);
    const rentlyPlate = normalizeSesPlate(candidate.Car?.Plate);
    if (!planMintPlate || !rentlyPlate || planMintPlate !== rentlyPlate) {
      exclusions.push({
        source: 'planmint', externalBookingId, reservationId: reservation.id, code: 'plate_mismatch',
        message: 'La matrícula de PlanMint no coincide exactamente con la reserva entregada de Rently',
      });
      continue;
    }
    matchedReservationIds.add(reservation.id);
    matches.push({ reservation, rentlyCandidate: candidate });
  }

  for (const reservation of input.planMintReservations) {
    if (matchedReservationIds.has(reservation.id)) continue;
    const externalBookingId = String(reservation.external_reservation_id ?? '').trim();
    if (!externalBookingId || rentlyById.has(externalBookingId)) continue;
    exclusions.push({
      source: 'planmint', externalBookingId, reservationId: reservation.id, code: 'missing_in_rently',
      message: 'La reserva de PlanMint no figura en el listado exacto de entregadas de Rently',
    });
  }

  return {
    rentlyCandidateCount: rentlyById.size,
    planMintReservationCount: input.planMintReservations.length,
    matches,
    exclusions,
  };
}
