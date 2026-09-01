import { describe, expect, it } from 'vitest';
import {
  getFleetVehicleCandidates,
  groupFleetVehiclesByPlate,
  needsRentlyVehicleDetail,
  normalizeSesVehiclePlateKey,
  resolveSesVehicleData,
} from './vehicleResolver';
import { mergeSesRentlyFields } from './operationalDraft';

describe('resolución de vehículo SES', () => {
  it('normaliza espacios, guiones y mayúsculas para enlazar la flota', () => {
    const grouped = groupFleetVehiclesByPlate([{ matricula: '1234 ABC', marca: 'BMW', modelo: 'X1' }]);
    expect(normalizeSesVehiclePlateKey(' 1234-abc ')).toBe('1234ABC');
    expect(getFleetVehicleCandidates(grouped, '1234-abc')).toHaveLength(1);
  });

  it('completa la marca desde el detalle auténtico de Rently cuando la flota no la aporta', () => {
    const result = resolveSesVehicleData({
      reservation: { auto: '1234ABC', modelo: 'X1' },
      fleetVehicles: [{ matricula: '1234ABC', marca: null, modelo: 'X1' }],
      detail: { Car: { Plate: '1234ABC', Model: { Name: 'X1', Brand: { Name: 'BMW' } } } },
    });
    expect(result).toMatchObject({ vehicle_brand: 'BMW', vehicle_model: 'X1', vehicle_plate: '1234ABC' });
  });

  it('prioriza la flota frente al detalle Rently cuando la flota tiene una marca fiable', () => {
    const result = resolveSesVehicleData({
      reservation: { auto: '1234ABC' },
      fleetVehicles: [{ matricula: '1234ABC', marca: 'Mercedes-Benz', modelo: 'Clase A' }],
      detail: { Car: { Model: { Brand: { Name: 'BMW' }, Name: 'X1' } } },
    });
    expect(result.vehicle_brand).toBe('MERCEDES');
    expect(result.vehicle_model).toBe('Clase A');
  });

  it('no inventa la marca cuando falta en todas las fuentes', () => {
    const result = resolveSesVehicleData({
      reservation: { auto: '1234ABC', modelo: 'X1' },
      fleetVehicles: [{ matricula: '1234ABC', marca: null, modelo: 'X1' }],
    });
    expect(result.vehicle_brand).toBeNull();
    expect(result.vehicle_model).toBe('X1');
  });

  it('ignora valores vacíos del detalle y conserva los datos válidos disponibles', () => {
    const result = resolveSesVehicleData({
      reservation: { auto: '1234ABC', modelo: 'X1', vehiculo_color: 'White' },
      fleetVehicles: [],
      detail: { Car: { Plate: '', Color: '', Model: { Name: '', Brand: { Name: '' } } } },
    });
    expect(result).toMatchObject({ vehicle_plate: '1234ABC', vehicle_model: 'X1', vehicle_color: 'BLANCO', vehicle_brand: null });
  });

  it('permite actualizar el resto del vehículo sin sobrescribir una marca manual', () => {
    const automatic = resolveSesVehicleData({
      reservation: { auto: '1234ABC', modelo: 'X1' },
      detail: { Car: { Plate: '1234ABC', Model: { Name: 'X1', Brand: { Name: 'BMW' } } } },
    });
    const merged = mergeSesRentlyFields({
      existing: { vehicle_brand: 'MERCEDES', vehicle_model: 'Anterior', vehicle_plate: '1234ABC' },
      incoming: automatic,
      manualFields: ['vehicle_brand'],
    });
    expect(merged.values).toMatchObject({ vehicle_brand: 'MERCEDES', vehicle_model: 'X1', vehicle_plate: '1234ABC' });
  });

  it('no toma un valor arbitrario de filas de flota ambiguas con marcas distintas', () => {
    const result = resolveSesVehicleData({
      reservation: { auto: '1234ABC', modelo: 'X1' },
      fleetVehicles: [
        { matricula: '1234 ABC', marca: 'BMW', modelo: 'X1' },
        { matricula: '1234-ABC', marca: 'Mercedes-Benz', modelo: 'X1' },
      ],
      detail: { Car: { Model: { Brand: { Name: 'BMW' } } } },
    });
    expect(result.vehicle_brand).toBe('BMW');
    expect(result.fleet_match_count).toBe(2);
  });

  it('solo solicita detalle mientras no exista una marca fiable guardada o en flota', () => {
    expect(needsRentlyVehicleDetail({ fleetVehicles: [{ marca: null }] })).toBe(true);
    expect(needsRentlyVehicleDetail({ fleetVehicles: [{ marca: 'BMW' }] })).toBe(false);
    expect(needsRentlyVehicleDetail({ existingDraft: { vehicle_brand: 'BMW' }, fleetVehicles: [{ marca: null }] })).toBe(false);
    expect(needsRentlyVehicleDetail({
      existingDraft: { vehicle_brand: 'BMW', manual_fields: ['vehicle_brand'] },
      fleetVehicles: [{ marca: null }],
    })).toBe(false);
  });
});
