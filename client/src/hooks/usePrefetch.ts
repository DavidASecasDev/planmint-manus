import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';

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
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const prefetchedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doPrefetch = useCallback(
    (route: string) => {
      if (!orgId) return;
      if (prefetchedRef.current.has(route)) return;
      prefetchedRef.current.add(route);

      const opts = { staleTime: 60_000 }; // 1 minute

      switch (route) {
        case '/dashboard':
          // Dashboard uses apiInvoke — safe to prefetch with same shape
          queryClient.prefetchQuery({
            queryKey: ['operational-dashboard', orgId],
            queryFn: async () => {
              const result = await apiInvoke('get-operational-dashboard');
              return result?.data ?? null;
            },
            ...opts,
          });
          break;

        // For routes with complex queryFns (joins, role-dependent endpoints),
        // we do nothing. The page hook will use cached data if staleTime hasn't
        // expired, or fetch fresh data on mount. This is better than invalidating
        // which would force a refetch even when cached data is still valid.
        case '/reservations':
        case '/transfers':
        case '/fleet':
        case '/movements':
        case '/vehicles':
          // No-op: let the existing cache serve data or let the page hook fetch
          break;

        default:
          break;
      }
    },
    [orgId, queryClient],
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
