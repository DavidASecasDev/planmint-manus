import { useState, useEffect, useCallback } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string | null;
  positionId: number | null;
  phone: string | null;
  model: string | null;
  category: string | null;
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
}

export interface TraccarSettings {
  traccar_server_url: string;
  traccar_email: string;
  traccar_password: string;
  has_password: boolean;
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

  // Fetch Traccar settings
  const fetchSettings = useCallback(async () => {
    if (!organizationId) return;
    setSettingsLoading(true);
    try {
      const { data } = await apiInvoke<{ ok: boolean; settings: TraccarSettings | null }>('traccar/settings', {
        body: { organization_id: organizationId, _method: 'GET' },
      });
      if (data?.ok) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Error fetching Traccar settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [organizationId]);

  // Save Traccar settings
  const saveSettings = useCallback(async (
    serverUrl: string,
    email: string,
    password: string
  ): Promise<boolean> => {
    if (!organizationId) return false;
    try {
      const { data } = await apiInvoke<{ ok: boolean; error?: string }>('traccar/settings', {
        body: {
          organization_id: organizationId,
          traccar_server_url: serverUrl,
          traccar_email: email,
          traccar_password: password,
        },
      });
      if (data?.ok) {
        await fetchSettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error saving Traccar settings:', err);
      return false;
    }
  }, [organizationId, fetchSettings]);

  // Test connection
  const testConnection = useCallback(async (
    serverUrl: string,
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!organizationId) return { ok: false, error: 'No organization' };
    try {
      const { data } = await apiInvoke<{ ok: boolean; message?: string; error?: string }>('traccar/test-connection', {
        body: {
          organization_id: organizationId,
          server_url: serverUrl,
          email,
          password,
        },
      });
      return { ok: data?.ok || false, error: data?.error };
    } catch (err) {
      return { ok: false, error: 'Error de conexión' };
    }
  }, [organizationId]);

  // Fetch devices from Traccar
  const fetchDevices = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data } = await apiInvoke<{ ok: boolean; devices: TraccarDevice[] }>('traccar/devices', {
        body: { organization_id: organizationId },
      });
      if (data?.ok) {
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Error fetching Traccar devices:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Fetch all positions
  const fetchPositions = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data } = await apiInvoke<{ ok: boolean; positions: TraccarPosition[] }>('traccar/positions', {
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
      const { data } = await apiInvoke<{ ok: boolean } & VehiclePosition>('traccar/device-position', {
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

  // Fetch position for a vehicle by its plate number (used in delivery operations)
  const fetchVehicleByPlate = useCallback(async (matricula: string): Promise<VehiclePosition | null> => {
    if (!organizationId || !matricula) return null;
    try {
      const { data } = await apiInvoke<{ ok: boolean; vehicle?: any; device?: any; position?: TraccarPosition | null }>('traccar/vehicle-by-plate', {
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

  // Link a Traccar device to a fleet vehicle
  const linkDevice = useCallback(async (
    fleetVehicleId: string,
    traccarDeviceId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!organizationId) return { ok: false, error: 'No organization' };
    try {
      const { data } = await apiInvoke<{ ok: boolean; error?: string }>('traccar/link-device', {
        body: {
          organization_id: organizationId,
          fleet_vehicle_id: fleetVehicleId,
          traccar_device_id: traccarDeviceId,
        },
      });
      return { ok: data?.ok || false, error: data?.error };
    } catch (err) {
      return { ok: false, error: 'Error al vincular' };
    }
  }, [organizationId]);

  // Unlink a Traccar device from a fleet vehicle
  const unlinkDevice = useCallback(async (fleetVehicleId: string): Promise<boolean> => {
    if (!organizationId) return false;
    try {
      const { data } = await apiInvoke<{ ok: boolean }>('traccar/unlink-device', {
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

  const hasTraccar = !!(settings?.traccar_server_url && settings?.traccar_email && settings?.has_password);

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
