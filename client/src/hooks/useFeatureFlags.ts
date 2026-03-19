import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { FeatureFlag, FeatureFlagKey } from '@/types/featureFlags';

export function useFeatureFlags() {
  const { profile } = useAuth();
  const { entitlements } = useEntitlements();

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['feature-flags', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`);

      if (error) throw error;
      return data as FeatureFlag[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 60000,
  });

  const hasFlag = (key: FeatureFlagKey): boolean => {
    // Check for org-specific override first
    const orgFlag = flags.find(
      (f) => f.key === key && f.organization_id === profile?.organization_id
    );

    if (orgFlag) {
      return orgFlag.enabled;
    }

    // Fallback to global flag
    const globalFlag = flags.find(
      (f) => f.key === key && f.organization_id === null
    );

    if (!globalFlag) return false;
    if (!globalFlag.enabled) return false;

    // Check plan restriction against current subscription plan
    if (globalFlag.plan) {
      const currentPlan = entitlements.plan;
      const planHierarchy: Record<string, number> = {
        free: 0,
        pro: 1,
        team: 2,
        enterprise: 3,
      };
      const requiredLevel = planHierarchy[globalFlag.plan] ?? 0;
      const currentLevel = planHierarchy[currentPlan] ?? 0;
      
      if (currentLevel < requiredLevel) {
        return false;
      }
    }

    // Check rollout percentage (deterministic based on org ID)
    if (globalFlag.rollout_percentage !== null && globalFlag.rollout_percentage < 100 && profile?.organization_id) {
      const hash = hashString(profile.organization_id + key);
      if (hash % 100 >= globalFlag.rollout_percentage) {
        return false;
      }
    }

    return true;
  };

  return { flags, isLoading, hasFlag };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
