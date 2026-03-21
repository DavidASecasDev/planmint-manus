import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Global singleton to capture the beforeinstallprompt event.
 * The event can fire before any React component mounts, so we
 * capture it at module level and replay it to the hook.
 */
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstallableListeners: Array<(e: BeforeInstallPromptEvent) => void> = [];

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    // Notify all mounted hooks
    globalInstallableListeners.forEach((fn) => fn(globalDeferredPrompt!));
  });
}

export function usePWA() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isInstallable, setIsInstallable] = useState(!!globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);

  // ── Check if app is already installed (standalone mode) ──
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkInstalled();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", checkInstalled);
    return () => mediaQuery.removeEventListener("change", checkInstalled);
  }, []);

  // ── Online / Offline detection ──
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Subscribe to the global beforeinstallprompt capture ──
  useEffect(() => {
    // If the event already fired before this hook mounted, pick it up
    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstallable(true);
    }

    const listener = (e: BeforeInstallPromptEvent) => {
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    globalInstallableListeners.push(listener);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      localStorage.removeItem("pwa-install-dismissed");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      globalInstallableListeners = globalInstallableListeners.filter(
        (fn) => fn !== listener
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // ── Trigger the native install prompt ──
  const installApp = useCallback(async () => {
    const prompt = deferredPrompt || globalDeferredPrompt;
    if (!prompt) return false;

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
      } else {
        localStorage.setItem("pwa-install-dismissed", Date.now().toString());
      }

      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      return outcome === "accepted";
    } catch (error) {
      console.error("Error installing PWA:", error);
      return false;
    }
  }, [deferredPrompt]);

  // ── Should the install banner be shown? ──
  const shouldShowInstallPrompt = useCallback(() => {
    if (isInstalled) return false;
    if (!isInstallable) return false;

    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const daysSinceDismissed =
        (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      // Show again after 3 days (reduced from 7 for mobile)
      return daysSinceDismissed >= 3;
    }

    return true;
  }, [isInstalled, isInstallable]);

  // ── Dismiss ──
  const dismissInstallPrompt = useCallback(() => {
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  return {
    isOnline,
    isInstallable,
    isInstalled,
    installApp,
    shouldShowInstallPrompt,
    dismissInstallPrompt,
  };
}
