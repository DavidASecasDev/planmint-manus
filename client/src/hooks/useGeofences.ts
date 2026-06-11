/**
 * useGeofences — CRUD hook for geofence management.
 * Uses apiInvoke to call the geofence endpoints.
 */
import { useState, useCallback, useEffect } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GeofenceCoordinate {
  lat: number;
  lng: number;
}

export interface Geofence {
  id: string;
  organization_id: string;
  name: string;
  type: 'circle' | 'polygon';
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  coordinates: GeofenceCoordinate[] | null;
  color: string;
  opacity: number;
  is_active: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export function useGeofences() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGeofences = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data } = await apiInvoke<{ ok: boolean; geofences: Geofence[] }>('geofences/list', {
        body: { organization_id: orgId },
      });
      if (data?.ok) {
        setGeofences(data.geofences || []);
      }
    } catch (err) {
      console.error('Error fetching geofences:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const createGeofence = useCallback(async (geofence: Partial<Geofence>): Promise<Geofence | null> => {
    if (!orgId) return null;
    try {
      const { data } = await apiInvoke<{ ok: boolean; geofence: Geofence }>('geofences/create', {
        body: { ...geofence, organization_id: orgId },
      });
      if (data?.ok && data.geofence) {
        setGeofences(prev => [data.geofence, ...prev]);
        toast.success('Geocerca creada correctamente');
        return data.geofence;
      }
      return null;
    } catch (err: any) {
      toast.error(err.message || 'Error al crear geocerca');
      return null;
    }
  }, [orgId]);

  const updateGeofence = useCallback(async (id: string, updates: Partial<Geofence>): Promise<boolean> => {
    if (!orgId) return false;
    try {
      const { data } = await apiInvoke<{ ok: boolean; geofence: Geofence }>('geofences/update', {
        body: { id, ...updates, organization_id: orgId },
      });
      if (data?.ok && data.geofence) {
        setGeofences(prev => prev.map(g => g.id === id ? data.geofence : g));
        toast.success('Geocerca actualizada');
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar geocerca');
      return false;
    }
  }, [orgId]);

  const deleteGeofence = useCallback(async (id: string): Promise<boolean> => {
    if (!orgId) return false;
    try {
      const { data } = await apiInvoke<{ ok: boolean }>('geofences/delete', {
        body: { id, organization_id: orgId },
      });
      if (data?.ok) {
        setGeofences(prev => prev.filter(g => g.id !== id));
        toast.success('Geocerca eliminada');
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar geocerca');
      return false;
    }
  }, [orgId]);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  return {
    geofences,
    loading,
    fetchGeofences,
    createGeofence,
    updateGeofence,
    deleteGeofence,
  };
}
