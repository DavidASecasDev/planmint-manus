import { useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that provides a prefetch handler for sidebar navigation items.
 * When the user hovers over a sidebar link, we prefetch the main data
 * for that page so it's already cached when they click.
 *
 * IMPORTANT: We only prefetch routes where we can guarantee the same
 * queryKey + queryFn shape as the actual page hook. For complex queries
 * (vehicles with joins, reservations via role-dependent endpoints), we
 * do NOTHING — the existing staleTime cache will serve the data if fresh,
 * or the page hook will fetch on mount.
 *
 * We NEVER invalidate queries on hover — that's counterproductive because
 * it forces a refetch even when the cached data is still valid.
 *
 * Uses a debounce (150ms) to avoid prefetching on quick mouse sweeps.
 * Each route is only prefetched once per session to avoid redundant calls.
 */
export function usePrefetch() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const prefetchedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doPrefetch = useCallback(
    (route: string) => {
      if (!orgId) return;
      if (prefetchedRef.current.has(route)) return;
      prefetchedRef.current.add(route);

      // NOTE: Dashboard prefetch was removed because the useOperationalDashboard hook
      // transforms the raw server response (DashboardServerResponse → OperationalStats).
      // Prefetching raw data into the same cache key caused a type mismatch crash
      // ("Cannot read properties of undefined reading 'sucio'").
      // All routes currently use complex queryFns with transformations, so we do nothing
      // and let the page hooks fetch on mount with their own queryFn.
    },
    [orgId],
  );

  /**
   * Call this on onMouseEnter of sidebar links.
   * Debounces by 150ms to avoid prefetching on quick mouse sweeps.
   */
  const handlePrefetch = useCallback(
    (route: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doPrefetch(route), 150);
    },
    [doPrefetch],
  );

  /** Cancel pending prefetch (call on onMouseLeave) */
  const cancelPrefetch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { handlePrefetch, cancelPrefetch };
}
