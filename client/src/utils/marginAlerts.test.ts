import { describe, it, expect } from 'vitest';
import {
  getMarginPercent,
  getMarginAlertLevel,
  getMarginAlertMessage,
  evaluateMarginAlert,
  MARGIN_THRESHOLD_DANGER,
  MARGIN_THRESHOLD_WARNING,
} from './marginAlerts';

describe('marginAlerts', () => {
  describe('getMarginPercent', () => {
    it('returns 0 when providerCost is 0', () => {
      expect(getMarginPercent(0, 100)).toBe(0);
    });

    it('returns 0 when providerCost is negative', () => {
      expect(getMarginPercent(-10, 100)).toBe(0);
    });

    it('calculates correct margin percentage', () => {
      // providerCost=100, clientTotal=150 → margin = (150-100)/100 * 100 = 50%
      expect(getMarginPercent(100, 150)).toBe(50);
    });

    it('calculates margin with decimals', () => {
      // providerCost=100, clientTotal=110 → margin = 10%
      expect(getMarginPercent(100, 110)).toBe(10);
    });

    it('handles negative margin (loss)', () => {
      // providerCost=100, clientTotal=90 → margin = -10%
      expect(getMarginPercent(100, 90)).toBe(-10);
    });

    it('rounds to 1 decimal place', () => {
      // providerCost=300, clientTotal=345 → margin = 15%
      expect(getMarginPercent(300, 345)).toBe(15);
    });
  });

  describe('getMarginAlertLevel', () => {
    it('returns danger when margin < 15%', () => {
      expect(getMarginAlertLevel(14)).toBe('danger');
      expect(getMarginAlertLevel(0)).toBe('danger');
      expect(getMarginAlertLevel(-5)).toBe('danger');
    });

    it('returns warning when margin >= 15% and < 20%', () => {
      expect(getMarginAlertLevel(15)).toBe('warning');
      expect(getMarginAlertLevel(17)).toBe('warning');
      expect(getMarginAlertLevel(19.9)).toBe('warning');
    });

    it('returns ok when margin >= 20%', () => {
      expect(getMarginAlertLevel(20)).toBe('ok');
      expect(getMarginAlertLevel(50)).toBe('ok');
      expect(getMarginAlertLevel(100)).toBe('ok');
    });
  });

  describe('getMarginAlertMessage', () => {
    it('returns empty string for ok level', () => {
      expect(getMarginAlertMessage('ok', 50)).toBe('');
    });

    it('returns warning message with percentage', () => {
      const msg = getMarginAlertMessage('warning', 17);
      expect(msg).toContain('17%');
      expect(msg).toContain('Considere ajustar');
    });

    it('returns danger message with percentage', () => {
      const msg = getMarginAlertMessage('danger', 10);
      expect(msg).toContain('10%');
      expect(msg).toContain('revisar los precios');
    });
  });

  describe('evaluateMarginAlert', () => {
    it('returns ok for items with healthy margin', () => {
      const items = [
        { price_with_commission: 150, base_price: 100, provider_cost: null },
        { price_with_commission: 200, base_price: 120, provider_cost: null },
      ];
      const result = evaluateMarginAlert(items, 'zone_tariff');
      expect(result.level).toBe('ok');
      expect(result.clientTotal).toBe(350);
      expect(result.providerCost).toBe(220);
    });

    it('returns danger for items with low margin in provider_quote mode', () => {
      const items = [
        { price_with_commission: 105, base_price: null, provider_cost: 100 },
      ];
      const result = evaluateMarginAlert(items, 'provider_quote');
      expect(result.level).toBe('danger');
      expect(result.marginPercent).toBe(5);
      expect(result.message).toContain('revisar los precios');
    });

    it('returns warning for items with borderline margin', () => {
      const items = [
        { price_with_commission: 117, base_price: 100, provider_cost: null },
      ];
      const result = evaluateMarginAlert(items, 'zone_tariff');
      expect(result.level).toBe('warning');
      expect(result.marginPercent).toBe(17);
    });

    it('handles empty items array', () => {
      const result = evaluateMarginAlert([], 'zone_tariff');
      expect(result.level).toBe('danger'); // 0% margin
      expect(result.clientTotal).toBe(0);
      expect(result.providerCost).toBe(0);
    });

    it('uses provider_cost for provider_quote mode', () => {
      const items = [
        { price_with_commission: 200, base_price: 100, provider_cost: 150 },
      ];
      const result = evaluateMarginAlert(items, 'provider_quote');
      // providerCost = 150, clientTotal = 200, margin = (200-150)/150 * 100 = 33.3%
      expect(result.providerCost).toBe(150);
      expect(result.clientTotal).toBe(200);
      expect(result.level).toBe('ok');
    });

    it('uses base_price for zone_tariff mode', () => {
      const items = [
        { price_with_commission: 200, base_price: 100, provider_cost: 150 },
      ];
      const result = evaluateMarginAlert(items, 'zone_tariff');
      // providerCost = 100 (base_price), clientTotal = 200, margin = 100%
      expect(result.providerCost).toBe(100);
      expect(result.clientTotal).toBe(200);
      expect(result.level).toBe('ok');
    });
  });

  describe('threshold constants', () => {
    it('MARGIN_THRESHOLD_DANGER is 15', () => {
      expect(MARGIN_THRESHOLD_DANGER).toBe(15);
    });

    it('MARGIN_THRESHOLD_WARNING is 20', () => {
      expect(MARGIN_THRESHOLD_WARNING).toBe(20);
    });
  });
});
