import { describe, expect, it } from 'vitest';
import { calculateSesDraftContentHash, getActualChangedValues } from './draftVersioning';

describe('SES draft versioning', () => {
  it('does not treat identical values or equivalent datetimes as changes', () => {
    const current = { payment_type: null, km_pickup: 12, pickup_at: '2026-08-19T09:00:00.000Z' };
    expect(getActualChangedValues(current, {
      payment_type: null,
      km_pickup: 12,
      pickup_at: '2026-08-19T11:00:00+02:00',
    })).toEqual({});
  });

  it('returns only fields whose persisted value really changes', () => {
    expect(getActualChangedValues(
      { payment_type: null, vehicle_color: 'NEGRO' },
      { payment_type: 'TARJT', vehicle_color: 'NEGRO' },
    )).toEqual({ payment_type: 'TARJT' });
  });

  it('keeps the same hash when only operational metadata or version changes', () => {
    const base = {
      reference: '4130',
      payment_type: null,
      pickup_at: '2026-08-19T09:00:00.000Z',
      manual_fields: ['payment_type', 'vehicle_color'],
    };
    expect(calculateSesDraftContentHash(base)).toBe(calculateSesDraftContentHash({
      ...base,
      pickup_at: '2026-08-19T11:00:00+02:00',
      manual_fields: ['vehicle_color', 'payment_type'],
      draft_version: 99,
      last_prepared_at: '2026-08-27T18:00:00Z',
      updated_by: 'another-user',
    }));
  });
});
