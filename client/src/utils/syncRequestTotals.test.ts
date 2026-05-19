import { describe, it, expect } from 'vitest';
// Import only the pure calculation function (no Supabase dependency)
import { calculateRequestTotals } from './syncRequestTotals.pure';

describe('calculateRequestTotals', () => {
  it('calculates totals from items with price_with_commission and base_price', () => {
    const items = [
      { price_with_commission: 150, base_price: 100, provider_cost: null },
      { price_with_commission: 225, base_price: 150, provider_cost: null },
    ];
    const result = calculateRequestTotals(items);
    expect(result.clientTotal).toBe(375);
    expect(result.providerCost).toBe(250);
    expect(result.internalMargin).toBe(125);
  });

  it('uses base_price as fallback when price_with_commission is null', () => {
    const items = [
      { price_with_commission: null, base_price: 100, provider_cost: null },
      { price_with_commission: 200, base_price: 130, provider_cost: null },
    ];
    const result = calculateRequestTotals(items);
    // clientTotal: 100 (fallback) + 200 = 300
    // providerCost: 100 + 130 = 230
    expect(result.clientTotal).toBe(300);
    expect(result.providerCost).toBe(230);
    expect(result.internalMargin).toBe(70);
  });

  it('handles empty items array', () => {
    const result = calculateRequestTotals([]);
    expect(result.clientTotal).toBe(0);
    expect(result.providerCost).toBe(0);
    expect(result.internalMargin).toBe(0);
  });

  it('handles items with all null values', () => {
    const items = [
      { price_with_commission: null, base_price: null, provider_cost: null },
    ];
    const result = calculateRequestTotals(items);
    expect(result.clientTotal).toBe(0);
    expect(result.providerCost).toBe(0);
    expect(result.internalMargin).toBe(0);
  });

  it('uses base_price as provider cost regardless of provider_cost field', () => {
    const items = [
      { price_with_commission: 150, base_price: 100, provider_cost: 80 },
    ];
    const result = calculateRequestTotals(items);
    // providerCost always = sum of base_price
    expect(result.providerCost).toBe(100);
    expect(result.internalMargin).toBe(50);
  });

  describe('rounding', () => {
    it('rounds to 2 decimal places', () => {
      const items = [
        { price_with_commission: 100.333, base_price: 66.666, provider_cost: null },
        { price_with_commission: 200.777, base_price: 133.444, provider_cost: null },
      ];
      const result = calculateRequestTotals(items);
      expect(result.clientTotal).toBe(301.11);
      expect(result.providerCost).toBe(200.11);
      expect(result.internalMargin).toBe(101);
    });
  });

  describe('single item scenarios', () => {
    it('works with a single item', () => {
      const items = [
        { price_with_commission: 250, base_price: 180, provider_cost: null },
      ];
      const result = calculateRequestTotals(items);
      expect(result.clientTotal).toBe(250);
      expect(result.providerCost).toBe(180);
      expect(result.internalMargin).toBe(70);
    });
  });

  describe('negative margin scenarios', () => {
    it('allows negative margin when client price is less than provider cost', () => {
      const items = [
        { price_with_commission: 80, base_price: 100, provider_cost: null },
      ];
      const result = calculateRequestTotals(items);
      expect(result.clientTotal).toBe(80);
      expect(result.providerCost).toBe(100);
      expect(result.internalMargin).toBe(-20);
    });
  });
});
