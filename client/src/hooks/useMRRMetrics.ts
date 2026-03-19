import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from './useSuperAdmin';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { getPlanMonthlyPrice, normalizeSubscriptionStatus } from '@/lib/billing';

interface MRRMetrics {
  totalMRR: number;
  totalARR: number;
  churnRate: number;
  conversionRate: number;
  revenueByPlan: Record<string, number>;
  mrrHistory: { month: string; mrr: number }[];
  activeSubscriptions: number;
  canceledLastMonth: number;
  newSubscriptionsLastMonth: number;
}

export const useMRRMetrics = () => {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['super-admin-mrr-metrics'],
    queryFn: async (): Promise<MRRMetrics> => {
      // Get all subscriptions with their status
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');

      if (subsError) throw subsError;

      const now = new Date();
      const oneMonthAgo = subMonths(now, 1);
      const twoMonthsAgo = subMonths(now, 2);

      // Calculate active subscriptions and MRR
      const activeSubscriptions = subscriptions?.filter((s) => {
        const status = normalizeSubscriptionStatus(s.status);
        return status === 'active' || status === 'trialing';
      }) || [];

      // Calculate MRR by plan
      const revenueByPlan: Record<string, number> = {};
      let totalMRR = 0;

      activeSubscriptions.forEach(sub => {
        const plan = sub.plan || 'free';
        const price = getPlanMonthlyPrice(plan);
        const seats = sub.seats_included || 1;
        const monthlyRevenue = price * seats;
        
        revenueByPlan[plan] = (revenueByPlan[plan] || 0) + monthlyRevenue;
        totalMRR += monthlyRevenue;
      });

      // Get billing events for churn and conversion calculations
      const { data: events } = await supabase
        .from('billing_events')
        .select('*')
        .gte('created_at', twoMonthsAgo.toISOString());

      // Calculate canceled subscriptions last month
      const canceledLastMonth = events?.filter(e => 
        e.event_type === 'customer.subscription.deleted' &&
        new Date(e.created_at) >= oneMonthAgo
      ).length || 0;

      // New subscriptions last month
      const newSubscriptionsLastMonth = subscriptions?.filter(s =>
        new Date(s.created_at) >= oneMonthAgo
      ).length || 0;

      // Calculate churn rate (canceled / total active at start of period)
      const totalAtStartOfMonth = activeSubscriptions.length + canceledLastMonth;
      const churnRate = totalAtStartOfMonth > 0 
        ? (canceledLastMonth / totalAtStartOfMonth) * 100 
        : 0;

      // Calculate trial conversion rate
      const { data: allSubs } = await supabase
        .from('subscriptions')
        .select('*')
        .not('trial_ends_at', 'is', null);

      const trialsEnded = allSubs?.filter(s => 
        s.trial_ends_at && new Date(s.trial_ends_at) < now
      ) || [];
      
      const trialsConverted = trialsEnded.filter(s => 
        s.status === 'active' && s.plan !== 'free'
      ).length;

      const conversionRate = trialsEnded.length > 0 
        ? (trialsConverted / trialsEnded.length) * 100 
        : 0;

      // Calculate MRR history (last 6 months)
      const mrrHistory: { month: string; mrr: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthEnd = endOfMonth(monthDate);
        const monthLabel = format(monthDate, 'MMM yy');

        // Get subscriptions active at end of that month
        const activeAtMonth = subscriptions?.filter(s => {
          const created = new Date(s.created_at);
          return created <= monthEnd && 
            (s.status === 'active' || s.status === 'trialing' || 
             (s.current_period_end && new Date(s.current_period_end) >= monthEnd));
        }) || [];

        let monthMRR = 0;
        activeAtMonth.forEach(sub => {
          const plan = sub.plan || 'free';
          const price = getPlanMonthlyPrice(plan);
          monthMRR += price * (sub.seats_included || 1);
        });

        mrrHistory.push({ month: monthLabel, mrr: monthMRR });
      }

      return {
        totalMRR,
        totalARR: totalMRR * 12,
        churnRate: Math.round(churnRate * 10) / 10,
        conversionRate: Math.round(conversionRate * 10) / 10,
        revenueByPlan,
        mrrHistory,
        activeSubscriptions: activeSubscriptions.length,
        canceledLastMonth,
        newSubscriptionsLastMonth,
      };
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
