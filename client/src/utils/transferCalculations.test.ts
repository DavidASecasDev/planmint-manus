import { describe, it, expect } from 'vitest';
import {
  calculateClientInvoice,
  formatCurrency,
  calculateMarginPercentage,
} from './transferCalculations';

describe('calculateClientInvoice', () => {
  it('calculates correct breakdown for a known provider cost', () => {
    const result = calculateClientInvoice(100);

    // Transport: 100 base + 10% VAT = 110
    expect(result.transport.base).toBe(100);
    expect(result.transport.vat).toBe(10);
    expect(result.transport.subtotal).toBe(110);

    // Commission: 50 base (50% of 100) + 21% VAT = 60.5
    expect(result.commission.base).toBe(50);
    expect(result.commission.vat).toBe(10.5);
    expect(result.commission.subtotal).toBe(60.5);

    // Client total: 110 + 60.5 = 170.5
    expect(result.clientTotal).toBe(170.5);

    // Profit margin = commission base = 50
    expect(result.profitMargin).toBe(50);
  });

  it('calculates correct values for zero provider cost', () => {
    const result = calculateClientInvoice(0);
    expect(result.clientTotal).toBe(0);
    expect(result.profitMargin).toBe(0);
    expect(result.transport.base).toBe(0);
    expect(result.commission.base).toBe(0);
  });

  it('rounds currency values to 2 decimal places', () => {
    const result = calculateClientInvoice(33);

    // Check all values have at most 2 decimal places
    const checkDecimals = (val: number) => {
      const str = val.toString();
      const parts = str.split('.');
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    };

    checkDecimals(result.transport.vat);
    checkDecimals(result.commission.vat);
    checkDecimals(result.clientTotal);
  });

  it('display values sum correctly', () => {
    const result = calculateClientInvoice(200);
    // displayBase + displayVat should approximately equal clientTotal
    const displaySum = Math.round((result.displayBase + result.displayVat) * 100) / 100;
    expect(displaySum).toBeCloseTo(result.clientTotal, 1);
  });

  it('uses 21% display VAT rate', () => {
    const result = calculateClientInvoice(100);
    expect(result.displayVatRate).toBe(0.21);
  });
});

describe('formatCurrency', () => {
  it('formats a number as EUR currency', () => {
    const result = formatCurrency(170.5);
    expect(result).toContain('170');
    expect(result).toContain('€');
  });

  it('returns dash for null', () => {
    expect(formatCurrency(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('-');
  });

  it('formats zero correctly', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });
});

describe('calculateMarginPercentage', () => {
  it('calculates correct margin percentage', () => {
    // Provider cost 100, client total 170.5 => margin = 70.5%
    expect(calculateMarginPercentage(100, 170.5)).toBe(71); // Math.round(70.5)
  });

  it('returns 0 when provider cost is 0', () => {
    expect(calculateMarginPercentage(0, 100)).toBe(0);
  });

  it('returns 100 when client total is double the provider cost', () => {
    expect(calculateMarginPercentage(100, 200)).toBe(100);
  });

  it('returns 0 when there is no margin', () => {
    expect(calculateMarginPercentage(100, 100)).toBe(0);
  });
});
