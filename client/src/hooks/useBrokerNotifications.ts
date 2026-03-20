import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import type { NotificationWithDetails, NotificationType, NotificationEntityType } from '@/types/notifications';

const POLL_INTERVAL_MS = 15_000;

/**
 * Broker-side notification hook.
 * Uses the same `notifications` table but scoped to the broker's user_id.
 * Includes realtime subscription + polling fallback.
 */
export function useBrokerNotifications() {
  const { broker, user } = useBrokerAuth();
  const queryClient = useQueryClient();
  const lastSeenAtRef = useRef<string>(new Date().toISOString());

  const userId = user?.id;
  const organizationId = broker?.organization_id;

  // Fetch notifications
  const { data: notifications = [], isLoading: loading } = useQuery({
    queryKey: ['broker-notifications', userId],
    queryFn: async (): Promise<NotificationWithDetails[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data ?? []).map((n: any) => ({
        ...n,
        type: n.type as NotificationType,
        entity_type: n.entity_type as NotificationEntityType,
        transfer_request_id: n.entity_type === 'transfer_request' || n.entity_type === 'transfer_note'
          ? n.entity_id
          : undefined,
      }));
    },
    enabled: !!userId,
  });

  // Unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['broker-notifications-unread', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  // Invalidate helper
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['broker-notifications', userId] });
    queryClient.invalidateQueries({ queryKey: ['broker-notifications-unread', userId] });
  }, [queryClient, userId]);

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('broker-realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          lastSeenAtRef.current = new Date().toISOString();
          invalidate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, invalidate]);

  // Polling fallback
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('is_read', false)
          .gt('created_at', lastSeenAtRef.current)
          .limit(1);

        if (!error && data && data.length > 0) {
          lastSeenAtRef.current = new Date().toISOString();
          invalidate();
        }
      } catch {
        // Silent fail for polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId, invalidate]);

  const markAsRead = async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
