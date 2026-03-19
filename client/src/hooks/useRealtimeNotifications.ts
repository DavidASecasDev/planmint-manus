import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'RealtimeNotifications' }); // v2 - server-side trigger

const POLL_INTERVAL_MS = 15_000;

export function useRealtimeNotifications() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hasNewNotificationRef = useRef(false);
  const lastSeenAtRef = useRef<string>(new Date().toISOString());

  const playNotificationSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playBeep = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
        osc.start(time);
        osc.stop(time + 0.12);
      };

      const now = ctx.currentTime;
      playBeep(now, 880);
      playBeep(now + 0.15, 880);
      playBeep(now + 0.35, 1174.66);

      setTimeout(() => ctx.close(), 1000);
    } catch (e) {
      log.error('Error playing notification sound:', e);
    }
  }, []);

  const showUrgentToast = useCallback((title: string, body: string, taskId?: string) => {
    toast(title, {
      description: body,
      duration: 10000,
      icon: '🔴',
      action: taskId ? {
        label: 'Ver tarea',
        onClick: () => navigate(`/tasks?task=${taskId}`),
      } : undefined,
      className: 'border-destructive/50 bg-destructive/5',
    });
  }, [navigate]);

  const handleNewNotification = useCallback((notification: {
    id: string;
    title: string;
    body: string;
    type: string;
    entity_type: string;
    entity_id: string;
  }) => {
    log.info('New notification:', notification.title);

    queryClient.invalidateQueries({ queryKey: ['notifications', profile?.organization_id] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', profile?.organization_id] });

    hasNewNotificationRef.current = true;

    const isUrgent = notification.title.startsWith('🔴');
    if (isUrgent) {
      playNotificationSound();
      const taskId = notification.entity_type === 'task' ? notification.entity_id : undefined;
      showUrgentToast(notification.title, notification.body, taskId);
    }
  }, [queryClient, profile?.organization_id, playNotificationSound, showUrgentToast]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id || !profile?.organization_id) return;

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as any;
          lastSeenAtRef.current = new Date().toISOString();
          handleNewNotification(n);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.organization_id, handleNewNotification]);

  // Polling fallback every 15s
  useEffect(() => {
    if (!user?.id || !profile?.organization_id) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, body, type, entity_type, entity_id, created_at')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .gt('created_at', lastSeenAtRef.current)
          .order('created_at', { ascending: true })
          .limit(5);

        if (error || !data || data.length === 0) return;

        // Update lastSeenAt to the newest notification
        lastSeenAtRef.current = data[data.length - 1].created_at;

        for (const n of data) {
          handleNewNotification(n);
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user?.id, profile?.organization_id, handleNewNotification]);

  return {
    hasNewNotification: hasNewNotificationRef,
  };
}
