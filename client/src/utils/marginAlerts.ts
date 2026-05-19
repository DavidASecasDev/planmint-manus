import { calculateRequestTotals } from './syncRequestTotals.pure';

// Default margin thresholds (used as fallback when settings aren't loaded)
export const MARGIN_THRESHOLD_DANGER = 15;  // Red alert: < 15%
export const MARGIN_THRESHOLD_WARNING = 20; // Yellow warning: < 20%

export type MarginAlertLevel = 'ok' | 'warning' | 'danger';

export interface MarginThresholdConfig {
  danger: number;
  warning: number;
}

export interface MarginAlertInfo {
  level: MarginAlertLevel;
  marginPercent: number;
  clientTotal: number;
  providerCost: number;
  internalMargin: number;
  message: string;
  thresholds: MarginThresholdConfig;
}

const DEFAULT_THRESHOLDS: MarginThresholdConfig = {
  danger: MARGIN_THRESHOLD_DANGER,
  warning: MARGIN_THRESHOLD_WARNING,
};

/**
 * Calculate margin percentage from provider cost and client total.
 * Returns 0 if providerCost is 0 or negative.
 */
export function getMarginPercent(providerCost: number, clientTotal: number): number {
  if (providerCost <= 0) return 0;
  return Math.round(((clientTotal - providerCost) / providerCost) * 100 * 10) / 10;
}

/**
 * Determine the alert level based on margin percentage and configurable thresholds.
 */
export function getMarginAlertLevel(
  marginPercent: number,
  thresholds: MarginThresholdConfig = DEFAULT_THRESHOLDS
): MarginAlertLevel {
  if (marginPercent < thresholds.danger) return 'danger';
  if (marginPercent < thresholds.warning) return 'warning';
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
 * Accepts optional configurable thresholds (defaults to 15% danger, 20% warning).
 */
export function evaluateMarginAlert(
  items: Array<{
    price_with_commission: number | null;
    base_price: number | null;
    provider_cost: number | null;
  }>,
  thresholds: MarginThresholdConfig = DEFAULT_THRESHOLDS
): MarginAlertInfo {
  const { clientTotal, providerCost, internalMargin } = calculateRequestTotals(items);
  const marginPercent = getMarginPercent(providerCost, clientTotal);
  const level = getMarginAlertLevel(marginPercent, thresholds);
  const message = getMarginAlertMessage(level, marginPercent);

  return {
    level,
    marginPercent,
    clientTotal,
    providerCost,
    internalMargin,
    message,
    thresholds,
  };
}
