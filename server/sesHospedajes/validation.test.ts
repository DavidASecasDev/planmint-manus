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

  it('does not require supportDocumento or licence support for a passport holder/driver', () => {
    const issues = validateSesDraft({
      reference: '4130',
      contract_date: '2026-08-18',
      pickup_at: '2026-08-19T09:00:00Z',
      return_at: '2026-08-21T19:00:00Z',
      payment_type: 'TARJT',
      vehicle_category: 'Mini Convertibles',
      vehicle_type: 'TURISMO',
      vehicle_brand: 'MINI',
      vehicle_model: 'Cooper S Cabrio',
      vehicle_plate: '0000AAA',
      vehicle_vin: 'WMW00000000000000',
      vehicle_color: 'NEGRO',
      km_pickup: 1,
      holder: { ...completePerson, document_type: 'PAS', licence_support: null },
      primary_driver: { ...completePerson, document_type: 'PAS', licence_support: null },
      pickup_location: completeLocation,
      return_location: completeLocation,
    });
    expect(issues.some((issue) => issue.path.includes('support'))).toBe(false);
  });

  it('no cuenta como pendientes los opcionales y exige tipo, validez y número para CP y CS', () => {
    const optionalEmpty = {
      ...completePerson,
      birth_date: null,
      nationality_code: null,
      sex: null,
      second_surname: null,
      licence_support: null,
      licence_country_code: null,
    };
    const issues = validateSesDraft({
      reference: 'SYNTHETIC-OPTIONAL', contract_date: '2026-08-20', pickup_at: '2026-08-21T10:00:00Z',
      return_at: '2026-08-22T13:00:00Z', payment_type: 'TARJT', payment_date: null,
      payment_medium: null, payment_holder: null, card_expiry: null,
      vehicle_category: 'SUV', vehicle_type: 'TURISMO', vehicle_brand: 'MERCEDES', vehicle_model: 'GLA',
      vehicle_plate: '1234ABC', vehicle_vin: 'WDD12345678901234', vehicle_color: 'NEGRO', km_pickup: 100,
      km_return: null, gps_data: null, holder: optionalEmpty, primary_driver: optionalEmpty,
      secondary_driver: { ...optionalEmpty, licence_type: null, licence_valid_until: null, licence_number: null },
      pickup_location: completeLocation, return_location: completeLocation,
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      'secondary_driver.licence_type',
      'secondary_driver.licence_valid_until',
      'secondary_driver.licence_number',
    ]);
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

  it('rejects syntactically shaped but nonexistent ISO-3 country codes', () => {
    const issues = validateSesDraft({
      reference: 'TEST-ISO', contract_date: '2026-08-20', pickup_at: '2026-08-21T10:00:00Z',
      return_at: '2026-08-22T13:00:00Z', payment_type: 'TARJT', vehicle_category: 'SUV',
      vehicle_type: 'TURISMO', vehicle_brand: 'MERCEDES', vehicle_model: 'GLA', vehicle_plate: '1234ABC',
      vehicle_vin: 'WDD12345678901234', vehicle_color: 'NEGRO', km_pickup: 100,
      holder: { ...completePerson, nationality_code: 'ZZZ' }, primary_driver: completePerson,
      pickup_location: completeLocation, return_location: completeLocation,
    });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'holder.nationality_code', code: 'invalid' }),
    ]));
  });

  it('rejects invalid vehicle, postal, contact and licence formats', () => {
    const issues = validateSesDraft({
      reference: 'TEST-FORMAT', contract_date: '2026-08-20', pickup_at: '2026-08-21T10:00:00Z',
      return_at: '2026-08-22T13:00:00Z', payment_type: 'TARJT', vehicle_category: 'SUV',
      vehicle_type: 'TURISMO', vehicle_brand: 'MERCEDES', vehicle_model: 'GLA', vehicle_plate: '**',
      vehicle_vin: 'SHORT', vehicle_color: 'NEGRO', km_pickup: 200, km_return: 150,
      holder: { ...completePerson, postal_code: 'ABC', email: 'no-email', phone: '12' },
      primary_driver: { ...completePerson, licence_number: '@@', licence_valid_until: '2026-01-01' },
      pickup_location: completeLocation, return_location: completeLocation,
    });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'vehicle_plate', 'vehicle_vin', 'km_return', 'holder.postal_code',
      'holder.email', 'holder.phone', 'primary_driver.licence_number',
      'primary_driver.licence_valid_until',
    ]));
  });

  it('rejects a contract signed after pickup and rentals longer than 366 days', () => {
    const issues = validateSesDraft({
      reference: 'TEST-DATES', contract_date: '2026-08-22', pickup_at: '2026-08-21T10:00:00Z',
      return_at: '2027-09-01T10:00:00Z',
    });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'contract_date', code: 'inconsistent' }),
      expect.objectContaining({ path: 'return_at', code: 'inconsistent' }),
    ]));
  });
});
