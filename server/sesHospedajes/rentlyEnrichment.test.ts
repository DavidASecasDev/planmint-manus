import { describe, expect, it } from 'vitest';
import {
  buildRentlyDetailUpdateFields,
  extractRentlyContractVehicleData,
  needsRentlySesEnrichment,
  shouldRetryRentlySesEnrichment,
} from './rentlyEnrichment';

const baseReservation = {
  id: 'reservation-1', external_reservation_id: '4829', vehiculo_chasis: 'VIN', vehiculo_kms: 100,
  cliente_fecha_nacimiento: '1990-01-01', cliente_direccion: 'Carrer Major', cliente_pais: 'ESP',
  cliente_carnet_numero: 'LIC1', cliente_carnet_expiracion: '2030-01-01',
};

describe('Rently SES enrichment', () => {
  it('detects a missing VIN even when a previous detail sync exists', () => {
    expect(needsRentlySesEnrichment({ ...baseReservation, vehiculo_chasis: null, rently_detail_synced_at: '2026-08-01T00:00:00Z' })).toBe(true);
  });

  it('retries incomplete details only after 24 hours', () => {
    const now = Date.parse('2026-08-26T12:00:00Z');
    expect(shouldRetryRentlySesEnrichment({ ...baseReservation, vehiculo_chasis: null, rently_detail_synced_at: '2026-08-26T00:00:01Z' }, now)).toBe(false);
    expect(shouldRetryRentlySesEnrichment({ ...baseReservation, vehiculo_chasis: null, rently_detail_synced_at: '2026-08-25T11:59:59Z' }, now)).toBe(true);
  });

  it('extracts the contractual pickup/return km separately from current fleet km', () => {
    expect(extractRentlyContractVehicleData({
      Id: 4829, CurrentStatus: 3,
      Car: { ChassisIdentification: 'WMW41DL0303R20220', CurrentKms: 41214 },
      DeliveryInfo: { Kms: 40692 }, DropoffInfo: { Kms: 40986 },
    })).toEqual({ vehicleVin: 'WMW41DL0303R20220', currentKm: 41214, pickupKm: 40692, returnKm: 40986 });
  });

  it('never writes empty detail values over existing enrichment', () => {
    const fields = buildRentlyDetailUpdateFields({ Id: 4829, CurrentStatus: 3, Car: { ChassisIdentification: undefined, CurrentKms: 41214 } }, []);
    expect(fields).not.toHaveProperty('vehiculo_chasis');
    expect(fields).toMatchObject({ vehiculo_kms: 41214 });
  });
});
