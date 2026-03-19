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

      // Call secure RPC function instead of querying billing_products directly
      const { data, error } = await supabase.rpc('get_organization_entitlements');

      if (error) {
        console.error('[Entitlements] Error fetching:', error);
        return DEFAULT_ENTITLEMENTS;
      }

      if (!data) {
        console.log('[Entitlements] No data returned, using defaults');
        return DEFAULT_ENTITLEMENTS;
      }

      console.log('[Entitlements] RPC result:', data);

      // Parse the response from the RPC
      const result = data as {
        plan: string;
        billing_interval: string | null;
        features: Entitlements['features'];
        limits: Entitlements['limits'];
        addons: string[];
        status: string;
        trial_ends_at: string | null;
        current_period_end: string | null;
      };

      return {
        plan: result.plan as 'free' | 'pro' | 'team',
        billing_interval: result.billing_interval as 'monthly' | 'annual' | null,
        features: result.features || DEFAULT_ENTITLEMENTS.features,
        limits: result.limits || DEFAULT_ENTITLEMENTS.limits,
        addons: Array.isArray(result.addons) ? result.addons : [],
        status: result.status as Entitlements['status'],
        trial_ends_at: result.trial_ends_at,
        current_period_end: result.current_period_end,
      };
    },
    enabled: !!profile?.organization_id,
    staleTime: 5000, // Cache for 5 seconds - faster refresh
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
