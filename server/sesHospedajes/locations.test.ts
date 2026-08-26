import { describe, expect, it } from 'vitest';
import { resolveKnownSesLocation } from './sesEndpoints';

describe('SES known locations', () => {
  it('uses the confirmed establishment code for Son Oms', () => {
    expect(resolveKnownSesLocation(
      'Oficina Azul Cars - Polígono Son Oms',
      '0000129394',
    )).toMatchObject({
      use_establishment_code: true,
      establishment_code: '0000129394',
      verified: true,
    });
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
