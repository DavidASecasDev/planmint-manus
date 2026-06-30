import { useState, useEffect, useCallback } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface TraccarDevice {
  id: number | string;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string | null;
  positionId: number | string | null;
  phone: string | null;
  model: string | null;
  category: string | null;
  linkedVehicleId?: string | null;
  linkedVehicle?: { matricula: string; marca: string; modelo: string } | null;
}

export interface TraccarPosition {
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address: string;
  deviceTime: string;
  valid: boolean;
  altitude: number;
  batteryLevel?: number;
  attributes?: Record<string, unknown>;
}

export interface TraccarSettings {
  xexun_enabled: boolean;
  xexun_push_secret: string | null;
  webhook_url: string;
  // Keep old fields for backward compat (always empty now)
  traccar_server_url?: string;
  traccar_email?: string;
  traccar_password?: string;
  has_password?: boolean;
}

export interface VehiclePosition {
  vehicle: {
    matricula: string;
    marca: string | null;
    modelo: string | null;
  };
  device: {
    name: string;
    status: string;
    lastUpdate: string;
  } | null;
  position: TraccarPosition | null;
}

export function useTraccar() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [settings, setSettings] = useState<TraccarSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Fetch GPS settings
  const fetchSettings = useCallback(async () => {
    if (!organizationId) return;
    setSettingsLoading(true);
    try {
      const { data } = await apiInvoke<{ ok: boolean; settings: TraccarSettings | null }>('gps/settings', {
        body: { organization_id: organizationId },
      });
      if (data?.ok) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Error fetching GPS settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [organizationId]);

  // Save GPS settings (enable/disable Xexun + push secret)
  const saveSettings = useCallback(async (
    _serverUrl: string,
    _email: string,
    _password: string
  ): Promise<boolean> => {
    if (!organizationId) return false;
    try {
      // For Xexun, we just enable the integration
      const { data } = await apiInvoke<{ ok: boolean; error?: string }>('gps/settings', {
        body: {
          organization_id: organizationId,
          action: 'update',
          xexun_enabled: true,
        },
      });
      if (data?.ok) {
        await fetchSettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error saving GPS settings:', err);
      return false;
    }
  }, [organizationId, fetchSettings]);

  // Test connection
  const testConnection = useCallback(async (
    _serverUrl?: string,
    _email?: string,
    _password?: string
  ): Promise<{ ok: boolean; error?: string; message?: string }> => {
    if (!organizationId) return { ok: false, error: 'No organization' };
    try {
      const { data } = await apiInvoke<{ ok: boolean; connected?: boolean; message?: string; error?: string; deviceCount?: number }>('gps/test-connection', {
        body: { organization_id: organizationId },
      });
      return {
        ok: data?.connected || false,
        error: data?.connected ? undefined : (data?.message || 'GPS no configurado'),
        message: data?.message,
      };
    } catch (err) {
      return { ok: false, error: 'Error de conexión' };
    }
  }, [organizationId]);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data } = await apiInvoke<{ ok: boolean; devices: TraccarDevice[] }>('gps/devices', {
        body: { organization_id: organizationId },
      });
      if (data?.ok) {
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Error fetching GPS devices:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Fetch all positions
  const fetchPositions = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data } = await apiInvoke<{ ok: boolean; positions: TraccarPosition[] }>('gps/positions', {
        body: { organization_id: organizationId },
      });
      if (data?.ok) {
        setPositions(data.positions || []);
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
    }
  }, [organizationId]);

  // Fetch position for a specific fleet vehicle
  const fetchVehiclePosition = useCallback(async (fleetVehicleId: string): Promise<VehiclePosition | null> => {
    if (!organizationId) return null;
    try {
      const { data } = await apiInvoke<{ ok: boolean } & VehiclePosition>('gps/device-position', {
        body: { organization_id: organizationId, fleet_vehicle_id: fleetVehicleId },
      });
      if (data?.ok) {
        return {
          vehicle: data.vehicle,
          device: data.device,
          position: data.position,
        };
      }
      return null;
    } catch (err) {
      console.error('Error fetching vehicle position:', err);
      return null;
    }
  }, [organizationId]);

  // Fetch position for a vehicle by its plate number
  const fetchVehicleByPlate = useCallback(async (matricula: string): Promise<VehiclePosition | null> => {
    if (!organizationId || !matricula) return null;
    try {
      const { data } = await apiInvoke<{ ok: boolean; vehicle?: any; device?: any; position?: TraccarPosition | null }>('gps/vehicle-by-plate', {
        body: { organization_id: organizationId, matricula },
      });
      if (data?.ok && data.position) {
        return {
          vehicle: data.vehicle,
          device: data.device,
          position: data.position,
        };
      }
      return null;
    } catch (err) {
      console.error('Error fetching vehicle by plate:', err);
      return null;
    }
  }, [organizationId]);

  // Link a GPS device (by IMEI) to a fleet vehicle
  const linkDevice = useCallback(async (
    fleetVehicleId: string,
    imei: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!organizationId) return { ok: false, error: 'No organization' };
    try {
      const { data } = await apiInvoke<{ ok: boolean; error?: string }>('gps/link-device', {
        body: {
          organization_id: organizationId,
          fleet_vehicle_id: fleetVehicleId,
          imei,
        },
      });
      return { ok: data?.ok || false, error: data?.error };
    } catch (err) {
      return { ok: false, error: 'Error al vincular' };
    }
  }, [organizationId]);

  // Unlink a GPS device from a fleet vehicle
  const unlinkDevice = useCallback(async (fleetVehicleId: string): Promise<boolean> => {
    if (!organizationId) return false;
    try {
      const { data } = await apiInvoke<{ ok: boolean }>('gps/unlink-device', {
        body: { organization_id: organizationId, fleet_vehicle_id: fleetVehicleId },
      });
      return data?.ok || false;
    } catch (err) {
      return false;
    }
  }, [organizationId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // hasTraccar is now based on xexun_enabled
  const hasTraccar = !!(settings?.xexun_enabled);

  return {
    // Settings
    settings,
    settingsLoading,
    hasTraccar,
    fetchSettings,
    saveSettings,
    testConnection,
    // Devices
    devices,
    loading,
    fetchDevices,
    // Positions
    positions,
    fetchPositions,
    fetchVehiclePosition,
    fetchVehicleByPlate,
    // Linking
    linkDevice,
    unlinkDevice,
  };
}
