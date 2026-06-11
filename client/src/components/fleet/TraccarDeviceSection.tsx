import { useState, useEffect } from 'react';
import { useTraccar, TraccarDevice } from '@/hooks/useTraccar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Wifi, WifiOff, Link2, Unlink, Loader2, RefreshCw, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface TraccarDeviceSectionProps {
  fleetVehicleId: string;
  currentTraccarDeviceId?: string | null;
  onDeviceLinked?: () => void;
}

export function TraccarDeviceSection({ fleetVehicleId, currentTraccarDeviceId, onDeviceLinked }: TraccarDeviceSectionProps) {
  const { hasTraccar, devices, loading, fetchDevices, linkDevice, unlinkDevice, fetchVehiclePosition } = useTraccar();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number; address: string; speed: number; deviceTime: string } | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [loadingPosition, setLoadingPosition] = useState(false);

  useEffect(() => {
    if (hasTraccar && !currentTraccarDeviceId) {
      fetchDevices();
    }
  }, [hasTraccar, currentTraccarDeviceId, fetchDevices]);

  useEffect(() => {
    if (hasTraccar && currentTraccarDeviceId) {
      loadPosition();
    }
  }, [hasTraccar, currentTraccarDeviceId]);

  const loadPosition = async () => {
    setLoadingPosition(true);
    const result = await fetchVehiclePosition(fleetVehicleId);
    if (result) {
      setPosition(result.position);
      setDeviceStatus(result.device?.status || null);
    }
    setLoadingPosition(false);
  };

  const handleLink = async () => {
    if (!selectedDeviceId) {
      toast.error('Selecciona un dispositivo');
      return;
    }
    setLinking(true);
    const result = await linkDevice(fleetVehicleId, selectedDeviceId);
    setLinking(false);
    if (result.ok) {
      toast.success('Localizador vinculado correctamente');
      onDeviceLinked?.();
    } else {
      toast.error(result.error || 'Error al vincular');
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    const success = await unlinkDevice(fleetVehicleId);
    setUnlinking(false);
    if (success) {
      toast.success('Localizador desvinculado');
      setPosition(null);
      setDeviceStatus(null);
      onDeviceLinked?.();
    } else {
      toast.error('Error al desvincular');
    }
  };

  if (!hasTraccar) {
    return null; // Don't show if Traccar is not configured
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl bg-card border border-border/50 shadow-sm p-4"
    >
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5" />
        Localizador GPS
      </h3>

      {currentTraccarDeviceId ? (
        // Device is linked - show status and position
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {deviceStatus === 'online' ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <Badge variant={deviceStatus === 'online' ? 'default' : 'secondary'} className="text-xs">
                {deviceStatus === 'online' ? 'En línea' : deviceStatus === 'offline' ? 'Desconectado' : 'Desconocido'}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadPosition} disabled={loadingPosition}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingPosition ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleUnlink} disabled={unlinking}>
                {unlinking ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                Desvincular
              </Button>
            </div>
          </div>

          {loadingPosition ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : position ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Navigation className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-foreground font-medium">{position.address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {position.speed > 0 ? `${Math.round(position.speed * 1.852)} km/h` : 'Detenido'}
                    {position.deviceTime && ` · ${new Date(position.deviceTime).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => window.open(`https://www.google.com/maps?q=${position.latitude},${position.longitude}`, '_blank')}
              >
                <MapPin className="h-3.5 w-3.5 mr-1" />
                Ver en Google Maps
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Sin posición disponible</p>
          )}
        </div>
      ) : (
        // No device linked - show selector
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Vincula un localizador GPS de Traccar a este vehículo</p>
          
          <div className="flex gap-2">
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={loading ? 'Cargando...' : 'Seleccionar dispositivo'} />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={String(device.id)}>
                    <div className="flex items-center gap-2">
                      {device.status === 'online' ? (
                        <Wifi className="h-3 w-3 text-green-500" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>{device.name}</span>
                      <span className="text-xs text-muted-foreground">({device.uniqueId})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLink} disabled={linking || !selectedDeviceId} size="sm">
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            </Button>
          </div>

          {devices.length === 0 && !loading && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">No se encontraron dispositivos</p>
              <Button variant="ghost" size="sm" onClick={fetchDevices} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Recargar
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
