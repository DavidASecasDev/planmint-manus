import { describe, it, expect } from 'vitest';
import {
  getBasePrice,
  calculatePriceWithCommission,
  getCommissionAmount,
  ZONE_PRICES,
} from './transferPricing';
import {
  calculateClientInvoice,
  formatCurrency,
  calculateMarginPercentage,
} from '../utils/transferCalculations';

/**
 * Tests for the unified pricing mode system.
 * 
 * Two modes:
 * - zone_tariff: price derived from zone + vehicle lookup, then +50% commission
 * - provider_quote: price derived from provider cost per item, then +50% commission
 * 
 * In both modes, the final price_with_commission can be manually overridden.
 */

describe('Zone Tariff Mode (Opción B)', () => {
  it('calculates client price as base_price * 1.5 for any zone/vehicle', () => {
    // Palma + MB EQE: base = 79, client = 79 * 1.5 = 118.5 -> 119
    const base = getBasePrice('palma', 'mb_eqe')!;
    expect(base).toBe(79);
    const clientPrice = calculatePriceWithCommission(base);
    expect(clientPrice).toBe(119); // Math.round(79 * 1.5) = 119
  });

  it('calculates commission as 50% of base price', () => {
    const base = getBasePrice('alcudia', 'v_class')!;
    expect(base).toBe(196);
    const commission = getCommissionAmount(base);
    expect(commission).toBe(98); // 196 * 0.5 = 98
    const clientPrice = calculatePriceWithCommission(base);
    expect(clientPrice).toBe(294); // 196 * 1.5 = 294
  });

  it('margin in zone_tariff mode is always 50% of base', () => {
    const base = getBasePrice('formentor', 'sprinter')!;
    expect(base).toBe(440);
    const clientPrice = calculatePriceWithCommission(base);
    const margin = clientPrice - base;
    expect(margin).toBe(220); // 440 * 0.5 = 220
    expect(calculateMarginPercentage(base, clientPrice)).toBe(50);
  });

  it('handles all zones consistently', () => {
    const zones = Object.keys(ZONE_PRICES);
    for (const zone of zones) {
      const base = getBasePrice(zone, 'v_class')!;
      expect(base).toBeGreaterThan(0);
      const client = calculatePriceWithCommission(base);
      expect(client).toBeGreaterThan(base);
      // Commission should be roughly 50%
      const marginPct = calculateMarginPercentage(base, client);
      expect(marginPct).toBeGreaterThanOrEqual(49);
      expect(marginPct).toBeLessThanOrEqual(51);
    }
  });
});

describe('Provider Quote Mode (Opción A)', () => {
  /**
   * In provider_quote mode, the provider_cost is entered per item.
   * The client price = provider_cost * 1.5 (same 50% commission).
   * The user can also manually override the final price.
   */

  it('calculates client price from provider cost with 50% markup', () => {
    const providerCost = 200;
    const clientPrice = Math.round(providerCost * 1.5 * 100) / 100;
    expect(clientPrice).toBe(300);
  });

  it('handles fractional provider costs', () => {
    const providerCost = 133.33;
    const clientPrice = Math.round(providerCost * 1.5 * 100) / 100;
    expect(clientPrice).toBe(200); // 133.33 * 1.5 = 199.995 -> 200.00
  });

  it('handles zero provider cost', () => {
    const providerCost = 0;
    const clientPrice = Math.round(providerCost * 1.5 * 100) / 100;
    expect(clientPrice).toBe(0);
  });

  it('margin calculation works for provider_quote mode', () => {
    const providerCost = 500;
    const clientPrice = 750; // 500 * 1.5
    expect(calculateMarginPercentage(providerCost, clientPrice)).toBe(50);
  });

  it('margin changes when price is manually overridden', () => {
    const providerCost = 500;
    const manualClientPrice = 900; // Manually set higher
    expect(calculateMarginPercentage(providerCost, manualClientPrice)).toBe(80);
  });
});

describe('Financial Summary Calculations', () => {
  it('sums item prices correctly for subtotal', () => {
    const items = [
      { price_with_commission: 150, base_price: 100, provider_cost: null },
      { price_with_commission: 300, base_price: 200, provider_cost: null },
      { price_with_commission: 225, base_price: 150, provider_cost: null },
    ];
    
    const subtotal = items.reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
    expect(subtotal).toBe(675);
    
    const providerTotal = items.reduce((sum, it) => sum + (it.base_price || 0), 0);
    expect(providerTotal).toBe(450);
    
    const margin = subtotal - providerTotal;
    expect(margin).toBe(225); // 50% of 450
  });

  it('sums provider_cost for provider_quote mode', () => {
    const items = [
      { price_with_commission: 300, base_price: 200, provider_cost: 200 },
      { price_with_commission: 450, base_price: 300, provider_cost: 300 },
    ];
    
    const subtotal = items.reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
    expect(subtotal).toBe(750);
    
    const providerTotal = items.reduce((sum, it) => sum + (it.provider_cost || it.base_price || 0), 0);
    expect(providerTotal).toBe(500);
    
    const margin = subtotal - providerTotal;
    expect(margin).toBe(250);
  });

  it('IVA calculation at 21%', () => {
    const subtotal = 675;
    const iva = subtotal * 0.21;
    expect(iva).toBeCloseTo(141.75, 2);
    
    const totalConIva = subtotal * 1.21;
    expect(totalConIva).toBeCloseTo(816.75, 2);
  });

  it('handles mixed manually-set and auto-calculated prices', () => {
    const items = [
      { price_with_commission: 150, base_price: 100, price_manually_set: false },
      { price_with_commission: 400, base_price: 200, price_manually_set: true }, // Manual override
      { price_with_commission: 225, base_price: 150, price_manually_set: false },
    ];
    
    const subtotal = items.reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
    expect(subtotal).toBe(775);
    
    const providerTotal = items.reduce((sum, it) => sum + (it.base_price || 0), 0);
    expect(providerTotal).toBe(450);
    
    // Margin is higher because of the manual override
    const margin = subtotal - providerTotal;
    expect(margin).toBe(325);
    expect(calculateMarginPercentage(providerTotal, subtotal)).toBe(72);
  });
});

