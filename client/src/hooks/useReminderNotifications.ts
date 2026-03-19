import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from './useNotifications';
import { addDays, addWeeks, addMonths } from 'date-fns';

export function useReminderNotifications() {
  const { user, profile } = useAuth();
  const { createNotification, hasRecentNotification } = useNotifications();
  const lastCheckRef = useRef<Date | null>(null);

  const checkDueReminders = useCallback(async () => {
    if (!user || !profile?.organization_id) return;

    try {
      const now = new Date();

      // Get active reminders that are due
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select(`
          id,
          remind_at,
          recurrence_type,
          recurrence_interval,
          task_id,
          tasks!inner (
            id,
            title,
            organization_id,
            created_by,
            assigned_to
          )
        `)
        .eq('is_active', true)
        .lte('remind_at', now.toISOString());

      if (error) throw error;

      for (const reminder of reminders || []) {
        const task = reminder.tasks as any;
        
        // Only process reminders for tasks in user's organization
        if (task.organization_id !== profile.organization_id) continue;

        // Determine who should receive the notification
        const recipientId = task.assigned_to || task.created_by;
        if (!recipientId) continue;

        // Check if we already sent a notification for this reminder recently
        const hasRecent = await hasRecentNotification(
          'reminder',
          'reminder',
          reminder.id,
          recipientId,
          24
        );

        if (!hasRecent) {
          // Create notification
          await createNotification({
            user_id: recipientId,
            type: 'reminder',
            title: 'Recordatorio',
            body: `Tarea: ${task.title}`,
            entity_type: 'reminder',
            entity_id: reminder.id,
          });
        }

        // Update remind_at for recurring reminders
        if (reminder.recurrence_type !== 'once') {
          const interval = reminder.recurrence_interval || 1;
          let newRemindAt: Date;

          switch (reminder.recurrence_type) {
            case 'daily':
              newRemindAt = addDays(new Date(reminder.remind_at), interval);
              break;
            case 'weekly':
              newRemindAt = addWeeks(new Date(reminder.remind_at), interval);
              break;
            case 'monthly':
              newRemindAt = addMonths(new Date(reminder.remind_at), interval);
              break;
            default:
              continue;
          }

          await supabase
            .from('reminders')
            .update({ remind_at: newRemindAt.toISOString() })
            .eq('id', reminder.id);
        } else {
          // Deactivate one-time reminders
          await supabase
            .from('reminders')
            .update({ is_active: false })
            .eq('id', reminder.id);
        }
      }
    } catch (error) {
      console.error('Error checking due reminders:', error);
    }
  }, [user, profile?.organization_id, createNotification, hasRecentNotification]);

  // Check reminders on mount and every 5 minutes
  useEffect(() => {
    if (!user || !profile?.organization_id) return;

    // Initial check
    checkDueReminders();

    // Set up interval for periodic checks
    const interval = setInterval(() => {
      checkDueReminders();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, profile?.organization_id, checkDueReminders]);

  return { checkDueReminders };
}
