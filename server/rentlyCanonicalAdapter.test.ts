import { describe, expect, it } from 'vitest';
import {
  buildRentlyEventCoverageScope,
  enrichReservationWithDetail,
  mapBookingToRentlyEvent,
  mapBookingToReservation,
} from './syncRently';

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

  it('conserva los eventos reales 5578/5582 recibidos en el listado con semántica Madrid', () => {
    const mapped5578 = mapBookingToReservation({
      Id: 5578, CurrentStatus: 2, UpdatedOn: '2026-09-09T17:57:00',
      FromDate: '2026-09-09T18:00:00', DeliveryInfo: { Date: '2026-09-09T17:56:39.05' },
    }, 'org', 'user');
    expect(mapped5578).toMatchObject({
      rently_status_code: 2,
      rently_delivery_actual_literal: '2026-09-09T17:56:39.05',
      rently_delivery_actual_at: '2026-09-09T15:56:39.050Z',
      rently_list_updated_literal: '2026-09-09T17:57:00',
    });

    const mapped5582 = mapBookingToReservation({
      Id: 5582, CurrentStatus: 3, UpdatedOn: '2026-09-10T17:31:00',
      FromDate: '2026-09-10T10:00:00', DeliveryInfo: { Date: '2026-09-09T23:05:19.643' },
      DropoffInfo: { Date: '2026-09-10T17:30:11.73' },
    }, 'org', 'user');
    expect(mapped5582).toMatchObject({
      rently_status_code: 3,
      rently_delivery_actual_literal: '2026-09-09T23:05:19.643',
      rently_delivery_actual_at: '2026-09-09T21:05:19.643Z',
      rently_dropoff_actual_literal: '2026-09-10T17:30:11.73',
      rently_dropoff_actual_at: '2026-09-10T15:30:11.730Z',
    });
    expect(mapBookingToRentlyEvent({
      Id: 5582, CurrentStatus: 3, UpdatedOn: '2026-09-10T17:31:00',
      FromDate: '2026-09-10T10:00:00', DeliveryInfo: { Date: '2026-09-09T23:05:19.643' },
      DropoffInfo: { Date: '2026-09-10T17:30:11.73' },
    }, 'org')).toMatchObject({
      external_booking_id: 5582,
      delivery_actual_literal: '2026-09-09T23:05:19.643',
      dropoff_actual_literal: '2026-09-10T17:30:11.73',
      raw_event_fields: { hasDelivery: true, hasDropoff: true, status: 3 },
    });
  });

  it('acredita eventos con un barrido full desde offset cero aunque los detalles sean opcionales', () => {
    expect(buildRentlyEventCoverageScope({
      syncMode: 'full', startedAt: '2026-09-10T03:00:00Z', completedAt: '2026-09-10T04:00:00Z',
      paginationStartOffset: 0, paginationEndOffset: 5587,
      localReservationImportIncludesAllStatuses: false,
    })).toMatchObject({
      sourceEndpoint: '/api/bookings/list', allBranches: true, allStatuses: true,
      paginationComplete: true, nextOffset: null, unfilteredDateWindow: true,
      bookingListEventsComplete: true, deliveryEventsComplete: true, dropoffEventsComplete: true,
      detailEnrichmentComplete: false, localReservationImportIncludesAllStatuses: false, reason: null,
    });
    expect(buildRentlyEventCoverageScope({
      syncMode: 'incremental', startedAt: '2026-09-10T03:00:00Z', completedAt: '2026-09-10T04:00:00Z',
      paginationStartOffset: 0, paginationEndOffset: 30,
      localReservationImportIncludesAllStatuses: true,
    }).bookingListEventsComplete).toBe(false);
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
