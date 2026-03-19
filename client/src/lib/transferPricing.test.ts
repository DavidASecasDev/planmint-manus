import { describe, it, expect } from 'vitest';
import {
  getBasePrice,
  calculatePriceWithCommission,
  getCommissionAmount,
  getZoneLabel,
  getVehicleInfo,
  ZONE_PRICES,
  TRANSFER_ZONES,
  VEHICLE_TYPES,
} from './transferPricing';

describe('getBasePrice', () => {
  it('returns correct price for known zone and vehicle', () => {
    expect(getBasePrice('palma', 'mb_eqe')).toBe(79);
    expect(getBasePrice('palma', 's_class')).toBe(112);
    expect(getBasePrice('alcudia', 'sprinter')).toBe(374);
  });

  it('returns null for unknown zone', () => {
    expect(getBasePrice('unknown_zone', 'mb_eqe')).toBeNull();
  });

  it('returns null for unknown vehicle type', () => {
    expect(getBasePrice('palma', 'unknown_vehicle')).toBeNull();
  });

  it('returns null for both unknown', () => {
    expect(getBasePrice('nowhere', 'nothing')).toBeNull();
  });
});

describe('calculatePriceWithCommission', () => {
  it('adds 50% commission to base price', () => {
    expect(calculatePriceWithCommission(100)).toBe(150);
    expect(calculatePriceWithCommission(200)).toBe(300);
  });

  it('rounds to nearest integer', () => {
    expect(calculatePriceWithCommission(79)).toBe(119); // 79 * 1.5 = 118.5 -> 119
  });

  it('handles zero', () => {
    expect(calculatePriceWithCommission(0)).toBe(0);
  });
});

describe('getCommissionAmount', () => {
  it('returns 50% of base price', () => {
    expect(getCommissionAmount(100)).toBe(50);
    expect(getCommissionAmount(200)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(getCommissionAmount(79)).toBe(40); // 79 * 0.5 = 39.5 -> 40
  });

  it('handles zero', () => {
    expect(getCommissionAmount(0)).toBe(0);
  });
});

describe('getZoneLabel', () => {
  it('returns label for known zones', () => {
    expect(getZoneLabel('palma')).toBe('Palma');
    expect(getZoneLabel('alcudia')).toBe('Alcudia');
    expect(getZoneLabel('cala_dor')).toBe("Cala d'Or");
    expect(getZoneLabel('deia')).toBe('Deia');
    expect(getZoneLabel('soller')).toBe('Sóller');
  });

  it('returns the key as-is for unknown zones', () => {
    expect(getZoneLabel('unknown_zone')).toBe('unknown_zone');
  });
});

describe('getVehicleInfo', () => {
  it('returns label and capacity for known vehicles', () => {
    const eqe = getVehicleInfo('mb_eqe');
    expect(eqe).toEqual({ label: 'MB EQE (Premium)', capacity: 3 });

    const sprinter = getVehicleInfo('sprinter');
    expect(sprinter).toEqual({ label: 'MB Sprinter (Minibus)', capacity: 20 });
  });

  it('returns null for unknown vehicle type', () => {
    expect(getVehicleInfo('unknown')).toBeNull();
  });
});

describe('data integrity', () => {
  it('all zones have prices for all vehicle types', () => {
    const vehicleKeys = VEHICLE_TYPES.map(v => v.key);
    for (const zone of TRANSFER_ZONES) {
      const prices = ZONE_PRICES[zone.key];
      expect(prices).toBeDefined();
      for (const vKey of vehicleKeys) {
        expect(prices[vKey]).toBeGreaterThan(0);
      }
    }
  });

  it('all zone keys are unique', () => {
    const keys = TRANSFER_ZONES.map(z => z.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all vehicle keys are unique', () => {
    const keys = VEHICLE_TYPES.map(v => v.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
