import { describe, expect, it } from 'vitest';
import {
  assertNonEmptyOfficialInventory,
  assertStableOfficialCommunicationIdentity,
  buildOfficialIdentityHash,
  evaluateOfficialClearance,
  normalizeOfficialInventoryItem,
} from './officialInventory';

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
  it('never clears a contract before its exact official identity is checked', () => {
    expect(evaluateOfficialClearance({
      checked: false, reference: '1', contractDate: '2026-08-26', vehiclePlate: '1234BCD', communications: [],
    }).status).toBe('not_checked');
  });

  it('blocks the accepted pilot reference 4942 from being sent again', () => {
    const result = evaluateOfficialClearance({
      checked: true,
      reference: '4942',
      contractDate: '2026-08-26',
      vehiclePlate: '1234-BCD',
      communications: [accepted],
    });
    expect(result.status).toBe('blocked');
    expect(result.matchingCommunicationCode).toBe(accepted.official_communication_code);
  });

  it('blocks both active and accepted exact duplicates', () => {
    for (const status of ['active', 'accepted'] as const) {
      expect(evaluateOfficialClearance({
        checked: true,
        reference: 'SYNTHETIC-100',
        contractDate: '2026-08-26',
        vehiclePlate: '1234BCD',
        communications: [{ ...accepted, reference: 'SYNTHETIC-100', status }],
      }).status).toBe('blocked');
    }
  });

  it('invalidates a previous clear check when date or plate changes', () => {
    const original = buildOfficialIdentityHash({ reference: 'SYNTHETIC-200', contractDate: '2026-08-26', vehiclePlate: '1234-BCD' });
    expect(buildOfficialIdentityHash({ reference: 'SYNTHETIC-200', contractDate: '2026-08-27', vehiclePlate: '1234-BCD' })).not.toBe(original);
    expect(buildOfficialIdentityHash({ reference: 'SYNTHETIC-200', contractDate: '2026-08-26', vehiclePlate: '9999XYZ' })).not.toBe(original);
    expect(buildOfficialIdentityHash({ reference: 'SYNTHETIC-200', contractDate: '2026-08-26', vehiclePlate: '1234BCD' })).toBe(original);
  });

  it('routes annulled, errored or version-mismatching communications to review', () => {
    for (const status of ['annulled', 'error'] as const) {
      expect(evaluateOfficialClearance({
        checked: true, reference: 'SYNTHETIC-300', contractDate: '2026-08-26', vehiclePlate: '1234BCD',
        communications: [{ ...accepted, reference: 'SYNTHETIC-300', status }],
      }).status).toBe('review');
    }
    expect(evaluateOfficialClearance({
      checked: true, reference: 'SYNTHETIC-300', contractDate: '2026-08-27', vehiclePlate: '1234BCD',
      communications: [{ ...accepted, reference: 'SYNTHETIC-300' }],
    }).status).toBe('review');
    expect(evaluateOfficialClearance({
      checked: true, reference: 'SYNTHETIC-300', contractDate: '2026-08-26', vehiclePlate: '9999XYZ',
      communications: [{ ...accepted, reference: 'SYNTHETIC-300' }],
    }).status).toBe('review');
  });

  it('normalizes plates before persistence and matching', () => {
    expect(normalizeOfficialInventoryItem({ vehicle_plate: ' 1234-bcd ' }).normalized_plate).toBe('1234BCD');
  });

  it('does not allow an accepted official code to be reassigned', () => {
    expect(() => assertStableOfficialCommunicationIdentity(accepted, { ...accepted, reference: 'OTHER' })).toThrow(/otro contrato/i);
    expect(() => assertStableOfficialCommunicationIdentity(accepted, { ...accepted })).not.toThrow();
  });

  it('never confirms an empty official inventory', () => {
    expect(() => assertNonEmptyOfficialInventory([])).toThrow(/lista vacía/i);
    expect(() => assertNonEmptyOfficialInventory([accepted])).not.toThrow();
  });
});
