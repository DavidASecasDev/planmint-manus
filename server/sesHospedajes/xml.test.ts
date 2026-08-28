import { describe, expect, it } from 'vitest';
import { generateSesXml, type SesXmlDraft } from './xml';

const person = {
  document_type: 'PAS', document_number: 'AB123456', first_name: 'Ana & Luz', first_surname: 'García',
  second_surname: null, birth_date: '1988-05-07', nationality_code: 'ESP', sex: 'M',
  address_line: 'Carrer Major', address_number: '12', address_complement: '2º A', municipality_code: '07040', municipality_name: 'Palma',
  postal_code: '07001', country_code: 'ESP', phone: '+34600111222', phone_secondary: null,
  email: 'ana@example.com', licence_type: 'B', licence_valid_until: '2030-09-30',
  licence_number: 'DL999', licence_support: 'SOP1', licence_country_code: 'ESP',
};

const location = {
  use_establishment_code: false, establishment_code: null, address_line: 'Aeropuerto de Palma',
  address_complement: null, municipality_code: '07040', municipality_name: 'Palma',
  postal_code: '07611', country_code: 'ESP', verified: true,
};

const draft: SesXmlDraft = {
  id: 'draft-1', reference: '4671', contract_date: '2026-08-10',
  pickup_at: '2026-08-10T13:08:55Z', return_at: '2026-08-12T10:00:00Z',
  payment_type: 'TARJT', payment_date: '2026-08-10', payment_medium: null,
  payment_holder: null, card_expiry: null, vehicle_type: 'TURISMO', vehicle_brand: 'BMW',
  vehicle_model: 'X1', vehicle_plate: '1234ABC', vehicle_vin: 'WBA12345678901234',
  vehicle_category: 'SUV', vehicle_color: 'NEGRO', km_pickup: 100, km_return: null, gps_data: null,
  holder: person, primary_driver: person, secondary_driver: null,
  pickup_location: location, return_location: { ...location, use_establishment_code: true, establishment_code: '0000000001' },
};

describe('SES XML generator', () => {
  it('generates the official root, roles and Madrid summer offset', () => {
    const xml = generateSesXml([draft]);
    expect(xml).toContain('<ns2:peticion xmlns:ns2="http://www.neg.hospedajes.mir.es/altaAlquilerVehiculo">');
    expect(xml).toContain('<fechaRecogida>2026-08-10T15:08:55+02:00</fechaRecogida>');
    expect(xml.match(/<rol>TI<\/rol>/g)).toHaveLength(1);
    expect(xml.match(/<rol>CP<\/rol>/g)).toHaveLength(1);
    expect(xml.match(/<permisoConducir>/g)).toHaveLength(1);
    expect(xml).toContain('<categoria>SUV</categoria>');
    expect(xml).toContain('<numeroBastidor>WBA12345678901234</numeroBastidor>');
    expect(xml).toContain('<color>NEGRO</color>');
    expect(xml).toContain('<kmRecogida>100</kmRecogida>');
  });

  it('uses address or establishment code exclusively and escapes XML', () => {
    const xml = generateSesXml([draft]);
    expect(xml).toContain('<direccionRecogida>');
    expect(xml).toContain('<codigoEstablecimientoDevolucion>0000000001</codigoEstablecimientoDevolucion>');
    expect(xml).not.toContain('<direccionDevolucion>');
    expect(xml).toContain('Ana &amp; Luz');
    expect(xml).toContain('<direccion>Carrer Major, 12</direccion>');
    expect(xml).toContain('<direccionComplementaria>2º A</direccionComplementaria>');
  });

  it('omits optional empty tags instead of emitting invalid blanks', () => {
    const xml = generateSesXml([draft]);
    expect(xml).not.toContain('<caducidadTarjeta>');
    expect(xml).not.toContain('<kmDevolucion>');
    expect(xml).not.toContain('<apellido2>');
  });

  it('preserves communication cardinality, unique references and a single secondary-driver role', () => {
    const secondary = { ...person, document_number: 'CD654321', first_name: 'Luis' };
    const second = { ...draft, id: 'draft-2', reference: '4672', vehicle_plate: '5678DEF', secondary_driver: secondary };
    const xml = generateSesXml([draft, second]);
    expect(xml.match(/<comunicacion>/g)).toHaveLength(2);
    expect(xml.match(/<referencia>4671<\/referencia>/g)).toHaveLength(1);
    expect(xml.match(/<referencia>4672<\/referencia>/g)).toHaveLength(1);
    expect(xml.match(/<rol>CS<\/rol>/g)).toHaveLength(1);
    expect(xml.indexOf('<contrato>')).toBeLessThan(xml.indexOf('<vehiculo>'));
    expect(xml.indexOf('<vehiculo>')).toBeLessThan(xml.indexOf('<persona>'));
  });
});
