import { describe, it, expect } from 'vitest';
// Import only the pure calculation function (no Supabase dependency)
// The async syncRequestTotals function is tested via integration tests
import { calculateRequestTotals } from './syncRequestTotals.pure';

describe('calculateRequestTotals', () => {
  describe('zone_tariff mode', () => {
    it('calculates totals from items with price_with_commission and base_price', () => {
      const items = [
        { price_with_commission: 150, base_price: 100, provider_cost: null },
        { price_with_commission: 225, base_price: 150, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      expect(result.clientTotal).toBe(375);
      expect(result.providerCost).toBe(250);
      expect(result.internalMargin).toBe(125);
    });

    it('uses base_price as fallback when price_with_commission is null', () => {
      const items = [
        { price_with_commission: null, base_price: 100, provider_cost: null },
        { price_with_commission: 200, base_price: 130, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      // clientTotal: 100 (fallback) + 200 = 300
      // providerCost: 100 + 130 = 230
      expect(result.clientTotal).toBe(300);
      expect(result.providerCost).toBe(230);
      expect(result.internalMargin).toBe(70);
    });

    it('handles empty items array', () => {
      const result = calculateRequestTotals([], 'zone_tariff');
      expect(result.clientTotal).toBe(0);
      expect(result.providerCost).toBe(0);
      expect(result.internalMargin).toBe(0);
    });

    it('handles items with all null values', () => {
      const items = [
        { price_with_commission: null, base_price: null, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      expect(result.clientTotal).toBe(0);
      expect(result.providerCost).toBe(0);
      expect(result.internalMargin).toBe(0);
    });

    it('ignores provider_cost in zone_tariff mode', () => {
      const items = [
        { price_with_commission: 150, base_price: 100, provider_cost: 80 },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      // In zone_tariff mode, providerCost = sum of base_price, NOT provider_cost
      expect(result.providerCost).toBe(100);
      expect(result.internalMargin).toBe(50);
    });
  });

  describe('provider_quote mode', () => {
    it('uses provider_cost for providerCost calculation', () => {
      const items = [
        { price_with_commission: 200, base_price: 130, provider_cost: 110 },
        { price_with_commission: 300, base_price: 200, provider_cost: 170 },
      ];
      const result = calculateRequestTotals(items, 'provider_quote');
      expect(result.clientTotal).toBe(500);
      expect(result.providerCost).toBe(280); // 110 + 170
      expect(result.internalMargin).toBe(220); // 500 - 280
    });

    it('falls back to base_price when provider_cost is null', () => {
      const items = [
        { price_with_commission: 200, base_price: 130, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'provider_quote');
      expect(result.providerCost).toBe(130); // fallback to base_price
    });

    it('handles mixed items (some with provider_cost, some without)', () => {
      const items = [
        { price_with_commission: 200, base_price: 130, provider_cost: 110 },
        { price_with_commission: 150, base_price: 100, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'provider_quote');
      expect(result.clientTotal).toBe(350);
      expect(result.providerCost).toBe(210); // 110 + 100 (fallback)
      expect(result.internalMargin).toBe(140);
    });
  });

  describe('rounding', () => {
    it('rounds to 2 decimal places', () => {
      const items = [
        { price_with_commission: 100.333, base_price: 66.666, provider_cost: null },
        { price_with_commission: 200.777, base_price: 133.444, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      expect(result.clientTotal).toBe(301.11);
      expect(result.providerCost).toBe(200.11);
      expect(result.internalMargin).toBe(101);
    });
  });

  describe('single item scenarios', () => {
    it('works with a single item in zone_tariff mode', () => {
      const items = [
        { price_with_commission: 250, base_price: 180, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      expect(result.clientTotal).toBe(250);
      expect(result.providerCost).toBe(180);
      expect(result.internalMargin).toBe(70);
    });

    it('works with a single item in provider_quote mode', () => {
      const items = [
        { price_with_commission: 250, base_price: 180, provider_cost: 160 },
      ];
      const result = calculateRequestTotals(items, 'provider_quote');
      expect(result.clientTotal).toBe(250);
      expect(result.providerCost).toBe(160);
      expect(result.internalMargin).toBe(90);
    });
  });

  describe('negative margin scenarios', () => {
    it('allows negative margin when client price is less than provider cost', () => {
      const items = [
        { price_with_commission: 80, base_price: 100, provider_cost: null },
      ];
      const result = calculateRequestTotals(items, 'zone_tariff');
      expect(result.clientTotal).toBe(80);
      expect(result.providerCost).toBe(100);
      expect(result.internalMargin).toBe(-20);
    });
  });
});
