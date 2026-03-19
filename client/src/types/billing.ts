// Public billing product (sanitized - no Stripe IDs)
export interface BillingProductPublic {
  id: string;
  code: string;
  name: string;
  type: 'plan' | 'addon';
  display_price_monthly: number | null;
  display_price_annual: number | null;
  currency: string;
  highlight_features_json: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// Private billing product (internal use only - has Stripe IDs)
export interface BillingProduct {
  id: string;
  code: string;
  name: string;
  type: 'plan' | 'addon';
  stripe_price_monthly: string | null;
  stripe_price_annual: string | null;
  stripe_price: string | null;
  is_active: boolean;
  metadata_json: ProductMetadata;
  created_at: string;
}

export interface ProductMetadata {
  seats_included?: number;
  tasks_limit?: number | null;
  areas_limit?: number | null;
  tags_limit?: number | null;
  automations_limit?: number | null;
  description?: string;
  per_seat?: boolean;
  features?: {
    ai?: boolean;
    workflows_pro?: boolean;
    integrations_api?: boolean;
    saml_scim?: boolean;
    pdf_exports?: boolean;
  };
}

export interface SubscriptionItem {
  id: string;
  organization_id: string;
  product_code: string;
  quantity: number;
  billing_interval: 'monthly' | 'annual';
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  current_period_end: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  currency: string;
  duration: 'once' | 'repeating' | 'forever';
  duration_months: number | null;
  max_redemptions: number | null;
  redeem_by: string | null;
  applicable_products_json: string[];
  stripe_coupon_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CouponRedemption {
  id: string;
  organization_id: string;
  user_id: string;
  coupon_id: string;
  redeemed_at: string;
  stripe_promo_code_id: string | null;
  status: 'applied' | 'rejected' | 'expired';
}

export interface Trial {
  id: string;
  organization_id: string;
  trial_type: 'standard' | 'coupon' | 'referral' | 'manual';
  plan_code: string;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'ended' | 'converted';
  created_at: string;
}

export interface BillingEvent {
  id: string;
  organization_id: string | null;
  event_type: string;
  stripe_event_id: string;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface Entitlements {
  plan: 'free' | 'pro' | 'team';
  billing_interval: 'monthly' | 'annual' | null;
  features: {
    ai: boolean;
    workflows_pro: boolean;
    integrations_api: boolean;
    saml_scim: boolean;
    pdf_exports: boolean;
  };
  limits: {
    seats_included: number;
    seats_total: number;
    tasks_limit: number | null;
    areas_limit: number | null;
    tags_limit: number | null;
    automations_limit: number | null;
  };
  addons: string[];
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export interface CouponValidation {
  valid: boolean;
  coupon?: Coupon;
  error?: string;
}

export const ADDON_ALLOWED_PLANS: Record<string, ('pro' | 'team')[]> = {
  addon_ai: ['pro', 'team'],
  addon_workflows: ['pro', 'team'],
  addon_integrations: ['team'],
  addon_seats: ['pro', 'team'],
};

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  plan_free: 'Free',
  plan_pro: 'Pro',
  plan_team: 'Team',
  addon_ai: 'AI Pack',
  addon_workflows: 'Workflows Pro',
  addon_integrations: 'Integrations Pack',
  addon_seats: 'Extra Seats',
};

export const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  plan_pro: { monthly: 9, annual: 90 },
  plan_team: { monthly: 29, annual: 290 },
  addon_ai: { monthly: 5, annual: 50 },
  addon_workflows: { monthly: 8, annual: 80 },
  addon_integrations: { monthly: 10, annual: 100 },
  addon_seats: { monthly: 3, annual: 30 },
};
