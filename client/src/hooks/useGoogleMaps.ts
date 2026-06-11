/**
 * useGoogleMaps — Loads the Google Maps JS SDK via the Manus Forge proxy.
 * Fetches the script URL from /api/maps-js-url and loads it dynamically.
 * Returns { isLoaded, error } so components can wait for the SDK.
 */
import { useState, useEffect, useCallback } from 'react';

let _loadPromise: Promise<void> | null = null;
let _isLoaded = false;

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(_isLoaded);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Already loaded
    if (_isLoaded || (window as any).google?.maps) {
      _isLoaded = true;
      setIsLoaded(true);
      return;
    }

    // Already loading
    if (_loadPromise) {
      await _loadPromise;
      setIsLoaded(true);
      return;
    }

    _loadPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Get the Maps JS URL from our server
        const res = await fetch('/api/maps-js-url');
        const json = await res.json();

        if (!json.ok || !json.url) {
          throw new Error(json.error || 'Failed to get Maps JS URL');
        }

        // Set up the callback
        (window as any).__initGoogleMaps = () => {
          _isLoaded = true;
          setIsLoaded(true);
          resolve();
        };

        // Load the script
        const script = document.createElement('script');
        script.src = json.url;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          const err = 'Failed to load Google Maps SDK';
          setError(err);
          reject(new Error(err));
        };
        document.head.appendChild(script);
      } catch (err: any) {
        setError(err.message);
        reject(err);
      }
    });

    try {
      await _loadPromise;
    } catch {
      // error already set
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { isLoaded, error };
}
