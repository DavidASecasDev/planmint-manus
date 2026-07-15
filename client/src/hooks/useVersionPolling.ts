import { useEffect, useRef, useCallback } from 'react';

declare const __APP_BUILD_VERSION__: string;

const POLL_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const CURRENT_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : '__dev__';

/**
 * Polls /api/version every 5 minutes. If the server reports a different
 * build version than the one baked into this JS bundle, it means a new
 * deployment happened. We show a non-intrusive toast and auto-reload
 * when the user navigates or after 30 seconds of inactivity.
 */
export function useVersionPolling() {
  const hasNewVersion = useRef(false);
  const toastShown = useRef(false);

  const checkVersion = useCallback(async () => {
    if (CURRENT_VERSION === '__dev__') return; // Skip in dev mode
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== CURRENT_VERSION && data.version !== '__dev__') {
        hasNewVersion.current = true;
        if (!toastShown.current) {
          toastShown.current = true;
          showUpdateNotification();
        }
      }
    } catch {
      // Network error - ignore silently
    }
  }, []);

  useEffect(() => {
    // Initial check after 30 seconds (give the page time to load)
    const initialTimeout = setTimeout(checkVersion, 30_000);
    // Then poll every 5 minutes
    const interval = setInterval(checkVersion, POLL_INTERVAL_MS);

    // Also reload on visibility change if new version detected
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasNewVersion.current) {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersion]);
}

function showUpdateNotification() {
  // Create a non-intrusive banner at the top of the page
  const banner = document.createElement('div');
  banner.id = 'version-update-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 99999;
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    color: white;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease-out;
  `;
  banner.innerHTML = `
    <span>🔄 Hay una nueva versión disponible.</span>
    <button id="version-reload-btn" style="
      background: white;
      color: #059669;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    ">Actualizar ahora</button>
    <button id="version-dismiss-btn" style="
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.5);
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    ">Después</button>
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(banner);

  document.getElementById('version-reload-btn')?.addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('version-dismiss-btn')?.addEventListener('click', () => {
    banner.remove();
    // Auto-reload after 30 seconds of inactivity anyway
    setTimeout(() => {
      if (document.visibilityState === 'hidden') {
        window.location.reload();
      }
    }, 30_000);
  });
}
