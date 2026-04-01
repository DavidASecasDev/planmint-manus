import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Entitlements, ADDON_ALLOWED_PLANS } from '@/types/billing';

const DEFAULT_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  billing_interval: null,
  features: {
    ai: false,
    workflows_pro: false,
    integrations_api: false,
    saml_scim: false,
    pdf_exports: false,
  },
  limits: {
    seats_included: 1,
    seats_total: 1,
    tasks_limit: 20,
    areas_limit: 2,
    tags_limit: 5,
    automations_limit: 0,
  },
  addons: [],
  status: 'active',
  trial_ends_at: null,
  current_period_end: null,
};

export const useEntitlements = () => {
  const { profile } = useAuth();

  const { data: entitlements, isLoading, error, refetch } = useQuery({
    queryKey: ['entitlements', profile?.organization_id],
    queryFn: async (): Promise<Entitlements> => {
      if (!profile?.organization_id) return DEFAULT_ENTITLEMENTS;

      // Query subscriptions table directly instead of broken RPC
      try {
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .maybeSingle();

        if (subError || !subData) {
          console.warn('[Entitlements] No subscription found, using defaults');
          return DEFAULT_ENTITLEMENTS;
        }

        // Build entitlements from subscription data
        const plan = (subData.plan || 'free') as 'free' | 'pro' | 'team';
        const isPro = plan === 'pro' || plan === 'team';

        return {
          plan,
          billing_interval: (subData.billing_interval || null) as 'monthly' | 'annual' | null,
          features: {
            ai: isPro,
            workflows_pro: isPro,
            integrations_api: plan === 'team',
            saml_scim: plan === 'team',
            pdf_exports: isPro,
          },
          limits: {
            seats_included: plan === 'team' ? 10 : plan === 'pro' ? 5 : 1,
            seats_total: plan === 'team' ? 50 : plan === 'pro' ? 10 : 1,
            tasks_limit: isPro ? 999999 : 20,
            areas_limit: isPro ? 999999 : 2,
            tags_limit: isPro ? 999999 : 5,
            automations_limit: plan === 'team' ? 999999 : plan === 'pro' ? 10 : 0,
          },
          addons: [],
          status: (subData.status || 'active') as Entitlements['status'],
          trial_ends_at: subData.trial_ends_at || null,
          current_period_end: subData.current_period_end || null,
        };
      } catch (err) {
        console.error('[Entitlements] Error:', err);
        return DEFAULT_ENTITLEMENTS;
      }
    },
    enabled: !!profile?.organization_id,
    staleTime: 60_000, // Cache for 60 seconds — avoid unnecessary refetches
    refetchOnMount: true,
    refetchOnWindowFocus: false, // Prevent UI flicker when switching tabs
  });

  // Helper functions
  const hasFeature = (feature: keyof Entitlements['features']): boolean => {
    return entitlements?.features[feature] || false;
  };

  const isWithinLimit = (resource: keyof Entitlements['limits'], current: number): boolean => {
    const limit = entitlements?.limits[resource];
    if (limit === null || limit === undefined) return true; // unlimited
    return current < limit;
  };

  const canAddAddon = (addonCode: string): boolean => {
    if (!entitlements) return false;
    const plan = entitlements.plan;
    const allowedPlans = ADDON_ALLOWED_PLANS[addonCode] || [];
    return (allowedPlans as string[]).includes(plan);
  };

  const isPastDue = entitlements?.status === 'past_due';
  const isTrialing = entitlements?.status === 'trialing';
  const isCanceled = entitlements?.status === 'canceled';

  return {
    entitlements: entitlements || DEFAULT_ENTITLEMENTS,
    isLoading,
    error,
    refetch,
    hasFeature,
    isWithinLimit,
    canAddAddon,
    isPastDue,
    isTrialing,
    isCanceled,
  };
};
