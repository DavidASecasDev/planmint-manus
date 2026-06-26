import { useCallback } from 'react';
import { apiInvoke } from '@/lib/apiClient';

interface TriggerNotificationParams {
  eventKey: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  targetUserId?: string;
}

/**
 * Hook to trigger operational notifications from the frontend.
 * Calls the backend endpoint which respects org-level event config and user preferences.
 * 
 * Usage:
 *   const { triggerNotification } = useNotificationTrigger();
 *   await triggerNotification({
 *     eventKey: 'rental_assigned',
 *     title: 'Nueva asignación',
 *     body: 'Te han asignado la entrega de ABC1234',
 *     entityType: 'reservation',
 *     entityId: reservationId,
 *     targetUserId: assignedUserId,
 *   });
 */
export function useNotificationTrigger() {
  const triggerNotification = useCallback(async (params: TriggerNotificationParams) => {
    try {
      await apiInvoke('/api/notifications/trigger', {
        body: {
          eventKey: params.eventKey,
          title: params.title,
          body: params.body,
          entityType: params.entityType || 'reservation',
          entityId: params.entityId || '',
          targetUserId: params.targetUserId,
        },
      });
    } catch (error) {
      // Silently fail — notifications are non-critical
      console.warn('[useNotificationTrigger] Failed to send notification:', error);
    }
  }, []);

  return { triggerNotification };
}
