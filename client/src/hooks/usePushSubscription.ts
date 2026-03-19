import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PushSubscription } from '@/types/external-notifications';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let cachedVapidKey: string | null = null;

async function getVapidPublicKey(): Promise<string | null> {
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;
  if (cachedVapidKey) return cachedVapidKey;
  try {
    const { data, error } = await supabase.functions.invoke('get-vapid-key');
    if (error || !data?.vapidPublicKey) {
      console.error('Failed to fetch VAPID key:', error);
      return null;
    }
    cachedVapidKey = data.vapidPublicKey;
    return cachedVapidKey;
  } catch (err) {
    console.error('Error fetching VAPID key:', err);
    return null;
  }
}

/** Detect if running on iOS */
function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Detect if PWA is running in standalone mode (installed) */
function isStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export type PushStatus =
  | 'ready'           // Can subscribe
  | 'subscribed'      // Active subscription
  | 'not_supported'   // Browser doesn't support push
  | 'denied'          // User denied permission
  | 'ios_not_installed' // iOS but not installed as PWA
  | 'loading';

export function usePushSubscription() {
  const { profile } = useAuth();
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('loading');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Determine push status
    if (!supported) {
      if (isIOSDevice() && !isStandaloneMode()) {
        setPushStatus('ios_not_installed');
      } else {
        setPushStatus('not_supported');
      }
    } else if ('Notification' in window && Notification.permission === 'denied') {
      setPushStatus('denied');
    } else {
      setPushStatus('ready');
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_active', true);
      if (error) throw error;
      setSubscriptions(data || []);
      if (data && data.length > 0 && isSupported) {
        setPushStatus('subscribed');
      }
    } catch (error) {
      console.error('Error fetching push subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!profile?.id || !profile?.organization_id || !isSupported) return false;

    setSubscribing(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setPushStatus('denied');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription first
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidKey = await getVapidPublicKey();
        if (!vapidKey) {
          console.error('VAPID public key not available');
          return false;
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
      }

      const subscriptionJson = subscription.toJSON();
      
      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        console.error('Invalid subscription data');
        return false;
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: profile.id,
          organization_id: profile.organization_id,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          user_agent: navigator.userAgent,
          is_active: true,
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) throw error;

      setPushStatus('subscribed');
      await fetchSubscriptions();
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [profile?.id, profile?.organization_id, isSupported, fetchSubscriptions]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!profile?.id) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', profile.id);
      if (error) throw error;
      setSubscriptions([]);
      setPushStatus('ready');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return {
    subscriptions,
    loading,
    subscribing,
    permission,
    isSupported,
    pushStatus,
    isIOSNotInstalled: pushStatus === 'ios_not_installed',
    hasActiveSubscription: subscriptions.length > 0,
    subscribe,
    unsubscribe,
    refetch: fetchSubscriptions,
  };
}