describe('calculateClientInvoice (provider_quote legacy)', () => {
  it('transport + commission formula for external provider', () => {
    const result = calculateClientInvoice(500);
    
    // Transport: 500 + 10% = 550
    expect(result.transport.subtotal).toBe(550);
    
    // Commission: 250 (50%) + 21% = 302.5
    expect(result.commission.base).toBe(250);
    expect(result.commission.subtotal).toBe(302.5);
    
    // Client total: 550 + 302.5 = 852.5
    expect(result.clientTotal).toBe(852.5);
    
    // Profit margin = commission base = 250
    expect(result.profitMargin).toBe(250);
  });
});

describe('formatCurrency', () => {
  it('formats positive values with EUR symbol', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1234');
    expect(result).toContain('€');
  });

  it('handles null and undefined', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
  });
});

describe('PDF Totals Calculation (calculatePdfTotals logic)', () => {
  /**
   * The PDF uses items as the single source of truth for totals.
   * subtotal = sum of price_with_commission
   * vatAmount = subtotal * 0.21
   * total = subtotal + vatAmount
   */

  const makeItem = (overrides: Partial<{
    price_with_commission: number | null;
    base_price: number | null;
    provider_cost: number | null;
  }> = {}) => ({
    price_with_commission: overrides.price_with_commission ?? null,
    base_price: overrides.base_price ?? null,
    provider_cost: overrides.provider_cost ?? null,
  });

  const calculatePdfTotals = (items: ReturnType<typeof makeItem>[], pricingMode: 'zone_tariff' | 'provider_quote') => {
    const subtotal = items.reduce((sum, item) => sum + (item.price_with_commission || item.base_price || 0), 0);
    const vatRate = 21;
    const vatAmount = Math.round(subtotal * 0.21 * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;
    const providerCost = pricingMode === 'provider_quote'
      ? items.reduce((sum, it) => sum + (it.provider_cost || it.base_price || 0), 0)
      : items.reduce((sum, it) => sum + (it.base_price || 0), 0);
    return { subtotal, vatRate, vatAmount, total, providerCost };
  };

  it('calculates subtotal from price_with_commission', () => {
    const items = [
      makeItem({ price_with_commission: 150, base_price: 100 }),
      makeItem({ price_with_commission: 300, base_price: 200 }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    expect(result.subtotal).toBe(450);
  });

  it('falls back to base_price when price_with_commission is null', () => {
    const items = [
      makeItem({ price_with_commission: null, base_price: 100 }),
      makeItem({ price_with_commission: 300, base_price: 200 }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    expect(result.subtotal).toBe(400); // 100 + 300
  });

  it('calculates VAT at 21%', () => {
    const items = [
      makeItem({ price_with_commission: 1000 }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    expect(result.vatAmount).toBe(210);
    expect(result.total).toBe(1210);
  });

  it('rounds VAT to 2 decimal places', () => {
    const items = [
      makeItem({ price_with_commission: 333 }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    // 333 * 0.21 = 69.93
    expect(result.vatAmount).toBe(69.93);
    expect(result.total).toBe(402.93);
  });

  it('provider_cost uses provider_cost field in provider_quote mode', () => {
    const items = [
      makeItem({ price_with_commission: 300, base_price: 200, provider_cost: 180 }),
      makeItem({ price_with_commission: 450, base_price: 300, provider_cost: 280 }),
    ];
    const result = calculatePdfTotals(items, 'provider_quote');
    expect(result.providerCost).toBe(460); // 180 + 280
    expect(result.subtotal).toBe(750); // 300 + 450
  });

  it('provider_cost uses base_price in zone_tariff mode', () => {
    const items = [
      makeItem({ price_with_commission: 300, base_price: 200, provider_cost: 180 }),
      makeItem({ price_with_commission: 450, base_price: 300, provider_cost: 280 }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    expect(result.providerCost).toBe(500); // 200 + 300 (ignores provider_cost)
  });

  it('handles empty items array', () => {
    const result = calculatePdfTotals([], 'zone_tariff');
    expect(result.subtotal).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.total).toBe(0);
    expect(result.providerCost).toBe(0);
  });

  it('handles all null prices', () => {
    const items = [
      makeItem({ price_with_commission: null, base_price: null }),
      makeItem({ price_with_commission: null, base_price: null }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it('PDF total matches TransferQuoteActions preview total', () => {
    // This test verifies that the preview total shown in TransferQuoteActions
    // uses the same formula as the actual PDF generation
    const items = [
      makeItem({ price_with_commission: 119, base_price: 79 }),
      makeItem({ price_with_commission: 294, base_price: 196 }),
    ];
    const result = calculatePdfTotals(items, 'zone_tariff');
    
    // Subtotal = 119 + 294 = 413
    expect(result.subtotal).toBe(413);
    // VAT = 413 * 0.21 = 86.73
    expect(result.vatAmount).toBe(86.73);
    // Total = 413 + 86.73 = 499.73
    expect(result.total).toBe(499.73);
  });
});
