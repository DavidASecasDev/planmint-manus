import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

/**
 * Hook that syncs filter state with URL search params.
 * - Values equal to defaults are omitted from the URL to keep it clean.
 * - Supports strings, string arrays (comma-separated), and booleans.
 * - Uses `replace: true` to avoid polluting browser history.
 * - Uses sessionStorage as fallback: when navigating back to a route
 *   without params (e.g. sidebar click), restores filters from storage.
 */

function getStorageKey(pathname: string) {
  return `filters:${pathname}`;
}

function parseFiltersFromParams<T extends Record<string, any>>(
  searchParams: URLSearchParams,
  defaults: T
): T {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    const paramValue = searchParams.get(key);
    if (paramValue === null) continue;
    if (Array.isArray(defaultValue)) {
      (result as Record<string, unknown>)[key] = paramValue ? paramValue.split(',') : [];
    } else if (typeof defaultValue === 'boolean') {
      (result as Record<string, unknown>)[key] = paramValue === 'true';
    } else {
      (result as Record<string, unknown>)[key] = paramValue;
    }
  }
  return result;
}

function hasRelevantParams<T extends Record<string, any>>(
  searchParams: URLSearchParams,
  defaults: T
): boolean {
  for (const key of Object.keys(defaults)) {
    if (searchParams.has(key)) return true;
  }
  return false;
}

function filtersToParams<T extends Record<string, any>>(
  filters: T,
  defaults: T
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults)) {
    const value = filters[key];
    const defaultValue = defaults[key];
    const isDefault = Array.isArray(value) && Array.isArray(defaultValue)
      ? value.length === defaultValue.length && value.every((v: any, i: number) => v === (defaultValue as unknown[])[i])
      : value === defaultValue;
    if (isDefault) continue;
    if (Array.isArray(value)) {
      params.set(key, (value as string[]).join(','));
    } else if (typeof value === 'boolean') {
      params.set(key, String(value));
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

export function usePersistedFilters<T extends Record<string, any>>(
  defaults: T
): [T, (update: T | ((prev: T) => T)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const restoredRef = useRef(false);
  const pendingRestoreRef = useRef<URLSearchParams | null>(null);

  // On first render, check if we need to schedule a restore from sessionStorage
  if (!restoredRef.current) {
    if (!hasRelevantParams(searchParams, defaults)) {
      const storageKey = getStorageKey(pathname);
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const savedParams = new URLSearchParams(stored);
          if (hasRelevantParams(savedParams, defaults)) {
            pendingRestoreRef.current = savedParams;
          }
        }
      } catch {
        // sessionStorage unavailable
      }
    }
    restoredRef.current = true;
  }

  // Apply pending restore in an effect (safe, after render)
  useEffect(() => {
    if (pendingRestoreRef.current) {
      const params = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      setSearchParams(params, { replace: true });
    }
  }, [setSearchParams]);

  // Reset restoration flag on pathname change
  useEffect(() => {
    restoredRef.current = false;
    pendingRestoreRef.current = null;
  }, [pathname]);

  // Re-check sessionStorage on pathname change
  useEffect(() => {
    // Small delay to allow the restoredRef reset above to take effect
    const timer = setTimeout(() => {
      if (!hasRelevantParams(searchParams, defaults)) {
        const storageKey = getStorageKey(pathname);
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) {
            const savedParams = new URLSearchParams(stored);
            if (hasRelevantParams(savedParams, defaults)) {
              setSearchParams(savedParams, { replace: true });
            }
          }
        } catch {
          // sessionStorage unavailable
        }
      }
      restoredRef.current = true;
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const filters = useMemo(() => {
    // If we have a pending restore, use those params for the initial render
    // to avoid a flash of default values
    if (pendingRestoreRef.current) {
      return parseFiltersFromParams(pendingRestoreRef.current, defaults);
    }
    return parseFiltersFromParams(searchParams, defaults);
  }, [searchParams, defaults]);

  // Persist to sessionStorage whenever URL params change
  useEffect(() => {
    if (!restoredRef.current) return;
    const nonDefaultParams = filtersToParams(filters, defaults);
    const storageKey = getStorageKey(pathname);
    try {
      if (nonDefaultParams.toString()) {
        sessionStorage.setItem(storageKey, nonDefaultParams.toString());
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [filters, defaults, pathname]);

  const setFilters = useCallback(
    (update: T | ((prev: T) => T)) => {
      const currentFilters = parseFiltersFromParams(searchParams, defaults);
      const newFilters = typeof update === 'function' ? update(currentFilters) : update;

      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          for (const key of Object.keys(defaults)) {
            const value = newFilters[key];
            const defaultValue = defaults[key];
            const isDefault = Array.isArray(value) && Array.isArray(defaultValue)
              ? value.length === defaultValue.length && value.every((v: any, i: number) => v === (defaultValue as unknown[])[i])
              : value === defaultValue;
            if (isDefault) {
              params.delete(key);
            } else if (Array.isArray(value)) {
              params.set(key, (value as string[]).join(','));
            } else if (typeof value === 'boolean') {
              params.set(key, String(value));
            } else {
              params.set(key, String(value));
            }
          }
          return params;
        },
        { replace: true }
      );
    },
    [searchParams, setSearchParams, defaults]
  );

  return [filters, setFilters];
}
