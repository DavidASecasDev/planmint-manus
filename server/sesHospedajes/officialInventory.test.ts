import { describe, expect, it } from 'vitest';
import { assertStableOfficialCommunicationIdentity, evaluateOfficialClearance, normalizeOfficialInventoryItem } from './officialInventory';

const accepted = {
  official_communication_code: '4b86dae9-a184-11f1-ab80-00505695dcc7',
  official_lot_code: '3d0ccc9e-a184-11f1-80b7-005056957a69',
  reference: '4942',
  communication_type: 'ALQUILER_VEHICULO' as const,
  contract_date: '2026-08-26',
  normalized_plate: '1234BCD',
  status: 'accepted' as const,
};

describe('SES official inventory', () => {
  it('never clears a contract before the official inventory is confirmed', () => {
    expect(evaluateOfficialClearance({
      inventoryConfirmed: false, reference: '1', contractDate: '2026-08-26', vehiclePlate: '1234BCD', communications: [],
    }).status).toBe('not_checked');
  });

  it('blocks the accepted pilot reference 4942 from being sent again', () => {
    const result = evaluateOfficialClearance({
      inventoryConfirmed: true,
      reference: '4942',
      contractDate: '2026-08-26',
      vehiclePlate: '1234-BCD',
      communications: [accepted],
    });
    expect(result.status).toBe('blocked');
    expect(result.matchingCommunicationCode).toBe(accepted.official_communication_code);
  });

  it('routes annulled or mismatching communications to review', () => {
    expect(evaluateOfficialClearance({
      inventoryConfirmed: true, reference: '4942', contractDate: '2026-08-26', vehiclePlate: '1234BCD',
      communications: [{ ...accepted, status: 'annulled' }],
    }).status).toBe('review');
    expect(evaluateOfficialClearance({
      inventoryConfirmed: true, reference: '4942', contractDate: '2026-08-27', vehiclePlate: '1234BCD',
      communications: [accepted],
    }).status).toBe('review');
  });

  it('normalizes plates before persistence and matching', () => {
    expect(normalizeOfficialInventoryItem({ vehicle_plate: ' 1234-bcd ' }).normalized_plate).toBe('1234BCD');
  });

  it('does not allow an accepted official code to be reassigned', () => {
    expect(() => assertStableOfficialCommunicationIdentity(accepted, { ...accepted, reference: 'OTHER' })).toThrow(/otro contrato/i);
    expect(() => assertStableOfficialCommunicationIdentity(accepted, { ...accepted })).not.toThrow();
  });
});
