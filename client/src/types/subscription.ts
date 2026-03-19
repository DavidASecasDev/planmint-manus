export type PlanType = 'free' | 'pro' | 'team';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled';

export interface Subscription {
  id: string;
  organization_id: string;
  plan: PlanType;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

// NOTA: Los límites de plan ahora vienen de la base de datos via useEntitlements
// Ver: billing_products.metadata_json y get_organization_entitlements()

export const PLAN_NAMES: Record<PlanType, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
};

export const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  free: 'Para uso personal o probar la app',
  pro: 'Para profesionales y pequeños equipos',
  team: 'Para equipos grandes con necesidades avanzadas',
};
