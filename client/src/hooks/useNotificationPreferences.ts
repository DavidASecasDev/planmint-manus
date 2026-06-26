import { useState, useEffect, useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationPreferences } from '@/types/external-notifications';

const DEFAULT_PREFERENCES = {
  channel_in_app: true,
  channel_push: false,
  channel_email: false,
  channel_slack: false,
  channel_whatsapp: false,
  sound_enabled: true,
  vibration_enabled: true,
  events_json: {
    mention: true,
    assignment: true,
    reminder: true,
    ai_insight: false,
    rental_assigned: true,
    escoba_assigned: true,
    hora_confirmada: true,
    vehiculo_listo: true,
    shuttle_programado: true,
    refuerzo_necesario: true,
    nueva_reserva: false,
    reserva_cancelada: false,
  },
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
};

export function useNotificationPreferences() {
  const { profile } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!profile?.id || !profile?.organization_id) return;

    try {
      const { data, error } = await supabaseQuery
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          ...data,
          events_json: data.events_json as NotificationPreferences['events_json'],
        });
      } else {
        // Create default preferences
        const { data: newData, error: insertError } = await supabaseQuery
          .from('notification_preferences')
          .insert({
            user_id: profile.id,
            organization_id: profile.organization_id,
            ...DEFAULT_PREFERENCES,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setPreferences({
          ...newData,
          events_json: newData.events_json as NotificationPreferences['events_json'],
        });
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.organization_id]);

  const updatePreferences = useCallback(async (
    updates: Partial<Omit<NotificationPreferences, 'id' | 'organization_id' | 'user_id' | 'created_at'>>
  ): Promise<boolean> => {
    if (!preferences) return false;

    setSaving(true);
    try {
      const { error } = await supabaseQuery
        .from('notification_preferences')
        .update(updates)
        .eq('id', preferences.id);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    saving,
    updatePreferences,
    refetch: fetchPreferences,
  };
}
