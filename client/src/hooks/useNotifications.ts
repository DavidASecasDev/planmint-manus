import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Notification, NotificationWithDetails, NotificationType, NotificationEntityType } from '@/types/notifications';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'Notifications' });

interface CreateNotificationData {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  entity_type: NotificationEntityType;
  entity_id: string;
}

export function useNotifications() {
  const { profile, sessionReady } = useAuth();
  const queryClient = useQueryClient();
  
  // Extract organizationId for consistent queryKey usage
  const organizationId = profile?.organization_id;

  // Fetch notifications with React Query
  const { data: notifications = [], isLoading: loading, refetch: fetchNotifications } = useQuery({
    queryKey: ['notifications', organizationId],
    queryFn: async (): Promise<NotificationWithDetails[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabaseQuery
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        log.error('Error fetching notifications:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Batch collect IDs by entity type to avoid N+1 queries
      const taskUpdateIds: string[] = [];
      const reminderIds: string[] = [];

      data.forEach((notification: any) => {
        if (notification.entity_type === 'task_update') {
          taskUpdateIds.push(notification.entity_id);
        } else if (notification.entity_type === 'reminder') {
          reminderIds.push(notification.entity_id);
        }
      });

      // Batch queries: max 2 queries instead of N
      const [taskUpdatesResult, remindersResult] = await Promise.all([
        taskUpdateIds.length > 0
          ? supabaseQuery
              .from('task_updates')
              .select('id, task_id')
              .in('id', taskUpdateIds)
          : Promise.resolve({ data: [] as { id: string; task_id: string }[], error: null }),
        reminderIds.length > 0
          ? supabaseQuery
              .from('reminders')
              .select('id, task_id')
              .in('id', reminderIds)
          : Promise.resolve({ data: [] as { id: string; task_id: string }[], error: null }),
      ]);

      // Create lookup maps for O(1) access
      const taskUpdateMap = new Map<string, string>();
      if (taskUpdatesResult.data) {
        taskUpdatesResult.data.forEach((tu: any) => {
          if (tu.task_id) taskUpdateMap.set(tu.id, tu.task_id);
        });
      }

      const reminderMap = new Map<string, string>();
      if (remindersResult.data) {
        remindersResult.data.forEach((r: any) => {
          if (r.task_id) reminderMap.set(r.id, r.task_id);
        });
      }

      // Enrich notifications using lookup maps (O(n) total, not O(n²))
      const enrichedNotifications: NotificationWithDetails[] = data.map((notification: any) => {
        let task_id: string | undefined;
        let transfer_request_id: string | undefined;

        if (notification.entity_type === 'task') {
          task_id = notification.entity_id;
        } else if (notification.entity_type === 'task_update') {
          task_id = taskUpdateMap.get(notification.entity_id);
        } else if (notification.entity_type === 'reminder') {
          task_id = reminderMap.get(notification.entity_id);
        } else if (notification.entity_type === 'transfer_request') {
          transfer_request_id = notification.entity_id;
        }

        return {
          ...notification,
          type: notification.type as NotificationType,
          entity_type: notification.entity_type as NotificationEntityType,
          task_id,
          transfer_request_id,
        };
      });

      return enrichedNotifications;
    },
    enabled: !!organizationId && sessionReady,
    staleTime: 60_000, // 1 minute - realtime subscription handles updates
  });

  // Fetch unread count with React Query
  const { data: unreadCount = 0, refetch: fetchUnreadCount } = useQuery({
    queryKey: ['notifications-unread-count', organizationId],
    queryFn: async (): Promise<number> => {
      if (!organizationId) return 0;
      const { count, error } = await supabaseQuery
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) {
        log.error('Error fetching unread count:', error);
        throw error;
      }
      return count || 0;
    },
    enabled: !!organizationId && sessionReady,
    staleTime: 60_000, // 1 minute - realtime subscription handles updates
  });

  // Create notification mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateNotificationData): Promise<void> => {
      if (!organizationId) throw new Error('No organization');

      const { error } = await supabaseQuery
        .from('notifications')
        .insert({
          organization_id: organizationId,
          user_id: data.user_id,
          type: data.type,
          title: data.title,
          body: data.body.substring(0, 500), // Limit body length
          entity_type: data.entity_type,
          entity_id: data.entity_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', organizationId] });
    },
    onError: (error) => {
      log.error('Error creating notification:', error);
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string): Promise<void> => {
      const { error } = await supabaseQuery
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', organizationId] });
    },
    onError: (error) => {
      log.error('Error marking notification as read:', error);
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabaseQuery
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', organizationId] });
    },
    onError: (error) => {
      log.error('Error marking all as read:', error);
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string): Promise<void> => {
      const { error } = await supabaseQuery
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', organizationId] });
    },
    onError: (error) => {
      log.error('Error deleting notification:', error);
    },
  });

  // Helper functions that maintain the original API
  const createNotification = async (data: CreateNotificationData): Promise<boolean> => {
    try {
      await createMutation.mutateAsync(data);
      return true;
    } catch {
      return false;
    }
  };

  const markAsRead = async (notificationId: string): Promise<boolean> => {
    try {
      await markAsReadMutation.mutateAsync(notificationId);
      return true;
    } catch {
      return false;
    }
  };

  const markAllAsRead = async (): Promise<boolean> => {
    try {
      await markAllAsReadMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const deleteNotification = async (notificationId: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(notificationId);
      return true;
    } catch {
      return false;
    }
  };

  // Check for existing notification to avoid duplicates
  const hasRecentNotification = async (
    type: NotificationType,
    entityType: NotificationEntityType,
    entityId: string,
    userId: string,
    hoursAgo: number = 24
  ): Promise<boolean> => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

      const { data, error } = await supabaseQuery
        .from('notifications')
        .select('id')
        .eq('type', type)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      log.error('Error checking for recent notification:', error);
      return false;
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    hasRecentNotification,
  };
}
