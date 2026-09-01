import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const endpointSource = fs.readFileSync(path.join(process.cwd(), 'server/sesHospedajes/sesEndpoints.ts'), 'utf8');

describe('integración del vehículo en todos los recorridos SES', () => {
  it('usa el resolver central en sincronización y preparación', () => {
    expect((endpointSource.match(/resolveSesVehicleData\(/g) ?? []).length).toBe(2);
    expect((endpointSource.match(/groupFleetVehiclesByPlate\(/g) ?? []).length).toBe(2);
    expect(endpointSource).not.toContain('fleetMap.get(reservation.auto)');
    expect(endpointSource).not.toContain('normalizeSesVehicleBrand(fleet?.marca)');
  });

  it('obtiene detalle Rently solo para reservas sin una marca fiable', () => {
    expect(endpointSource).toContain('needsRentlyVehicleDetail');
    expect(endpointSource).toContain('forceEnrichment: true');
    expect(endpointSource).toContain('vehicleEnrichment.detailsByReservationId.get(reservation.id)');
  });
});
