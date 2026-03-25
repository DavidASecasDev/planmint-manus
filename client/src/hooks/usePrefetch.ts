import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';

/**
 * Hook that provides a prefetch handler for sidebar navigation items.
 * When the user hovers over a sidebar link, we prefetch the main data
 * for that page so it's already cached when they click.
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

      // Prefetch with a short staleTime so we don't refetch if data is fresh
      const opts = { staleTime: 60_000 }; // 1 minute

      switch (route) {
        case '/dashboard':
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
          queryClient.prefetchQuery({
            queryKey: ['reservations', orgId, true],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .eq('organization_id', orgId)
                .order('fecha_entrada', { ascending: false });
              if (error) throw error;
              return data;
            },
            ...opts,
          });
          break;

        case '/transfers':
          queryClient.prefetchQuery({
            queryKey: ['transfer-requests', orgId, {}],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('transfer_requests')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: false });
              if (error) throw error;
              return data;
            },
            ...opts,
          });
          break;

        case '/fleet':
          queryClient.prefetchQuery({
            queryKey: ['fleet-vehicles', orgId],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('fleet_vehicles')
                .select('*')
                .eq('organization_id', orgId)
                .order('matricula');
              if (error) throw error;
              return data;
            },
            ...opts,
          });
          break;

        case '/movements':
          queryClient.prefetchQuery({
            queryKey: ['vehicle-movements', orgId, {}],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('vehicle_movements')
                .select('*')
                .eq('organization_id', orgId)
                .order('started_at', { ascending: false })
                .limit(50);
              if (error) throw error;
              return data;
            },
            ...opts,
          });
          break;

        case '/vehicles':
          queryClient.prefetchQuery({
            queryKey: ['vehicles', orgId],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('vehicles')
                .select('*')
                .eq('organization_id', orgId)
                .order('matricula');
              if (error) throw error;
              return data;
            },
            ...opts,
          });
          break;

        default:
          // No prefetch configured for this route
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
