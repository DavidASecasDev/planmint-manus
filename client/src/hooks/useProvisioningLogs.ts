import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { ProvisioningLog, ProvisioningLogFilters } from '@/types/enterprise';

export function useProvisioningLogs(filters: ProvisioningLogFilters = {}) {
  const { profile } = useAuth();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['provisioning-logs', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabaseQuery
        .from('provisioning_logs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (filters.source) {
        query = query.eq('source', filters.source);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters.search) {
        query = query.or(`external_id.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProvisioningLog[];
    },
    enabled: !!profile?.organization_id,
  });

  // Statistics
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
    saml: logs.filter(l => l.source === 'saml').length,
    scim: logs.filter(l => l.source === 'scim').length,
  };

  return {
    logs,
    stats,
    isLoading,
  };
}
