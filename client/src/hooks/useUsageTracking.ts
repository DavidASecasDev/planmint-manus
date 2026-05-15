import { useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { EventType, EntityType } from '@/types/analytics';

export const useUsageTracking = () => {
  const { user, profile } = useAuth();

  const trackEvent = useCallback(
    async (
      eventType: EventType,
      entityType?: EntityType,
      entityId?: string
    ) => {
      if (!user?.id || !profile?.organization_id) return;

      try {
        await supabaseQuery.from('usage_events').insert({
          organization_id: profile.organization_id,
          user_id: user.id,
          event_type: eventType,
          entity_type: entityType || null,
          entity_id: entityId || null,
        });
      } catch (error) {
        // Silently fail - analytics should never break the app
        console.error('Failed to track event:', error);
      }
    },
    [user?.id, profile?.organization_id]
  );

  const trackTaskCreated = useCallback(
    (taskId: string) => trackEvent('task_created', 'task', taskId),
    [trackEvent]
  );

  const trackTaskCompleted = useCallback(
    (taskId: string) => trackEvent('task_completed', 'task', taskId),
    [trackEvent]
  );

  const trackTaskDeleted = useCallback(
    (taskId: string) => trackEvent('task_deleted', 'task', taskId),
    [trackEvent]
  );

  const trackAreaCreated = useCallback(
    (areaId: string) => trackEvent('area_created', 'area', areaId),
    [trackEvent]
  );

  const trackTagCreated = useCallback(
    (tagId: string) => trackEvent('tag_created', 'tag', tagId),
    [trackEvent]
  );

  const trackKanbanViewed = useCallback(
    () => trackEvent('kanban_viewed'),
    [trackEvent]
  );

  const trackCalendarViewed = useCallback(
    () => trackEvent('calendar_viewed'),
    [trackEvent]
  );

  const trackTaskListViewed = useCallback(
    () => trackEvent('task_list_viewed'),
    [trackEvent]
  );

  const trackReminderCreated = useCallback(
    (reminderId: string, isRecurring: boolean) =>
      trackEvent(
        isRecurring ? 'recurring_reminder_created' : 'reminder_created',
        'reminder',
        reminderId
      ),
    [trackEvent]
  );

  const trackMentionCreated = useCallback(
    (userId: string) => trackEvent('task_mentioned_user', 'user', userId),
    [trackEvent]
  );

  const trackGlobalSearchUsed = useCallback(
    () => trackEvent('global_search_used', 'search'),
    [trackEvent]
  );

  const trackLimitReached = useCallback(
    (entityType: EntityType) => trackEvent('limit_reached', entityType),
    [trackEvent]
  );

  const trackUpgradeClicked = useCallback(
    () => trackEvent('upgrade_cta_clicked'),
    [trackEvent]
  );

  return {
    trackEvent,
    trackTaskCreated,
    trackTaskCompleted,
    trackTaskDeleted,
    trackAreaCreated,
    trackTagCreated,
    trackKanbanViewed,
    trackCalendarViewed,
    trackTaskListViewed,
    trackReminderCreated,
    trackMentionCreated,
    trackGlobalSearchUsed,
    trackLimitReached,
    trackUpgradeClicked,
  };
};
