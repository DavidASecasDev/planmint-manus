/**
 * VehicleGPSLocation — Shows the GPS position of a vehicle from Traccar
 * Used in the reservation detail sheet (vehiculo tab) to show where the car is.
 */
import { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw, Navigation, Wifi, WifiOff, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TraccarPositionData {
  vehicle: {
    fleet_vehicle_id?: string;
    matricula: string;
    marca: string | null;
    modelo: string | null;
  };
  device: {
    name: string;
    status: string;
    lastUpdate: string;
  } | null;
  position: {
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    address: string;
    deviceTime: string;
    valid: boolean;
    altitude: number;
  } | null;
}

interface VehicleGPSLocationProps {
  matricula: string | null;
  className?: string;
}

export function VehicleGPSLocation({ matricula, className }: VehicleGPSLocationProps) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const [data, setData] = useState<TraccarPositionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosition = useCallback(async () => {
    if (!organizationId || !matricula) return;
    setLoading(true);
    setError(null);
    try {
      const { data: resp } = await apiInvoke<{ ok: boolean; vehicle?: any; device?: any; position?: any; message?: string; error?: string }>('traccar/vehicle-by-plate', {
        body: { organization_id: organizationId, matricula },
      });
      if (resp?.ok) {
        if (resp.position) {
          setData({
            vehicle: resp.vehicle,
            device: resp.device,
            position: resp.position,
          });
        } else {
          setError(resp.message || 'Sin datos de posición');
          setData(null);
        }
      } else {
        setError(resp?.error || 'Error al obtener posición');
        setData(null);
      }
    } catch (err) {
      setError('Error de conexión');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, matricula]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  if (!matricula) return null;

  // No data yet and loading
  if (loading && !data) {
    return (
      <div className={cn("bg-muted/30 rounded-lg p-3", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Buscando localización GPS...</span>
        </div>
      </div>
    );
  }

  // Error or no tracker linked
  if (error && !data) {
    return (
      <div className={cn("bg-muted/30 rounded-lg p-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPosition} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !data.position) return null;

  const { position, device } = data;
  const isOnline = device?.status === 'online';
  const lastUpdateTime = position.deviceTime ? new Date(position.deviceTime) : null;
  const speedKmh = Math.round(position.speed * 1.852); // knots to km/h

  return (
    <div className={cn("bg-muted/30 rounded-lg p-3 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Localización GPS</span>
          <Badge variant="outline" className={cn(
            "text-[10px] px-1.5 py-0",
            isOnline ? "border-green-500 text-green-600" : "border-amber-500 text-amber-600"
          )}>
            {isOnline ? <Wifi className="h-2.5 w-2.5 mr-0.5" /> : <WifiOff className="h-2.5 w-2.5 mr-0.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchPosition} disabled={loading} className="h-7 w-7 p-0">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Position info */}
      <div className="space-y-1.5">
        {position.address && (
          <p className="text-xs text-muted-foreground">{position.address}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {speedKmh > 0 && (
            <span className="flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              {speedKmh} km/h
            </span>
          )}
          {lastUpdateTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(lastUpdateTime, { addSuffix: true, locale: es })}
            </span>
          )}
        </div>
      </div>

      {/* Action: Open in Google Maps */}
      <a
        href={`https://www.google.com/maps?q=${position.latitude},${position.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        <MapPin className="h-3 w-3" />
        Ver en Google Maps
      </a>
    </div>
  );
}
