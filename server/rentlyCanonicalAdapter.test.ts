import { describe, expect, it } from 'vitest';
import { enrichReservationWithDetail, mapBookingToReservation } from './syncRently';

describe('adaptador canónico Rently oficial', () => {
  it('mapea el DTO ligero sin usar Car.Id como matrícula', () => {
    const mapped = mapBookingToReservation({
      Id: 10,
      CurrentStatus: 2,
      CurrentStatusDate: '2026-09-03T10:00:00Z',
      Customer: { Name: 'Ana', Lastname: 'Prueba', DocumentType: 3, Birthday: '1990-01-01' },
      Car: { Id: 999, CurrentPlate: { Id: '1234ABC' } },
      Model: { Name: 'X1' }, Category: { Name: 'SUV' }, Brand: { Name: 'BMW' },
    }, 'org', 'user');
    expect(mapped).toMatchObject({ cliente_nombre: 'Ana', auto: '1234ABC', modelo: 'X1', categoria: 'SUV', marca: 'BMW' });
  });

  it('nunca convierte el identificador interno del auto en matrícula', () => {
    const mapped = mapBookingToReservation({ Id: 10, CurrentStatus: 1, Car: { Id: 999 } }, 'org', 'user');
    expect(mapped.auto).toBeNull();
  });

  it('mapea combustible y fecha oficial de cambio de estado desde detalle', () => {
    const enriched = enrichReservationWithDetail({}, {
      Id: 10, CurrentStatus: 2, CurrentStatusDate: '2026-09-03T10:00:00Z',
      Car: { CurrentPlate: { Id: '1234ABC' }, Gasoline: 75, FuelType: 'Gasolina' },
      Brand: { Name: 'BMW' }, Model: { Name: 'X1' }, Category: { Name: 'SUV' },
    }, []);
    expect(enriched).toMatchObject({
      auto: '1234ABC', vehiculo_combustible: 75, vehiculo_tipo_combustible: 'Gasolina',
      rently_status_date: '2026-09-03T10:00:00Z', marca: 'BMW', modelo: 'X1', categoria: 'SUV',
    });
  });
});
