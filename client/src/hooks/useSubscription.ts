/**
 * useSubscription — NEUTRALIZED (internal app, no billing)
 * 
 * This hook always returns full "team" plan access with a mock subscription object.
 * All SaaS billing logic has been removed since PlanMint is an internal
 * multi-org tool for Azul Group (Azul Cars, Bluebnc, Azul Stays).
 * 
 * Kept the same interface so all consumers work without changes.
 */
import { PlanType, Subscription } from '@/types/subscription';

const MOCK_SUBSCRIPTION: Subscription = {
  id: 'internal-unlimited',
  organization_id: 'internal',
  plan: 'team',
  status: 'active',
  trial_ends_at: null,
  created_at: new Date().toISOString(),
  stripe_customer_id: null,
  stripe_subscription_id: null,
  current_period_end: null,
};

export const useSubscription = () => {
  return {
    subscription: MOCK_SUBSCRIPTION,
    currentPlan: 'team' as PlanType,
    isLoading: false,
    error: null,
    updatePlan: () => {},
    isUpdating: false,
    isAdmin: true,
    isProPlan: true,
    isTeamPlan: true,
  };
};
