/**
 * Notification Helper
 * 
 * Centralized utility for creating in-app notifications that respects:
 * 1. Organization-level event config (which teams receive which events)
 * 2. User-level preferences (individual opt-out per event)
 * 
 * Usage:
 *   await sendOperationalNotification(sb, {
 *     organizationId: 'org-uuid',
 *     eventKey: 'rental_assigned',
 *     notificationType: 'rental_assigned',
 *     title: 'Nueva asignación',
 *     body: 'Te han asignado la entrega de ABC1234',
 *     entityType: 'reservation',
 *     entityId: 'reservation-uuid',
 *     targetUserId: 'user-uuid', // optional: notify specific user only
 *   });
 */
import type { SupabaseClient } from '@supabase/supabase-js';

interface NotificationPayload {
  organizationId: string;
  eventKey: string;
  notificationType: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  targetUserId?: string; // If set, only notify this user (still checks their preferences)
}

/**
 * Send an operational notification respecting org-level event config and user preferences.
 * 
 * Flow:
 * 1. If targetUserId is set → only notify that user (if they have the event enabled)
 * 2. Otherwise → find all team members whose team has the event enabled, then filter by user preferences
 */
export async function sendOperationalNotification(
  sb: SupabaseClient,
  payload: NotificationPayload
): Promise<void> {
  const { organizationId, eventKey, notificationType, title, body, entityType, entityId, targetUserId } = payload;

  try {
    let recipientUserIds: string[] = [];

    if (targetUserId) {
      // Direct notification to a specific user
      recipientUserIds = [targetUserId];
    } else {
      // Find which teams have this event enabled
      // If no config exists for a team+event, default is enabled
      const { data: eventConfigs } = await sb
        .from('notification_event_config')
        .select('team_id, enabled')
        .eq('organization_id', organizationId)
        .eq('event_key', eventKey);

      // Get all teams in the org
      const { data: allTeams } = await sb
        .from('teams')
        .select('id')
        .eq('organization_id', organizationId);

      if (!allTeams || allTeams.length === 0) {
        // No teams → notify all active members
        const { data: members } = await sb
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('status', 'active');

        recipientUserIds = (members || []).map((m: any) => m.user_id);
      } else {
        // Determine which teams should receive this event
        const disabledTeamIds = new Set(
          (eventConfigs || [])
            .filter(c => c.enabled === false)
            .map(c => c.team_id)
        );

        const enabledTeamIds = allTeams
          .map(t => t.id)
          .filter(id => !disabledTeamIds.has(id));

        if (enabledTeamIds.length === 0) {
          // All teams have this event disabled
          return;
        }

        // Get members of enabled teams
        const { data: teamMembers } = await sb
          .from('team_members')
          .select('user_id')
          .in('team_id', enabledTeamIds);

        // Deduplicate (a user can be in multiple teams)
        const uniqueUserIds = new Set((teamMembers || []).map((m: any) => m.user_id));
        recipientUserIds = Array.from(uniqueUserIds);
      }
    }

    if (recipientUserIds.length === 0) return;

    // Check user-level preferences: filter out users who have this event disabled
    const { data: userPrefs } = await sb
      .from('notification_preferences')
      .select('user_id, events_json')
      .in('user_id', recipientUserIds)
      .eq('organization_id', organizationId);

    const prefsMap = new Map<string, Record<string, boolean>>();
    for (const pref of (userPrefs || [])) {
      if (pref.events_json && typeof pref.events_json === 'object') {
        prefsMap.set(pref.user_id, pref.events_json as Record<string, boolean>);
      }
    }

    // Filter: keep users who have the event enabled (or have no preference = default enabled)
    const finalRecipients = recipientUserIds.filter(userId => {
      const userEvents = prefsMap.get(userId);
      if (!userEvents) return true; // No preferences → default enabled
      const eventEnabled = userEvents[eventKey];
      return eventEnabled !== false; // undefined or true → enabled
    });

    if (finalRecipients.length === 0) return;

    // Create notification rows
    const notifications = finalRecipients.map(userId => ({
      organization_id: organizationId,
      user_id: userId,
      type: notificationType,
      title,
      body: body.substring(0, 500),
      entity_type: entityType,
      entity_id: entityId,
    }));

    // Batch insert (max 100 at a time to avoid payload limits)
    for (let i = 0; i < notifications.length; i += 100) {
      const batch = notifications.slice(i, i + 100);
      await sb.from('notifications').insert(batch);
    }
  } catch (error) {
    console.warn('[notificationHelper] Error sending notification:', error);
  }
}
