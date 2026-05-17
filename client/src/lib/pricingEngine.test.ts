import { describe, it, expect } from 'vitest';
import {
  calculatePointToPointPricing,
  calculatePackPricing,
  VAT_PROVIDER,
  VAT_CLIENT,
  COMMISSION_RATE,
} from './pricingEngine';

describe('pricingEngine', () => {
  describe('calculatePointToPointPricing', () => {
    it('calculates Palma Premium correctly with no supplements', () => {
      const result = calculatePointToPointPricing('palma', 'mb_eqe');
      expect(result).not.toBeNull();
      if (!result) return;

      // Base price for Palma, MB EQE = 79€
      expect(result.basePrice).toBe(79);
      expect(result.totalSupplements).toBe(0);
      expect(result.airportPickupFee).toBe(0);
      expect(result.nightFee).toBe(0);

      // Provider: 79 + 10% IVA = 86.90
      expect(result.providerNet).toBe(79);
      expect(result.providerVat).toBeCloseTo(7.9, 2);
      expect(result.providerTotal).toBeCloseTo(86.9, 2);

      // Commission: 50% of 86.90 = 43.45
      expect(result.commissionAmount).toBeCloseTo(43.45, 2);

      // Client net: 79 + 43.45 = 122.45
      expect(result.clientNet).toBeCloseTo(122.45, 2);

      // Client IVA 21%: 122.45 * 0.21 = 25.71
      expect(result.clientVat).toBeCloseTo(25.71, 1);

      // Client total: 122.45 + 25.71 = 148.16
      expect(result.clientTotal).toBeCloseTo(148.16, 0);
    });

    it('calculates with airport pickup supplement', () => {
      const result = calculatePointToPointPricing('palma', 'mb_eqe', { airportPickup: true });
      expect(result).not.toBeNull();
      if (!result) return;

      // Base 79 + airport pickup 20 = 99 provider net
      expect(result.basePrice).toBe(79);
      expect(result.airportPickupFee).toBe(20);
      expect(result.providerNet).toBe(99);
    });

    it('calculates with night fee supplement', () => {
      const result = calculatePointToPointPricing('palma', 'mb_eqe', { nightHours: 2 });
      expect(result).not.toBeNull();
      if (!result) return;

      // Base 79 + night 2h * 20€/h = 40 → provider net = 119
      expect(result.basePrice).toBe(79);
      expect(result.nightFee).toBe(40);
      expect(result.providerNet).toBe(119);
    });

    it('calculates with both supplements', () => {
      const result = calculatePointToPointPricing('palma', 'mb_eqe', {
        airportPickup: true,
        nightHours: 2,
      });
      expect(result).not.toBeNull();
      if (!result) return;

      // Base 79 + airport 20 + night 40 = 139
      expect(result.providerNet).toBe(139);
      expect(result.totalSupplements).toBe(60);
    });

    it('uses Sprinter rates for supplements', () => {
      const result = calculatePointToPointPricing('palma', 'sprinter', {
        airportPickup: true,
        nightHours: 1,
      });
      expect(result).not.toBeNull();
      if (!result) return;

      // Sprinter: airport 25, night 40/h
      expect(result.airportPickupFee).toBe(25);
      expect(result.nightFee).toBe(40);
      // Base 253 + 25 + 40 = 318
      expect(result.providerNet).toBe(318);
    });

    it('returns null for invalid zone', () => {
      const result = calculatePointToPointPricing('nonexistent', 'mb_eqe');
      expect(result).toBeNull();
    });

    it('returns null for invalid vehicle', () => {
      const result = calculatePointToPointPricing('palma', 'nonexistent');
      expect(result).toBeNull();
    });

    it('applies 10% IVA to provider and 21% to client', () => {
      const result = calculatePointToPointPricing('formentor', 'v_class');
      expect(result).not.toBeNull();
      if (!result) return;

      // Formentor V Class = 231€
      expect(result.basePrice).toBe(231);
      expect(result.providerVat).toBeCloseTo(231 * 0.10, 2);
      expect(result.clientVat).toBeCloseTo(result.clientNet * 0.21, 1);
    });
  });

  describe('calculatePackPricing', () => {
    it('calculates 4h V Class pack correctly', () => {
      const result = calculatePackPricing('v_class', '4h');
      expect(result).not.toBeNull();
      if (!result) return;

      // Pack V Class 4h = 462€
      expect(result.basePrice).toBe(462);
      expect(result.providerNet).toBe(462);
    });

    it('calculates pack with supplements', () => {
      const result = calculatePackPricing('sprinter', '8h', {
        airportPickup: true,
        nightHours: 3,
      });
      expect(result).not.toBeNull();
      if (!result) return;

      // Sprinter 8h = 1309, airport 25, night 3*40=120
      expect(result.basePrice).toBe(1309);
      expect(result.airportPickupFee).toBe(25);
      expect(result.nightFee).toBe(120);
      expect(result.providerNet).toBe(1309 + 25 + 120);
    });

    it('returns null for invalid pack duration', () => {
      const result = calculatePackPricing('mb_eqe', '99h');
      expect(result).toBeNull();
    });
  });

  describe('constants', () => {
    it('has correct VAT rates', () => {
      expect(VAT_PROVIDER).toBe(0.10);
      expect(VAT_CLIENT).toBe(0.21);
    });

    it('has correct commission rate', () => {
      expect(COMMISSION_RATE).toBe(0.50);
    });
  });

  describe('real-world scenario: Formentor Sprinter with all supplements', () => {
    it('calculates the full breakdown correctly', () => {
      const result = calculatePointToPointPricing('formentor', 'sprinter', {
        airportPickup: true,
        nightHours: 2,
      });
      expect(result).not.toBeNull();
      if (!result) return;

      // Base: 440, airport: 25, night: 2*40=80
      const expectedProviderNet = 440 + 25 + 80; // 545
      expect(result.providerNet).toBe(expectedProviderNet);

      // Provider total with 10% IVA
      const expectedProviderTotal = expectedProviderNet * 1.10; // 599.50
      expect(result.providerTotal).toBeCloseTo(expectedProviderTotal, 1);

      // Commission: 50% of provider total
      const expectedCommission = expectedProviderTotal * 0.50; // 299.75
      expect(result.commissionAmount).toBeCloseTo(expectedCommission, 1);

      // Client net: providerNet + commission
      expect(result.clientNet).toBeCloseTo(expectedProviderNet + expectedCommission, 1);

      // Client total with 21% IVA
      expect(result.clientTotal).toBeCloseTo(result.clientNet * 1.21, 0);
    });
  });
});
