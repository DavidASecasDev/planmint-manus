import { describe, expect, it } from 'vitest';
import { resolveKnownSesLocation } from './sesEndpoints';

describe('SES known locations', () => {
  it('maps the current Son Malferit office as a structured address without reusing the old establishment code', () => {
    expect(resolveKnownSesLocation(
      'Oficina Azul Cars Son Malferit',
      '0000129394',
    )).toMatchObject({
      use_establishment_code: false,
      establishment_code: null,
      address_line: 'Carrer Son Malferit, 18, Llevant',
      municipality_code: '07040',
      postal_code: '07007',
      verified: true,
    });
  });

  it('does not treat the former Son Oms office as the current establishment', () => {
    expect(resolveKnownSesLocation(
      'Oficina Azul Cars - Polígono Son Oms',
      '0000129394',
    )).toBeNull();
  });

  it('maps Palma airport to the correct INE municipality code', () => {
    expect(resolveKnownSesLocation('Aeropuerto de Palma', null)).toMatchObject({
      municipality_code: '07040',
      postal_code: '07611',
      country_code: 'ESP',
      verified: true,
    });
  });

  it('does not invent data for an unknown location', () => {
    expect(resolveKnownSesLocation('Dirección desconocida', '0000129394')).toBeNull();
  });
});
