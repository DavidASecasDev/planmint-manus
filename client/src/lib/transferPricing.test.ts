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
  getEstimatedPointToPointDynamic,
  getEstimatedPackDynamic,
  lookupDynamicPrice,
  ZONE_PRICES,
  PACK_PRICES,
  TRANSFER_ZONES,
  VEHICLE_TYPES,
  PACK_DURATIONS,
  type DynamicPricingRow,
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

// ── Dynamic pricing tests ──────────────────────────────────────────

const mockPricingRows: DynamicPricingRow[] = [
  {
    id: '1',
    zone_key: 'palma',
    zone_label: 'Palma',
    vehicle_type: 'v_class',
    base_price: 100,
    commission_price: 150,
    service_type: 'point_to_point',
    pack_duration: null,
    is_active: true,
  },
  {
    id: '2',
    zone_key: 'palma',
    zone_label: 'Palma',
    vehicle_type: 'v_class',
    base_price: 400,
    commission_price: 600,
    service_type: 'pack',
    pack_duration: '4h',
    is_active: true,
  },
  {
    id: '3',
    zone_key: 'alcudia',
    zone_label: 'Alcudia',
    vehicle_type: 'sprinter',
    base_price: 350,
    commission_price: 525,
    service_type: 'point_to_point',
    pack_duration: null,
    is_active: false, // inactive
  },
];

describe('lookupDynamicPrice', () => {
  it('finds active pricing row for point_to_point', () => {
    const result = lookupDynamicPrice(mockPricingRows, 'palma', 'v_class', 'point_to_point');
    expect(result).toEqual({ base: 100, commission: 150 });
  });

  it('finds active pricing row for pack with duration', () => {
    const result = lookupDynamicPrice(mockPricingRows, 'palma', 'v_class', 'pack', '4h');
    expect(result).toEqual({ base: 400, commission: 600 });
  });

  it('returns null for inactive rows', () => {
    const result = lookupDynamicPrice(mockPricingRows, 'alcudia', 'sprinter', 'point_to_point');
    expect(result).toBeNull();
  });

  it('returns null when no match found', () => {
    const result = lookupDynamicPrice(mockPricingRows, 'soller', 'v_class', 'point_to_point');
    expect(result).toBeNull();
  });
});

describe('getEstimatedPointToPointDynamic', () => {
  it('uses dynamic price when available (external_client gets commission)', () => {
    const price = getEstimatedPointToPointDynamic(mockPricingRows, 'palma', 'v_class', 'external_client');
    expect(price).toBe(150); // commission_price from DB
  });

  it('uses dynamic price when available (broker_client gets base)', () => {
    const price = getEstimatedPointToPointDynamic(mockPricingRows, 'palma', 'v_class', 'broker_client');
    expect(price).toBe(100); // base_price from DB
  });

  it('falls back to hardcoded when no dynamic match', () => {
    const price = getEstimatedPointToPointDynamic(mockPricingRows, 'soller', 'v_class', 'broker_client');
    // Should fall back to hardcoded ZONE_PRICES
    expect(price).toBe(ZONE_PRICES['soller']['v_class']);
  });

  it('falls back to hardcoded for inactive rows', () => {
    const price = getEstimatedPointToPointDynamic(mockPricingRows, 'alcudia', 'sprinter', 'broker_client');
    expect(price).toBe(ZONE_PRICES['alcudia']['sprinter']);
  });
});

describe('getEstimatedPackDynamic', () => {
  it('uses dynamic price for pack (external_client)', () => {
    const price = getEstimatedPackDynamic(mockPricingRows, 'palma', 'v_class', '4h', 'external_client');
    expect(price).toBe(600); // commission_price from DB
  });

  it('uses dynamic price for pack (broker_client)', () => {
    const price = getEstimatedPackDynamic(mockPricingRows, 'palma', 'v_class', '4h', 'broker_client');
    expect(price).toBe(400); // base_price from DB
  });

  it('falls back to hardcoded when no dynamic match', () => {
    const price = getEstimatedPackDynamic(mockPricingRows, 'soller', 'v_class', '4h', 'broker_client');
    expect(price).toBe(PACK_PRICES['v_class']['4h']);
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
