import { describe, expect, it } from 'vitest';
import { buildSesHistoricalSnapshots, calculateSesPayloadSnapshotHash } from './historicalSnapshots';

describe('SES immutable historical snapshots', () => {
  it('freezes contract, vehicle, person and location values independently of live profiles', () => {
    const holder = { id: 'person-1', first_name: 'Test', postal_code: '07007' };
    const pickupLocation = { id: 'loc-1', name: 'Base', postal_code: '07007' };
    const draft = {
      id: 'draft-1', draft_version: 4, reference: 'TEST-1', vehicle_plate: '1234BCD',
      holder, primary_driver: holder, pickup_location: { id: 'loc-1', name: 'Base' },
      return_location: { id: 'loc-2', name: 'Destino' },
    };
    draft.pickup_location = pickupLocation;
    const snapshots = buildSesHistoricalSnapshots({ organizationId: 'org-1', batchItemId: 'item-1', draft });
    holder.postal_code = '99999';
    pickupLocation.postal_code = '99999';
    expect(snapshots.find((row) => row.entity_role === 'holder')?.snapshot_data.postal_code).toBe('07007');
    expect(snapshots.find((row) => row.entity_role === 'pickup')?.snapshot_data.postal_code).toBe('07007');
    expect(new Set(snapshots.map((row) => `${row.entity_kind}:${row.entity_role}`)).size).toBe(snapshots.length);
  });

  it('produces a deterministic SHA-256 payload hash', () => {
    const first = calculateSesPayloadSnapshotHash({ reference: 'A', value: 1 });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(calculateSesPayloadSnapshotHash({ reference: 'A', value: 1 })).toBe(first);
  });
});
