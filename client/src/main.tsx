import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme immediately to prevent flash
const storedTheme = localStorage.getItem('theme_pref');
if (storedTheme === 'dark' || (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.add('light');
}

createRoot(document.getElementById("root")!).render(<App />);

// ── Register Service Worker for PWA + push notifications ──
// The SW is registered for push notification support and offline fallback.
// It does NOT aggressively take over tabs or auto-refresh the page.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered, scope:', reg.scope);
        
        // Check for updates when a new SW is found
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed but waiting — tell it to activate immediately
              // This ensures users get the latest version without manual refresh
              console.log('[PWA] New Service Worker available, activating...');
              newWorker.postMessage('skipWaiting');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });

    // When the new SW takes control, reload to use updated assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[PWA] New Service Worker activated, refreshing page...');
      window.location.reload();
    });
  });
}
