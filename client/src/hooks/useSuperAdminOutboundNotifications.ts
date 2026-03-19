import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OutboundNotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type OutboundNotificationChannel = 'push' | 'email' | 'slack' | 'whatsapp';

export interface SuperAdminOutboundNotificationRow {
  id: string;
  organization_id: string;
  user_id: string;
  source_notification_id: string | null;
  channel: OutboundNotificationChannel;
  status: OutboundNotificationStatus;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  organizations?: { name: string } | null;
  profiles?: { name: string | null } | null;
}

export interface OutboundNotificationsFilters {
  status?: OutboundNotificationStatus | 'all';
  channel?: OutboundNotificationChannel | 'all';
  search?: string; // org name
  limit?: number;
}

export function useSuperAdminOutboundNotifications(filters: OutboundNotificationsFilters) {
  const status = filters.status ?? 'all';
  const channel = filters.channel ?? 'all';
  const search = (filters.search ?? '').trim();
  const limit = filters.limit ?? 100;

  return useQuery({
    queryKey: ['super-admin', 'outbound-notifications', { status, channel, search, limit }],
    queryFn: async (): Promise<SuperAdminOutboundNotificationRow[]> => {
      let query = supabase
        .from('outbound_notifications')
        .select(
          `
            id,
            organization_id,
            user_id,
            source_notification_id,
            channel,
            status,
            payload,
            error_message,
            created_at,
            organizations(name),
            profiles(name)
          `
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') query = query.eq('status', status);
      if (channel !== 'all') query = query.eq('channel', channel);
      // PostgREST filter on joined table
      if (search) query = query.ilike('organizations.name', `%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SuperAdminOutboundNotificationRow[];
    },
  });
}
