import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';

/**
 * Hook that provides a prefetch handler for sidebar navigation items.
 * When the user hovers over a sidebar link, we prefetch the main data
 * for that page so it's already cached when they click.
 *
 * IMPORTANT: Prefetch queries MUST use the exact same queryKey AND queryFn
 * as the actual page hooks. If the prefetch returns a different shape
 * (e.g., raw rows vs. enriched objects), the page component will crash
 * when it tries to access properties that don't exist on the prefetched data.
 *
 * For complex queries (vehicles with cleaning_tasks, reservations via
 * Express endpoints), we simply invalidate the cache to trigger a fresh
 * fetch when the user navigates, rather than risk shape mismatches.
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

        case '/reservations':
          // Reservations use either Supabase direct or Express endpoint
          // depending on user role. Just warm the cache by invalidating
          // so the actual hook fetches fresh data quickly.
          queryClient.invalidateQueries({
            queryKey: ['reservations', orgId],
          });
          break;

        case '/transfers':
          // Transfer requests — invalidate to trigger fresh fetch
          queryClient.invalidateQueries({
            queryKey: ['transfer-requests', orgId],
          });
          break;

        case '/fleet':
          // Fleet vehicles — invalidate to trigger fresh fetch
          queryClient.invalidateQueries({
            queryKey: ['fleet-vehicles', orgId],
          });
          break;

        case '/movements':
          // Vehicle movements — invalidate to trigger fresh fetch
          queryClient.invalidateQueries({
            queryKey: ['vehicle-movements', orgId],
          });
          break;

        case '/vehicles':
          // Vehicles use a complex queryFn that joins cleaning_tasks,
          // reservations, locations, etc. A simple select('*') prefetch
          // would return raw rows without cleaning_tasks, causing crashes.
          // Just invalidate so the actual hook fetches with full joins.
          queryClient.invalidateQueries({
            queryKey: ['vehicles', orgId],
          });
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
