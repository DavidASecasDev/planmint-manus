import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  teamCount: number;
  areasCount: number;
  completedCount: number;
  pendingCount: number;
}

export function useDashboardStats() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    teamCount: 0,
    areasCount: 0,
    completedCount: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all stats in parallel
      const [teamResult, areasResult, completedResult, pendingResult] = await Promise.all([
        // Use organization_members as source of truth for team count
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('status', 'active'),
        supabase
          .from('areas')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('is_archived', false),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .eq('status', 'completed')
          .eq('is_archived', false),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
          .neq('status', 'completed')
          .eq('is_archived', false),
      ]);

      setStats({
        teamCount: teamResult.count || 0,
        areasCount: areasResult.count || 0,
        completedCount: completedResult.count || 0,
        pendingCount: pendingResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
