import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Bridge between the app and the service worker for push notifications.
 * 
 * - Listens for NOTIFICATION_CLICK messages from the SW (when user clicks a push notification)
 * - Provides sendLocalPush() to trigger a native notification via the SW when the app is in background
 */
export function usePushBridge() {
  const navigate = useNavigate();

  // Listen for notification click messages from the service worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url } = event.data;
        if (url) {
          navigate(url);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [navigate]);

  /**
   * Send a native push notification via the service worker.
   * Used when the app detects a new notification while in background/unfocused.
   */
  const sendLocalPush = useCallback(async (notification: {
    title: string;
    body: string;
    tag?: string;
    entity_type?: string;
    entity_id?: string;
    url?: string;
    requireInteraction?: boolean;
  }) => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: notification.title,
        options: {
          body: notification.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: notification.tag || `notif-${Date.now()}`,
          vibrate: [200, 100, 200],
          requireInteraction: notification.requireInteraction || false,
          data: {
            entity_type: notification.entity_type,
            entity_id: notification.entity_id,
            url: notification.url,
          },
          actions: [
            { action: 'view', title: 'Ver' },
            { action: 'dismiss', title: 'Cerrar' },
          ],
        },
      });
    } catch (error) {
      console.warn('[PushBridge] Failed to send local push:', error);
    }
  }, []);

  /**
   * Check if the app window is currently focused/visible.
   * If not, we should send a native push notification.
   */
  const isAppInBackground = useCallback((): boolean => {
    return document.hidden || !document.hasFocus();
  }, []);

  return {
    sendLocalPush,
    isAppInBackground,
  };
}
