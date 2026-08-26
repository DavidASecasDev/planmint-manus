import { describe, expect, it } from 'vitest';
import { validateSesDraft } from './validation';

const completePerson = {
  document_type: 'PAS',
  document_number: 'AB123456',
  first_name: 'Ana',
  first_surname: 'García',
  birth_date: '1988-05-07',
  nationality_code: 'ESP',
  sex: 'M',
  address_line: 'Carrer Major 12',
  municipality_code: '07040',
  postal_code: '07001',
  country_code: 'ESP',
  phone: '+34600111222',
  licence_type: 'B',
  licence_valid_until: '2030-09-30',
  licence_number: 'DL999',
  licence_country_code: 'ESP',
};

const completeLocation = {
  use_establishment_code: false,
  address_line: 'Aeropuerto de Palma',
  municipality_code: '07040',
  postal_code: '07611',
  country_code: 'ESP',
};

describe('SES contract validation', () => {
  it('accepts a complete rental contract', () => {
    const issues = validateSesDraft({
      reference: '4671',
      contract_date: '2026-08-20',
      pickup_at: '2026-08-21T10:00:00Z',
      return_at: '2026-08-22T13:00:00Z',
      payment_type: 'TARJT',
      vehicle_category: 'SUV',
      vehicle_type: 'TURISMO',
      vehicle_brand: 'MERCEDES',
      vehicle_model: 'GLA',
      vehicle_plate: '1234ABC',
      vehicle_vin: 'WDD12345678901234',
      vehicle_color: 'NEGRO',
      km_pickup: 12500,
      holder: completePerson,
      primary_driver: completePerson,
      pickup_location: completeLocation,
      return_location: completeLocation,
    });
    expect(issues).toEqual([]);
  });

  it('reports the exact manual fields still required', () => {
    const issues = validateSesDraft({
      reference: '4671',
      pickup_at: '2026-08-21T10:00:00Z',
      return_at: '2026-08-22T13:00:00Z',
      holder: { ...completePerson, country_code: 'ESP', municipality_code: null },
      primary_driver: { ...completePerson, licence_type: null },
      pickup_location: completeLocation,
      return_location: completeLocation,
    });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'contract_date', 'payment_type', 'vehicle_category', 'vehicle_type', 'vehicle_brand',
      'vehicle_model', 'vehicle_plate', 'vehicle_vin', 'vehicle_color', 'km_pickup',
      'holder.municipality_code', 'primary_driver.licence_type',
    ]));
  });

  it('rejects a return before pickup', () => {
    const issues = validateSesDraft({
      reference: '4671',
      pickup_at: '2026-08-22T13:00:00Z',
      return_at: '2026-08-21T10:00:00Z',
    });
    expect(issues.some((issue) => issue.code === 'inconsistent' && issue.path === 'return_at')).toBe(true);
  });
});
