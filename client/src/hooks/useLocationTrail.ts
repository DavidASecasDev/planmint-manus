/**
 * useLocationTrail — Fetches and subscribes to GPS trail positions for active en-camino operations.
 *
 * For each tracking record that is sharing_location, fetches the location_history
 * and subscribes to Supabase Realtime for new positions.
 * Returns a map of trackingId -> position array for rendering polylines on the map.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface TrailPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  time: string;
}

export type TrailMap = Record<string, TrailPosition[]>;

interface TrailRecord {
  id: string;
  reservation_id: string;
  operation_type: string;
  sharing_location?: boolean;
}

export function useLocationTrail(records: TrailRecord[]) {
  const [trails, setTrails] = useState<TrailMap>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());

  // Fetch location history for a single tracking record
  const fetchTrail = useCallback(async (rec: TrailRecord) => {
    try {
      const resp = await apiInvoke<{ ok: boolean; positions: TrailPosition[] }>(
        'en-camino-tracking/location-history',
        {
          body: {
            reservation_id: rec.reservation_id,
            operation_type: rec.operation_type,
          },
        }
      );
      if (resp.data?.ok && resp.data.positions) {
        setTrails(prev => ({
          ...prev,
          [rec.id]: resp.data?.positions ?? [],
        }));
      }
    } catch (err) {
      console.error('[location-trail] Error fetching trail:', err);
    }
  }, []);

  // Fetch trails for all sharing records
  useEffect(() => {
    const sharingRecords = records.filter(r => r.sharing_location);

    // Fetch trails for records we haven't fetched yet
    for (const rec of sharingRecords) {
      if (!fetchedRef.current.has(rec.id)) {
        fetchedRef.current.add(rec.id);
        fetchTrail(rec);
      }
    }

    // Clean up trails for records that are no longer sharing
    const activeIds = new Set(sharingRecords.map(r => r.id));
    setTrails(prev => {
      const next: TrailMap = {};
      for (const [id, positions] of Object.entries(prev)) {
        if (activeIds.has(id)) {
          next[id] = positions;
        }
      }
      // Also clean up fetchedRef for removed records
      fetchedRef.current.forEach(id => {
        if (!activeIds.has(id)) {
          fetchedRef.current.delete(id);
        }
      });
      return next;
    });
  }, [records, fetchTrail]);

  // Subscribe to realtime inserts on location_history
  useEffect(() => {
    const channel = supabase
      .channel('location-trail-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_history',
        },
        (payload) => {
          const row = payload.new as any;
          if (!row.tracking_id || row.latitude == null || row.longitude == null) return;

          const newPos: TrailPosition = {
            lat: row.latitude,
            lng: row.longitude,
            accuracy: row.accuracy ?? null,
            time: row.recorded_at || new Date().toISOString(),
          };

          setTrails(prev => {
            const existing = prev[row.tracking_id];
            if (!existing) return prev; // Only update trails we're tracking
            return {
              ...prev,
              [row.tracking_id]: [...existing, newPos],
            };
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return { trails };
}
