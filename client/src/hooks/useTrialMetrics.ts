import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from './useSuperAdmin';
import { addDays, subDays, isAfter, isBefore } from 'date-fns';
import { normalizeSubscriptionStatus } from '@/lib/billing';

interface TrialOrg {
  id: string;
  name: string;
  trialEndsAt: string;
  daysRemaining: number;
  plan: string;
  memberCount: number;
}

interface TrialMetrics {
  trialsExpiringIn7Days: TrialOrg[];
  expiredNotConverted: TrialOrg[];
  activeTrials: number;
  conversionRate: number;
  averageTrialDays: number;
}

export const useTrialMetrics = () => {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['super-admin-trial-metrics'],
    queryFn: async (): Promise<TrialMetrics> => {
      const now = new Date();
      const in7Days = addDays(now, 7);
      const thirtyDaysAgo = subDays(now, 30);

      // Get all subscriptions with trial info
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          organizations!inner (id, name)
        `);

      if (subsError) throw subsError;

      // Get member counts for organizations
      const orgIds = subscriptions?.map(s => s.organization_id) || [];
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id')
        .in('organization_id', orgIds);

      const memberCounts: Record<string, number> = {};
      members?.forEach(m => {
        memberCounts[m.organization_id] = (memberCounts[m.organization_id] || 0) + 1;
      });

      // Filter trials expiring in next 7 days
      const trialsExpiringIn7Days: TrialOrg[] = [];
      const expiredNotConverted: TrialOrg[] = [];
      let activeTrials = 0;

      subscriptions?.forEach(sub => {
        if (!sub.trial_ends_at) return;

        const trialEnd = new Date(sub.trial_ends_at);
        const org = sub.organizations as { id: string; name: string };
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const trialOrg: TrialOrg = {
          id: sub.organization_id,
          name: org?.name || 'Unknown',
          trialEndsAt: sub.trial_ends_at,
          daysRemaining,
          plan: sub.plan || 'free',
          memberCount: memberCounts[sub.organization_id] || 0,
        };

        // Active trials
        if (normalizeSubscriptionStatus(sub.status) === 'trialing' && isAfter(trialEnd, now)) {
          activeTrials++;
          
          // Expiring in 7 days
          if (isBefore(trialEnd, in7Days)) {
            trialsExpiringIn7Days.push(trialOrg);
          }
        }

        // Expired and not converted (last 30 days)
        if (
          isBefore(trialEnd, now) && 
          isAfter(trialEnd, thirtyDaysAgo) &&
          (normalizeSubscriptionStatus(sub.status) === 'cancelled' || sub.plan === 'free')
        ) {
          expiredNotConverted.push(trialOrg);
        }
      });

      // Calculate conversion rate
      const allExpiredTrials = subscriptions?.filter(s => 
        s.trial_ends_at && isBefore(new Date(s.trial_ends_at), now)
      ) || [];
      
      const converted = allExpiredTrials.filter(s => 
        s.status === 'active' && s.plan !== 'free'
      ).length;

      const conversionRate = allExpiredTrials.length > 0
        ? (converted / allExpiredTrials.length) * 100
        : 0;

      // Sort by days remaining
      trialsExpiringIn7Days.sort((a, b) => a.daysRemaining - b.daysRemaining);
      expiredNotConverted.sort((a, b) => 
        new Date(b.trialEndsAt).getTime() - new Date(a.trialEndsAt).getTime()
      );

      return {
        trialsExpiringIn7Days,
        expiredNotConverted: expiredNotConverted.slice(0, 10),
        activeTrials,
        conversionRate: Math.round(conversionRate * 10) / 10,
        averageTrialDays: 14, // Default trial period
      };
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });
};
