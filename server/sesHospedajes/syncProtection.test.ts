import { describe, expect, it } from 'vitest';
import { removeEmptyRentlyEnrichmentFields } from '../syncRently';

describe('Rently enrichment protection', () => {
  it('removes empty summary values that would erase detailed customer data', () => {
    const update = removeEmptyRentlyEnrichmentFields({
      estado: 'En curso',
      cliente_nombre: '',
      tipo_documento_cliente: null,
      cliente_direccion: undefined,
      cliente_carnet_numero: 'DL123',
      vehiculo_chasis: 'VIN123',
    });

    expect(update).toEqual({
      estado: 'En curso',
      cliente_carnet_numero: 'DL123',
      vehiculo_chasis: 'VIN123',
    });
  });
});
