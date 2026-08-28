import { describe, expect, it } from 'vitest';
import { generateSesXml, type SesXmlDraft } from './xml';
import { SES_OFFICIAL_CONTRACT_VERSION, validateSesXmlAgainstOfficialContract } from './officialStructuralContract';

function validDraft(reference: string): SesXmlDraft {
  const person = {
    document_type: 'PAS', document_number: 'AA12345', first_name: 'ANA', first_surname: 'PRUEBA',
    address_line: 'CALLE PRUEBA', municipality_code: '07040', postal_code: '07001', country_code: 'ESP',
    email: 'ana@example.test', licence_type: 'B', licence_valid_until: '2030-01-01', licence_number: 'LIC12345',
  };
  const location = { address_line: 'CALLE PRUEBA', municipality_code: '07040', postal_code: '07001', country_code: 'ESP' };
  return {
    id: reference, reference, contract_date: '2026-08-01', pickup_at: '2026-08-02T10:00:00Z', return_at: '2026-08-03T10:00:00Z',
    payment_type: 'TARJT', vehicle_category: 'TURISMO', vehicle_type: 'TURISMO', vehicle_brand: 'BMW',
    vehicle_model: 'MODELO PRUEBA', vehicle_plate: '1234ABC', vehicle_vin: 'WVWZZZ1JZXW000001', vehicle_color: 'NEGRO', km_pickup: 10,
    holder: person, primary_driver: person, pickup_location: location, return_location: location,
  };
}

describe('contrato estructural oficial de alquiler de vehículos', () => {
  it('acepta varias comunicaciones dentro de una única solicitud', () => {
    const xml = generateSesXml([validDraft('REF-A'), validDraft('REF-B')]);
    const result = validateSesXmlAgainstOfficialContract(xml);
    expect(result.valid).toBe(true);
    expect(result.communicationCount).toBe(2);
    expect(result.contractVersion).toBe(SES_OFFICIAL_CONTRACT_VERSION);
    expect((xml.match(/<solicitud>/g) ?? []).length).toBe(1);
  });

  it('rechaza cardinalidad de personas y roles inválidos', () => {
    const xml = generateSesXml([validDraft('REF-A')]).replace(/<persona>[\s\S]*?<\/persona>/, '');
    const result = validateSesXmlAgainstOfficialContract(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('entre 2 y 3 personas'))).toBe(true);
  });

  it('rechaza namespace, longitudes y pares de ubicación incompatibles', () => {
    const xml = generateSesXml([validDraft('REF-A')])
      .replace('http://www.neg.hospedajes.mir.es/altaAlquilerVehiculo', 'urn:no-oficial')
      .replace('<referencia>REF-A</referencia>', `<referencia>${'X'.repeat(51)}</referencia>`)
      .replace('</direccionRecogida>', '</direccionRecogida><codigoEstablecimientoRecogida>0000000000</codigoEstablecimientoRecogida>');
    const result = validateSesXmlAgainstOfficialContract(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('namespace'))).toBe(true);
    expect(result.errors.some((error) => error.includes('supera 50'))).toBe(true);
    expect(result.errors.some((error) => error.includes('exactamente dirección o código'))).toBe(true);
  });
});
