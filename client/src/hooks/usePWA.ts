import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Check if app is installed (standalone mode)
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkInstalled();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", checkInstalled);
    
    return () => mediaQuery.removeEventListener("change", checkInstalled);
  }, []);

  // Online/Offline detection
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

  // Install prompt handling
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      // Clear dismissed state on install
      localStorage.removeItem("pwa-install-dismissed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Install the app
  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
      } else {
        // User dismissed, save timestamp to not show again for a while
        localStorage.setItem("pwa-install-dismissed", Date.now().toString());
      }
      
      setDeferredPrompt(null);
      return outcome === "accepted";
    } catch (error) {
      console.error("Error installing PWA:", error);
      return false;
    }
  }, [deferredPrompt]);

  // Check if we should show install prompt
  const shouldShowInstallPrompt = useCallback(() => {
    if (isInstalled || !isInstallable) return false;
    
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      return daysSinceDismissed >= 7;
    }
    
    return true;
  }, [isInstalled, isInstallable]);

  // Dismiss install prompt
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
