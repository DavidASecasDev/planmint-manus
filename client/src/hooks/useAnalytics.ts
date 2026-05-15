import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { UsageStats, DailyStats } from '@/types/analytics';
import { subDays, format } from 'date-fns';

export const useAnalytics = () => {
  const { profile } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics-stats', profile?.organization_id],
    queryFn: async (): Promise<UsageStats> => {
      if (!profile?.organization_id) {
        return getEmptyStats();
      }

      const weekAgo = subDays(new Date(), 7).toISOString();

      const [
        totalTasksResult,
        tasksCreatedWeekResult,
        tasksCompletedWeekResult,
        activeUsersResult,
        kanbanViewsResult,
        calendarViewsResult,
        listViewsResult,
        searchUsageResult,
        remindersResult,
        limitReachedResult,
        upgradeClicksResult,
      ] = await Promise.all([
        supabaseQuery
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'task_created')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'task_completed')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'kanban_viewed')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'calendar_viewed')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'task_list_viewed')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'global_search_used')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('reminders')
          .select('id', { count: 'exact', head: true }),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'limit_reached')
          .gte('created_at', weekAgo),
        supabaseQuery
          .from('usage_events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('event_type', 'upgrade_cta_clicked')
          .gte('created_at', weekAgo),
      ]);

      return {
        totalTasks: totalTasksResult.count || 0,
        tasksCreatedThisWeek: tasksCreatedWeekResult.count || 0,
        tasksCompletedThisWeek: tasksCompletedWeekResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
        kanbanViews: kanbanViewsResult.count || 0,
        calendarViews: calendarViewsResult.count || 0,
        listViews: listViewsResult.count || 0,
        searchUsage: searchUsageResult.count || 0,
        remindersCreated: remindersResult.count || 0,
        limitReachedEvents: limitReachedResult.count || 0,
        upgradeClicks: upgradeClicksResult.count || 0,
      };
    },
    enabled: !!profile?.organization_id,
  });

  const { data: dailyStats, isLoading: dailyLoading } = useQuery({
    queryKey: ['analytics-daily', profile?.organization_id],
    queryFn: async (): Promise<DailyStats[]> => {
      if (!profile?.organization_id) return [];

      const days: DailyStats[] = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const startOfDay = `${dateStr}T00:00:00.000Z`;
        const endOfDay = `${dateStr}T23:59:59.999Z`;

        const [createdResult, completedResult] = await Promise.all([
          supabaseQuery
            .from('usage_events')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id)
            .eq('event_type', 'task_created')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay),
          supabaseQuery
            .from('usage_events')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id)
            .eq('event_type', 'task_completed')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay),
        ]);

        days.push({
          date: format(date, 'dd/MM'),
          tasks_created: createdResult.count || 0,
          tasks_completed: completedResult.count || 0,
        });
      }

      return days;
    },
    enabled: !!profile?.organization_id,
  });

  return {
    stats: stats || getEmptyStats(),
    dailyStats: dailyStats || [],
    isLoading: statsLoading || dailyLoading,
  };
};

function getEmptyStats(): UsageStats {
  return {
    totalTasks: 0,
    tasksCreatedThisWeek: 0,
    tasksCompletedThisWeek: 0,
    activeUsers: 0,
    kanbanViews: 0,
    calendarViews: 0,
    listViews: 0,
    searchUsage: 0,
    remindersCreated: 0,
    limitReachedEvents: 0,
    upgradeClicks: 0,
  };
}
