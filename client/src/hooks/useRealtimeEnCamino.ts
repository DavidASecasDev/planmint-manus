/**
 * useRealtimeEnCamino — Supabase Realtime hook for en_camino_tracking
 *
 * Subscribes to postgres_changes on en_camino_tracking and location_history.
 * Provides:
 *   - Instant push updates (INSERT/UPDATE/DELETE) — no polling needed
 *   - Connection status indicator ("connected" | "connecting" | "disconnected")
 *   - Fallback polling every 60s when realtime is disconnected
 *   - Manual refresh function
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { format } from 'date-fns';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface EnCaminoRecord {
  id: string;
  reservation_id: string;
  external_reservation_id?: string | null;
  operation_type: 'entrega' | 'devolucion';
  en_camino_at: string;
  destination_address: string | null;
  assigned_user_name: string | null;
  created_at: string;
  llego_at?: string | null;
  // Live location fields
  sharing_location?: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  location_updated_at?: string | null;
  // Share token for public tracking link
  share_token?: string | null;
}

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

const FALLBACK_POLL_INTERVAL = 60_000; // 60s fallback when realtime is down

export function useRealtimeEnCamino() {
  const [records, setRecords] = useState<EnCaminoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Full fetch from API (initial load + fallback) ──
  const fetchRecords = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const resp = await apiInvoke<{ ok: boolean; records: EnCaminoRecord[] }>('en-camino-tracking', {
        body: { _method: 'GET', date: today },
      });
      if (resp.data?.ok && resp.data.records && mountedRef.current) {
        setRecords(resp.data.records);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('[realtime-en-camino] Fetch error:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // ── Apply incremental realtime event ──
  const applyRealtimeEvent = useCallback((eventType: string, newRow: any, oldRow: any) => {
    const today = format(new Date(), 'yyyy-MM-dd');

    setRecords(prev => {
      switch (eventType) {
        case 'INSERT': {
          // Only add if it's today and not completed
          const enCaminoDate = newRow.en_camino_at?.split('T')[0];
          if (enCaminoDate !== today || newRow.llego_at) return prev;
          // Avoid duplicates
          if (prev.some(r => r.id === newRow.id)) return prev;
          return [newRow, ...prev];
        }
        case 'UPDATE': {
          // If llego_at was set, remove from active list
          if (newRow.llego_at) {
            return prev.filter(r => r.id !== newRow.id);
          }
          // Otherwise update the record in-place (e.g., location update)
          return prev.map(r => r.id === newRow.id ? { ...r, ...newRow } : r);
        }
        case 'DELETE': {
          const deletedId = oldRow?.id || newRow?.id;
          return prev.filter(r => r.id !== deletedId);
        }
        default:
          return prev;
      }
    });

    setLastUpdated(new Date());
  }, []);

  // ── Setup Supabase Realtime subscription ──
  useEffect(() => {
    mountedRef.current = true;

    // 1. Initial full fetch
    fetchRecords();

    // 2. Subscribe to realtime changes on en_camino_tracking
    const channel = supabase.channel('livemap-en-camino', {
      config: { broadcast: { self: true } },
    });

    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'en_camino_tracking',
      }, (payload) => {
        if (!mountedRef.current) return;
        console.log('[realtime] en_camino_tracking event:', payload.eventType);
        applyRealtimeEvent(payload.eventType, payload.new, payload.old);
      })
      .subscribe((status) => {
        if (!mountedRef.current) return;
        console.log('[realtime] Channel status:', status);

        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          // Clear fallback polling when connected
          if (fallbackIntervalRef.current) {
            clearInterval(fallbackIntervalRef.current);
            fallbackIntervalRef.current = null;
          }
          // Do a fresh fetch to sync any events we missed during connection
          fetchRecords();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('disconnected');
          // Start fallback polling
          if (!fallbackIntervalRef.current) {
            fallbackIntervalRef.current = setInterval(() => fetchRecords(), FALLBACK_POLL_INTERVAL);
          }
        } else {
          setRealtimeStatus('connecting');
        }
      });

    channelRef.current = channel;

    // 3. Cleanup
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [fetchRecords, applyRealtimeEvent]);

  return {
    records,
    loading,
    refreshing,
    lastUpdated,
    realtimeStatus,
    fetchRecords,
  };
}
