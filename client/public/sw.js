/// <reference lib="webworker" />

const CACHE_NAME = 'azul-cars-v6';

// Only cache the bare minimum for icons
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: pre-cache essential assets ──
// Do NOT call skipWaiting() here — let the user control when to activate
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.log('[SW] Some assets failed to cache during install');
      });
    })
  );
  // NOTE: We intentionally do NOT call self.skipWaiting() here.
  // This prevents the new SW from taking over active tabs and causing
  // unexpected page reloads that interrupt user work.
});

// ── Activate: clean old caches ──
// Do NOT call clients.claim() — existing tabs keep using the old SW
// until the user naturally navigates or refreshes.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // NOTE: We intentionally do NOT call self.clients.claim() here.
  // This prevents the new SW from hijacking existing tabs mid-session.
});

// ── Fetch: minimal interception ──
// FIX: Do NOT intercept navigation requests. The SPA handles routing via
// React Router — intercepting navigation can serve stale HTML from cache
// and cause modules to appear blank until a manual refresh.
// Only cache static icon assets.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // NEVER intercept navigation requests — let them go to the network
  // This prevents stale index.html from being served after deploys
  if (request.mode === 'navigate') return;

  // Never intercept API calls or auth endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // For static assets (icons only): cache-first
  if (url.pathname.match(/\/(icon-\d+\.png|favicon\.ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // All other requests: go directly to network (no caching)
  // This prevents stale JS/CSS from being served after deploys
});

// ── Push Notification Handler ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    // Fallback for plain text push
    payload = {
      title: 'Azul Cars',
      body: event.data.text(),
      icon: '/icon-192.png',
    };
  }

  const {
    title = 'Azul Cars',
    body = '',
    icon = '/icon-192.png',
    badge = '/icon-192.png',
    tag = 'default',
    data = {},
    actions = [],
    requireInteraction = false,
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,
    data,
    actions,
    requireInteraction,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click Handler ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Route based on notification type
  if (data.entity_type === 'task' && data.entity_id) {
    targetUrl = `/tasks?task=${data.entity_id}`;
  } else if (data.entity_type === 'transfer_request' && data.entity_id) {
    targetUrl = `/transfers/requests/${data.entity_id}`;
  } else if (data.entity_type === 'transfer_note' && data.entity_id) {
    targetUrl = `/transfers/requests/${data.entity_id}`;
  } else if (data.entity_type === 'repair' && data.entity_id) {
    targetUrl = `/garatech/repairs/${data.entity_id}`;
  } else if (data.entity_type === 'accident' && data.entity_id) {
    targetUrl = `/garatech/accidents/${data.entity_id}`;
  } else if (data.entity_type === 'damage_report' && data.entity_id) {
    targetUrl = `/garatech/reports/${data.entity_id}`;
  } else if (data.entity_type === 'reminder' && data.entity_id) {
    targetUrl = `/tasks`;
  } else if (data.entity_type === 'invitation') {
    targetUrl = `/admin/members`;
  } else if (data.url) {
    targetUrl = data.url;
  }

  // Handle action buttons
  if (event.action === 'view') {
    // Default behavior - navigate to targetUrl
  } else if (event.action === 'dismiss') {
    return; // Just close the notification
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing window
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            data: data,
          });
          return;
        }
      }
      // No existing window - open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Notification Close Handler (analytics) ──
self.addEventListener('notificationclose', (event) => {
  // Could be used for tracking dismissed notifications
  console.log('[SW] Notification closed:', event.notification.tag);
});

// ── Message Handler ──
self.addEventListener('message', (event) => {
  // Only skip waiting when explicitly requested by the user (e.g., "Update available" banner)
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  // Handle show-notification messages from the app (foreground push)
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
