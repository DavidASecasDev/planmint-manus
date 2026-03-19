export type NormalizedSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'unknown';

// Single source of truth for display currency/prices in the Super Admin panel.
// Note: These are *display* prices used for analytics (MRR, MRR at risk), not Stripe truth.
export const BILLING_CURRENCY = 'EUR' as const;
export const BILLING_LOCALE = 'es-ES' as const;

export const PLAN_MONTHLY_PRICING_EUR: Record<string, number> = {
  free: 0,
  pro: 29,
  team: 79,
};

export function getPlanMonthlyPrice(plan: string | null | undefined): number {
  if (!plan) return 0;
  return PLAN_MONTHLY_PRICING_EUR[plan] ?? 0;
}

export function normalizeSubscriptionStatus(
  status: string | null | undefined
): NormalizedSubscriptionStatus {
  const s = (status || '').toLowerCase().trim();
  if (!s) return 'unknown';

  // Legacy / mixed spellings
  if (s === 'canceled') return 'cancelled';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'inactive') return 'cancelled';

  // Legacy trial spelling in legacy `subscriptions` table
  if (s === 'trial') return 'trialing';
  if (s === 'trialing') return 'trialing';

  if (s === 'active') return 'active';
  if (s === 'past_due') return 'past_due';

  return 'unknown';
}

export function formatEUR(amount: number, opts?: { maximumFractionDigits?: number }) {
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 0;
  return new Intl.NumberFormat(BILLING_LOCALE, {
    style: 'currency',
    currency: BILLING_CURRENCY,
    maximumFractionDigits,
  }).format(amount);
}

export function formatCurrencyMinorUnits(
  amountMinor: number,
  currency: string | null | undefined,
  opts?: { maximumFractionDigits?: number }
) {
  const c = (currency || BILLING_CURRENCY).toUpperCase();
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 2;
  const amount = (amountMinor || 0) / 100;

  return new Intl.NumberFormat(BILLING_LOCALE, {
    style: 'currency',
    currency: c,
    maximumFractionDigits,
  }).format(amount);
}
