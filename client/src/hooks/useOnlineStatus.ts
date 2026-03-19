import { useState, useEffect, useCallback } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (!navigator.onLine) return; // Double check
    // Mark that we just came back online (to trigger sync prompt)
    setWasOffline(true);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    wasOffline,
    clearWasOffline,
  };
};
