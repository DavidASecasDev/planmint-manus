import { describe, expect, it } from 'vitest';
import {
  mapRentlyCustomerToSesProfile,
  mapRentlyDocumentType,
  normalizeDocumentNumber,
  toDateOnly,
  toIsoAlpha3,
} from './rentlyProfiles';

describe('Rently → SES person profile mapping', () => {
  it('maps the exact Rently field spellings used by the live API', () => {
    const profile = mapRentlyCustomerToSesProfile({
      Id: 42,
      Firstname: 'Ana',
      Lastname: 'García López',
      DocumentTypeId: 3,
      DocumentId: ' AB-123 456 ',
      BirthDate: '1988-05-07T00:00:00',
      Country: 'España',
      Address: 'Carrer Major',
      AddressNumber: '12',
      AddressDepartment: '2º B',
      City: 'Palma',
      ZipCode: '07001',
      DriverLicenceNumber: 'DL-999',
      DriverLicenceCountry: 'ES',
      DriverLicenseExpiration: '2030-09-30T00:00:00',
    }, 'org-1', 'user-1');

    expect(profile).toMatchObject({
      rently_customer_id: 42,
      document_type: 'PAS',
      document_number: 'AB123456',
      birth_date: '1988-05-07',
      country_code: 'ESP',
      address_line: 'Carrer Major',
      address_number: '12',
      address_complement: '2º B',
      municipality_name: 'Palma',
      postal_code: '07001',
      licence_number: 'DL999',
      licence_country_code: 'ESP',
      licence_valid_until: '2030-09-30',
    });
  });

  it('rejects incomplete identities instead of creating unusable profiles', () => {
    expect(mapRentlyCustomerToSesProfile({ Firstname: 'Ana' }, 'org-1', 'user-1')).toBeNull();
  });

  it('normalizes supported dates, countries and documents deterministically', () => {
    expect(toIsoAlpha3('Reino Unido')).toBe('GBR');
    expect(toIsoAlpha3({ Code: 'DE' })).toBe('DEU');
    expect(toIsoAlpha3('ZZ')).toBeNull();
    expect(toDateOnly('2029-01-02T11:30:00Z')).toBe('2029-01-02');
    expect(normalizeDocumentNumber(' 12-34 56 ')).toBe('123456');
    expect(mapRentlyDocumentType(1)).toBe('NIF');
    expect(mapRentlyDocumentType(2)).toBe('OTRO');
  });
});
