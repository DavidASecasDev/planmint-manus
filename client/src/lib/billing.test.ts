import { describe, it, expect } from 'vitest';
import {
  getPlanMonthlyPrice,
  normalizeSubscriptionStatus,
  formatEUR,
  formatCurrencyMinorUnits,
} from './billing';

describe('getPlanMonthlyPrice', () => {
  it('returns correct prices for known plans', () => {
    expect(getPlanMonthlyPrice('free')).toBe(0);
    expect(getPlanMonthlyPrice('pro')).toBe(29);
    expect(getPlanMonthlyPrice('team')).toBe(79);
  });

  it('returns 0 for null/undefined', () => {
    expect(getPlanMonthlyPrice(null)).toBe(0);
    expect(getPlanMonthlyPrice(undefined)).toBe(0);
  });

  it('returns 0 for unknown plans', () => {
    expect(getPlanMonthlyPrice('enterprise')).toBe(0);
    expect(getPlanMonthlyPrice('premium')).toBe(0);
  });
});

describe('normalizeSubscriptionStatus', () => {
  it('normalizes active status', () => {
    expect(normalizeSubscriptionStatus('active')).toBe('active');
  });

  it('normalizes trial/trialing status', () => {
    expect(normalizeSubscriptionStatus('trial')).toBe('trialing');
    expect(normalizeSubscriptionStatus('trialing')).toBe('trialing');
  });

  it('normalizes cancelled/canceled/inactive status', () => {
    expect(normalizeSubscriptionStatus('cancelled')).toBe('cancelled');
    expect(normalizeSubscriptionStatus('canceled')).toBe('cancelled');
    expect(normalizeSubscriptionStatus('inactive')).toBe('cancelled');
  });

  it('normalizes past_due status', () => {
    expect(normalizeSubscriptionStatus('past_due')).toBe('past_due');
  });

  it('handles null/undefined/empty', () => {
    expect(normalizeSubscriptionStatus(null)).toBe('unknown');
    expect(normalizeSubscriptionStatus(undefined)).toBe('unknown');
    expect(normalizeSubscriptionStatus('')).toBe('unknown');
  });

  it('handles mixed case and whitespace', () => {
    expect(normalizeSubscriptionStatus('  Active  ')).toBe('active');
    expect(normalizeSubscriptionStatus('CANCELED')).toBe('cancelled');
  });

  it('returns unknown for unrecognized statuses', () => {
    expect(normalizeSubscriptionStatus('paused')).toBe('unknown');
    expect(normalizeSubscriptionStatus('suspended')).toBe('unknown');
  });
});

describe('formatEUR', () => {
  it('formats amounts in EUR', () => {
    const result = formatEUR(29);
    expect(result).toContain('29');
    expect(result).toContain('€');
  });

  it('formats zero correctly', () => {
    const result = formatEUR(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('respects maximumFractionDigits option', () => {
    const result = formatEUR(29.99, { maximumFractionDigits: 2 });
    expect(result).toContain('29,99');
  });
});

describe('formatCurrencyMinorUnits', () => {
  it('converts from minor units (cents) to major units', () => {
    const result = formatCurrencyMinorUnits(2900, 'EUR');
    expect(result).toContain('29');
    expect(result).toContain('€');
  });

  it('defaults to EUR when currency is null', () => {
    const result = formatCurrencyMinorUnits(1000, null);
    expect(result).toContain('€');
  });

  it('handles zero amount', () => {
    const result = formatCurrencyMinorUnits(0, 'EUR');
    expect(result).toContain('0');
  });
});
