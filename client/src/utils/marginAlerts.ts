import type { PricingMode } from '@/types/transfers';
import { calculateRequestTotals } from './syncRequestTotals.pure';

// Margin thresholds (as percentage of provider cost)
export const MARGIN_THRESHOLD_DANGER = 15;  // Red alert: < 15%
export const MARGIN_THRESHOLD_WARNING = 20; // Yellow warning: < 20%

export type MarginAlertLevel = 'ok' | 'warning' | 'danger';

export interface MarginAlertInfo {
  level: MarginAlertLevel;
  marginPercent: number;
  clientTotal: number;
  providerCost: number;
  internalMargin: number;
  message: string;
}

/**
 * Calculate margin percentage from provider cost and client total.
 * Returns 0 if providerCost is 0 or negative.
 */
export function getMarginPercent(providerCost: number, clientTotal: number): number {
  if (providerCost <= 0) return 0;
  return Math.round(((clientTotal - providerCost) / providerCost) * 100 * 10) / 10;
}

/**
 * Determine the alert level based on margin percentage.
 */
export function getMarginAlertLevel(marginPercent: number): MarginAlertLevel {
  if (marginPercent < MARGIN_THRESHOLD_DANGER) return 'danger';
  if (marginPercent < MARGIN_THRESHOLD_WARNING) return 'warning';
  return 'ok';
}

/**
 * Get a human-readable message for the margin alert.
 */
export function getMarginAlertMessage(level: MarginAlertLevel, marginPercent: number): string {
  switch (level) {
    case 'danger':
      return `Margen muy bajo (${marginPercent}%). Se recomienda revisar los precios antes de enviar el presupuesto.`;
    case 'warning':
      return `Margen por debajo del objetivo (${marginPercent}%). Considere ajustar los precios.`;
    case 'ok':
      return '';
  }
}

/**
 * Evaluate margin alert for a set of transfer items.
 * Returns full alert info including level, percentage, and message.
 */
export function evaluateMarginAlert(
  items: Array<{
    price_with_commission: number | null;
    base_price: number | null;
    provider_cost: number | null;
  }>,
  pricingMode: PricingMode
): MarginAlertInfo {
  const { clientTotal, providerCost, internalMargin } = calculateRequestTotals(items, pricingMode);
  const marginPercent = getMarginPercent(providerCost, clientTotal);
  const level = getMarginAlertLevel(marginPercent);
  const message = getMarginAlertMessage(level, marginPercent);

  return {
    level,
    marginPercent,
    clientTotal,
    providerCost,
    internalMargin,
    message,
  };
}
