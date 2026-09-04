import { describe, expect, it } from 'vitest';
import { enrichReservationWithDetail, mapBookingToReservation } from './syncRently';

describe('adaptador canónico Rently oficial', () => {
  it('prioriza la matrícula legal de Car.Id frente al alias operativo CurrentPlate', () => {
    const mapped = mapBookingToReservation({
      Id: 10,
      CurrentStatus: 2,
      CurrentStatusDate: '2026-09-03T10:00:00Z',
      Customer: { Name: 'Ana', Lastname: 'Prueba', DocumentType: 3, Birthday: '1990-01-01' },
      Car: { Id: '1892MSD', CurrentPlate: { Id: 'MINI1-9' } },
      Model: { Name: 'X1' }, Category: { Name: 'SUV' }, Brand: { Name: 'BMW' },
    }, 'org', 'user');
    expect(mapped).toMatchObject({ cliente_nombre: 'Ana', auto: '1892MSD', modelo: 'X1', categoria: 'SUV', marca: 'BMW' });
  });

  it('rechaza identificadores numéricos opacos como matrícula', () => {
    const mapped = mapBookingToReservation({ Id: 10, CurrentStatus: 1, Car: { Id: 999 } }, 'org', 'user');
    expect(mapped.auto).toBeNull();
  });

  it('usa el Car.Id string de BookingDescription cuando CurrentPlate no viene expandido', () => {
    const mapped = mapBookingToReservation({
      Id: 11,
      CurrentStatus: 1,
      Car: { Id: '1892MSD' },
      Model: { Name: 'Cooper S Cabrio' },
    }, 'org', 'user');
    expect(mapped).toMatchObject({ auto: '1892MSD', modelo: 'Cooper S Cabrio' });
  });

  it('mapea combustible y fecha oficial de cambio de estado desde detalle', () => {
    const enriched = enrichReservationWithDetail({}, {
      Id: 10, CurrentStatus: 2, CurrentStatusDate: '2026-09-03T10:00:00Z',
      Car: { Id: '1234ABC', CurrentPlate: { Id: 'MINI1-9' }, Gasoline: 75, FuelType: 'Gasolina' },
      Brand: { Name: 'BMW' }, Model: { Name: 'X1' }, Category: { Name: 'SUV' },
    }, []);
    expect(enriched).toMatchObject({
      auto: '1234ABC', vehiculo_combustible: 75, vehiculo_tipo_combustible: 'Gasolina',
      rently_status_date: '2026-09-03T10:00:00Z', marca: 'BMW', modelo: 'X1', categoria: 'SUV',
    });
  });
});
