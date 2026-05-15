import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Invalidates all stale React Query caches when the user returns to the tab
 * after being away for more than `thresholdMs` milliseconds.
 *
 * This prevents the common scenario where a user leaves the app open in a
 * background tab, comes back after 5+ minutes, and sees stale/empty data
 * that requires a manual page reload.
 *
 * It does NOT force a hard refetch — it only marks queries as stale so they
 * refetch on next access. Active queries on the current page will refetch
 * immediately because they are already "accessed".
 */
export function useVisibilityRecovery(thresholdMs = 5 * 60 * 1000) {
  const queryClient = useQueryClient();
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab went to background — record the timestamp
        hiddenAtRef.current = Date.now();
      } else {
        // Tab came back to foreground
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;

        if (hiddenAt && Date.now() - hiddenAt > thresholdMs) {
          console.log(
            `[VisibilityRecovery] Tab was hidden for ${Math.round((Date.now() - hiddenAt) / 1000)}s — invalidating stale queries`
          );
          // Invalidate all queries — React Query will only refetch those that are
          // currently mounted (active) and stale. Inactive queries just get marked
          // for refetch on next mount.
          queryClient.invalidateQueries();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, thresholdMs]);
}
