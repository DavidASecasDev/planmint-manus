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
// CRITICAL: The SW must NEVER auto-reload the page while users are working.
// Updates are deferred until the user navigates away or manually refreshes.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered, scope:', reg.scope);
        
        // Check for updates periodically (every 60 minutes)
        setInterval(() => {
          reg.update().catch(() => {
            // Silently ignore update check failures
          });
        }, 60 * 60 * 1000);
        
        // When a new SW is found, let it install but DO NOT activate it immediately.
        // The new SW will activate naturally when all tabs are closed and reopened,
        // or when the user does a manual refresh.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is installed and waiting. Show a non-intrusive update banner
              // instead of forcing a reload that would interrupt the user's work.
              console.log('[PWA] New version available. Will activate on next visit.');
              showUpdateBanner();
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });

    // DO NOT listen for 'controllerchange' to auto-reload.
    // This was the primary cause of unexpected page refreshes during user work.
    // The new SW will take effect when the user naturally refreshes or revisits.
  });
}

/**
 * Shows a subtle, non-blocking banner informing the user that a new version
 * is available. The user can choose to update (reload) when convenient,
 * or dismiss and the update will apply on next visit.
 */
function showUpdateBanner() {
  // Don't show if already showing
  if (document.getElementById('sw-update-banner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a2332;
    color: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    animation: slideUp 0.3s ease-out;
    max-width: 90vw;
  `;
  
  banner.innerHTML = `
    <style>
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      #sw-update-banner button {
        border: none;
        cursor: pointer;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 500;
        transition: opacity 0.2s;
      }
      #sw-update-banner button:hover { opacity: 0.85; }
    </style>
    <span>Nueva versión disponible</span>
    <button id="sw-update-btn" style="background: #c9a96e; color: #1a2332;">
      Actualizar
    </button>
    <button id="sw-dismiss-btn" style="background: transparent; color: #999; padding: 6px 8px;">
      ✕
    </button>
  `;
  
  document.body.appendChild(banner);
  
  document.getElementById('sw-update-btn')?.addEventListener('click', () => {
    // User explicitly chose to update — safe to reload now
    window.location.reload();
  });
  
  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
    banner.remove();
  });
  
  // Auto-dismiss after 30 seconds if user doesn't interact
  setTimeout(() => {
    banner?.remove();
  }, 30000);
}
