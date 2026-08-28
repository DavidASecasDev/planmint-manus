import { evaluateSesEligibility } from './eligibility';
import { evaluateOfficialClearance, type SesOfficialCommunication } from './officialInventory';

function evaluateFacts(references: [string, string, string]) {
  const [acceptedReference, reviewReference, futureReference] = references;
  const accepted: SesOfficialCommunication = {
    official_communication_code: 'accepted-code', reference: acceptedReference,
    communication_type: 'ALQUILER_VEHICULO', contract_date: '2026-08-20',
    normalized_plate: '1234ABC', status: 'accepted',
  };
  const different: SesOfficialCommunication = {
    official_communication_code: 'different-code', reference: reviewReference,
    communication_type: 'ALQUILER_VEHICULO', contract_date: '2026-08-19',
    normalized_plate: '9999XYZ', status: 'active',
  };
  const annulled: SesOfficialCommunication = {
    official_communication_code: 'annulled-code', reference: reviewReference,
    communication_type: 'ALQUILER_VEHICULO', contract_date: '2026-08-20',
    normalized_plate: '1234ABC', status: 'annulled',
  };
  const eligibleBase = {
    visibleStatus: 'Entregado', rentlyStatusCode: 2, isTransfer: false,
    deliveryBranchOfficeId: 1, externalBookingId: futureReference,
    detailBookingId: futureReference, reservationPlate: '1234ABC', detailVehiclePlate: '1234ABC',
    inExactRentlyIntersection: true,
  };
  return {
    accepted: evaluateOfficialClearance({ checked: true, reference: acceptedReference,
      contractDate: '2026-08-20', vehiclePlate: '1234ABC', communications: [accepted] }).status,
    distinct: evaluateOfficialClearance({ checked: true, reference: reviewReference,
      contractDate: '2026-08-20', vehiclePlate: '1234ABC', communications: [different] }).status,
    annulled: evaluateOfficialClearance({ checked: true, reference: reviewReference,
      contractDate: '2026-08-20', vehiclePlate: '1234ABC', communications: [annulled] }).status,
    future: evaluateSesEligibility({ ...eligibleBase, actualDeliveryAt: '2026-08-30T10:00:00Z' },
      new Date('2026-08-28T10:00:00Z')).issues.map((issue) => issue.code),
  };
}

describe('SES rules do not depend on known references', () => {
  it('keeps identical results after mutating all three references', () => {
    expect(evaluateFacts(['864201', '864202', '864203']))
      .toEqual(evaluateFacts(['4942', '5164', '5343']));
  });

  it('classifies new unknown facts generically', () => {
    expect(evaluateFacts(['UNKNOWN-ACCEPTED', 'UNKNOWN-REVIEW', 'UNKNOWN-FUTURE'])).toEqual({
      accepted: 'blocked', distinct: 'review', annulled: 'review', future: ['future_actual_delivery'],
    });
  });
});
