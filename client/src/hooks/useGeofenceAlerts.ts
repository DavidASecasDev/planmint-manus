/**
 * useGeofenceAlerts — Hook to fetch geofence alert history from Supabase.
 * Shows recent enter/exit events for the organization's geofences.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';

export interface GeofenceAlert {
  id: string;
  organization_id: string;
  geofence_id: string;
  geofence_name: string | null;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  device_id: string | null;
  event_type: 'enter' | 'exit';
  latitude: number;
  longitude: number;
  speed: number | null;
  triggered_at: string;
  notified: boolean;
  created_at: string;
}

export function useGeofenceAlerts() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseQuery
        .from('geofence_alerts')
        .select('*')
        .eq('organization_id', orgId)
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setAlerts(data as GeofenceAlert[]);
      }
    } catch (err) {
      console.error('Error fetching geofence alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    fetchAlerts,
  };
}
