import { describe, it, expect } from 'vitest';
import {
  getBasePrice,
  calculatePriceWithCommission,
  getCommissionAmount,
  getZoneLabel,
  getVehicleInfo,
  getEstimatedPointToPoint,
  getEstimatedPack,
  getPackBasePrice,
  ZONE_PRICES,
  PACK_PRICES,
  TRANSFER_ZONES,
  VEHICLE_TYPES,
  PACK_DURATIONS,
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

describe('getEstimatedPointToPoint', () => {
  it('returns base price * 1.5 for external_client', () => {
    const base = getBasePrice('palma', 'v_class');
    expect(base).not.toBeNull();
    const estimated = getEstimatedPointToPoint('palma', 'v_class', 'external_client');
    expect(estimated).toBe(calculatePriceWithCommission(base!));
  });

  it('returns base price only for broker_client', () => {
    const base = getBasePrice('palma', 'v_class');
    expect(base).not.toBeNull();
    const estimated = getEstimatedPointToPoint('palma', 'v_class', 'broker_client');
    expect(estimated).toBe(base);
  });

  it('returns null for unknown zone', () => {
    expect(getEstimatedPointToPoint('unknown', 'v_class', 'external_client')).toBeNull();
  });

  it('returns null for unknown vehicle', () => {
    expect(getEstimatedPointToPoint('palma', 'unknown', 'broker_client')).toBeNull();
  });

  it('external_client price is always higher than broker_client', () => {
    for (const zone of TRANSFER_ZONES) {
      for (const vehicle of VEHICLE_TYPES) {
        const ext = getEstimatedPointToPoint(zone.key, vehicle.key, 'external_client');
        const brk = getEstimatedPointToPoint(zone.key, vehicle.key, 'broker_client');
        if (ext !== null && brk !== null) {
          expect(ext).toBeGreaterThan(brk);
        }
      }
    }
  });
});

describe('getEstimatedPack', () => {
  it('returns pack price * 1.5 for external_client', () => {
    const base = getPackBasePrice('v_class', '4h');
    expect(base).not.toBeNull();
    const estimated = getEstimatedPack('v_class', '4h', 'external_client');
    expect(estimated).toBe(calculatePriceWithCommission(base!));
  });

  it('returns pack base price for broker_client', () => {
    const base = getPackBasePrice('v_class', '4h');
    expect(base).not.toBeNull();
    const estimated = getEstimatedPack('v_class', '4h', 'broker_client');
    expect(estimated).toBe(base);
  });

  it('returns null for unknown vehicle', () => {
    expect(getEstimatedPack('unknown', '4h', 'external_client')).toBeNull();
  });

  it('returns null for unknown duration', () => {
    expect(getEstimatedPack('v_class', '99h', 'broker_client')).toBeNull();
  });
});

describe('getPackBasePrice', () => {
  it('returns correct pack price for known vehicle and duration', () => {
    const price = getPackBasePrice('v_class', '4h');
    expect(price).toBeGreaterThan(0);
  });

  it('returns null for unknown vehicle', () => {
    expect(getPackBasePrice('unknown', '4h')).toBeNull();
  });

  it('returns null for unknown duration', () => {
    expect(getPackBasePrice('v_class', '99h')).toBeNull();
  });
});

describe('PACK_DURATIONS', () => {
  it('has expected duration options', () => {
    const keys = PACK_DURATIONS.map(d => d.key);
    expect(keys).toContain('2h');
    expect(keys).toContain('4h');
    expect(keys).toContain('8h');
    expect(keys).toContain('12h');
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
