import { describe, expect, it } from 'vitest';
import { normalizeSesVehicleBrand, normalizeSesVehicleColor } from './codes';

describe('SES official vehicle codes', () => {
  it('maps common Rently brands to official SES codes', () => {
    expect(normalizeSesVehicleBrand('Mercedes-Benz')).toBe('MERCEDES');
    expect(normalizeSesVehicleBrand('Land Rover')).toBe('LAND_ROVER');
    expect(normalizeSesVehicleBrand('BMW')).toBe('BMW');
  });

  it('maps common colors and safely falls back to OTRO', () => {
    expect(normalizeSesVehicleColor('White')).toBe('BLANCO');
    expect(normalizeSesVehicleColor('Gris')).toBe('GRIS');
    expect(normalizeSesVehicleColor('color comercial especial')).toBe('OTRO');
  });
});
