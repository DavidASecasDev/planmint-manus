import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSuperAdmin() {
  const { user } = useAuth();

  const { data: isSuperAdmin = false, isLoading } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      // RPC is_super_admin not available in Express backend - check via Supabase direct query
      try {
        const { data, error } = await supabase
          .from('super_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) {
          console.warn('super_admins table may not exist:', error.message);
          return false;
        }
        return !!data;
      } catch {
        return false;
      }
    },
    enabled: !!user?.id,
  });

  return { isSuperAdmin, loading: isLoading };
}

export function usePlatformStats() {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      // Get total organizations
      const { count: totalOrgs } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true });

      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get subscriptions breakdown
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('plan, status');

      const planCounts = subscriptions?.reduce((acc, sub) => {
        acc[sub.plan] = (acc[sub.plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const statusCounts = subscriptions?.reduce((acc, sub) => {
        acc[sub.status] = (acc[sub.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get recent organizations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: recentOrgs } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get feedback count
      const { count: totalFeedback } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true });

      return {
        totalOrganizations: totalOrgs || 0,
        totalUsers: totalUsers || 0,
        recentOrganizations: recentOrgs || 0,
        totalFeedback: totalFeedback || 0,
        planBreakdown: planCounts,
        statusBreakdown: statusCounts,
      };
    },
    enabled: isSuperAdmin,
  });
}

export function usePlatformOrganizations() {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['platform-organizations'],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          created_at,
          subscriptions (
            plan,
            status,
            trial_ends_at,
            current_period_end,
            billing_interval,
            stripe_customer_id,
            stripe_subscription_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts for each org
      const orgsWithCounts = await Promise.all(
        (orgs || []).map(async (org) => {
          const { count } = await supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id);

          return {
            ...org,
            memberCount: count || 0,
            subscription: Array.isArray(org.subscriptions) ? org.subscriptions[0] : org.subscriptions,
          };
        })
      );

      return orgsWithCounts;
    },
    enabled: isSuperAdmin,
  });
}

export function usePlatformFeedback() {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['platform-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_feedback')
        .select(`
          id,
          feedback_type,
          message,
          created_at,
          read_at,
          resolved_at,
          internal_notes,
          organization_id,
          user_id,
          organizations (name),
          profiles (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });
}

export function usePlatformUsers() {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['platform-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          role,
          status,
          created_at,
          organization_id,
          user_id,
          profiles (id, name),
          organizations (id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((member) => ({
        member_id: member.id,
        user_id: member.user_id,
        name: member.profiles?.name,
        organization_id: member.organization_id,
        organization_name: member.organizations?.name,
        role: member.role,
        status: member.status,
        created_at: member.created_at,
      }));
    },
    enabled: isSuperAdmin,
  });
}

export function useOrganizationDetails(orgId: string | undefined) {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['organization-details', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: org, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          created_at,
          subscriptions (
            id,
            plan,
            status,
            trial_ends_at,
            current_period_end,
            billing_interval,
            stripe_customer_id,
            stripe_subscription_id
          )
        `)
        .eq('id', orgId)
        .single();

      if (error) throw error;

      // Get members
      const { data: members } = await supabase
        .from('organization_members')
        .select(`
          id,
          role,
          status,
          created_at,
          user_id,
          profiles (id, name)
        `)
        .eq('organization_id', orgId);

      // Get feedback
      const { data: feedback } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get task count
      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      // Get area count
      const { count: areaCount } = await supabase
        .from('areas')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      // Get organization modules
      const { data: modulesData } = await supabase
        .from('organization_modules')
        .select('module_key, enabled')
        .eq('organization_id', orgId);

      // Convert to record
      const modules: Record<string, boolean> = {};
      if (modulesData) {
        for (const mod of modulesData) {
          modules[mod.module_key] = mod.enabled;
        }
      }

      return {
        ...org,
        subscription: Array.isArray(org.subscriptions) ? org.subscriptions[0] : org.subscriptions,
        members: members || [],
        feedback: feedback || [],
        taskCount: taskCount || 0,
        areaCount: areaCount || 0,
        modules,
      };
    },
    enabled: isSuperAdmin && !!orgId,
  });
}
