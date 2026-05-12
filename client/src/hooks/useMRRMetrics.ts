/**
 * useMRRMetrics — NEUTRALIZED (internal app, no billing)
 * Returns empty metrics. Will be replaced with group-level metrics.
 */
import { useQuery } from '@tanstack/react-query';

export const useMRRMetrics = () => {
  return useQuery({
    queryKey: ['mrr-metrics-disabled'],
    queryFn: async () => ({
      totalMRR: 0,
      totalARR: 0,
      churnRate: 0,
      conversionRate: 0,
      activeSubscriptions: 0,
      newSubscriptionsLastMonth: 0,
      mrrHistory: [] as { month: string; mrr: number }[],
    }),
    staleTime: Infinity,
  });
};
