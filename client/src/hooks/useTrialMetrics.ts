/**
 * useTrialMetrics — NEUTRALIZED (internal app, no billing)
 * Returns empty trial data. Will be replaced with group-level metrics.
 */
import { useQuery } from '@tanstack/react-query';

interface TrialOrg {
  id: string;
  name: string;
  daysRemaining: number;
  memberCount: number;
}

export const useTrialMetrics = () => {
  return useQuery({
    queryKey: ['trial-metrics-disabled'],
    queryFn: async () => ({
      activeTrials: 0,
      conversionRate: 0,
      trialsExpiringIn7Days: [] as TrialOrg[],
      expiredNotConverted: [] as TrialOrg[],
    }),
    staleTime: Infinity,
  });
};
