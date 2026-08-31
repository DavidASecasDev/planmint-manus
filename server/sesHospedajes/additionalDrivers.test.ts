import { describe, expect, it } from 'vitest';
import { mapStoredRentlyDriverToCustomer, parseStoredRentlyDrivers } from './additionalDrivers';

describe('conductores adicionales Rently para SES', () => {
  it('recupera identidad y permiso sin inventar los datos que Rently no entrega', () => {
    const [driver] = parseStoredRentlyDrivers('[{"nombre":"Persona Sintética","documento":"ab-123","carnet":"lic-9"}]');
    expect(mapStoredRentlyDriverToCustomer(driver)).toEqual({
      Firstname: 'Persona', Lastname: 'Sintética', DocumentId: 'AB123', DriverLicenceNumber: 'LIC9',
    });
  });

  it('omite registros sin documento o apellido en vez de completar datos ficticios', () => {
    expect(mapStoredRentlyDriverToCustomer({ nombre: 'Persona', documento: 'AB123' })).toBeNull();
    expect(mapStoredRentlyDriverToCustomer({ nombre: 'Persona Sintética' })).toBeNull();
    expect(parseStoredRentlyDrivers('no-json')).toEqual([]);
  });
});
