import { useState, useEffect } from 'react';
import { useTraccar } from '@/hooks/useTraccar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Wifi, WifiOff, Link2, Unlink, Loader2, RefreshCw, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface TraccarDeviceSectionProps {
  fleetVehicleId: string;
  currentTraccarDeviceId?: string | null;
  currentXexunImei?: string | null;
  onDeviceLinked?: () => void;
}

export function TraccarDeviceSection({ fleetVehicleId, currentTraccarDeviceId, currentXexunImei, onDeviceLinked }: TraccarDeviceSectionProps) {
  const { hasTraccar, linkDevice, unlinkDevice, fetchVehiclePosition } = useTraccar();
  const [imeiInput, setImeiInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number; address: string; speed: number; deviceTime: string } | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [loadingPosition, setLoadingPosition] = useState(false);

  const linkedImei = currentXexunImei || currentTraccarDeviceId;

  useEffect(() => {
    if (hasTraccar && linkedImei) {
      loadPosition();
    }
  }, [hasTraccar, linkedImei]);

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
    const trimmed = imeiInput.trim();
    if (!trimmed) {
      toast.error('Introduce el IMEI del dispositivo');
      return;
    }
    if (!/^\d{10,20}$/.test(trimmed)) {
      toast.error('El IMEI debe ser un número de 10-20 dígitos');
      return;
    }
    setLinking(true);
    const result = await linkDevice(fleetVehicleId, trimmed);
    setLinking(false);
    if (result.ok) {
      toast.success('Localizador GPS vinculado correctamente');
      setImeiInput('');
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
      toast.success('Localizador GPS desvinculado');
      setPosition(null);
      setDeviceStatus(null);
      onDeviceLinked?.();
    } else {
      toast.error('Error al desvincular');
    }
  };

  if (!hasTraccar) {
    return null;
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

      {linkedImei ? (
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
              <span className="text-xs text-muted-foreground font-mono">IMEI: {linkedImei}</span>
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
                    {position.speed > 0 ? `${Math.round(position.speed)} km/h` : 'Detenido'}
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
            <p className="text-sm text-muted-foreground text-center py-2">Sin posición disponible. El dispositivo aún no ha enviado datos.</p>
          )}
        </div>
      ) : (
        // No device linked - show IMEI input
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Vincula un localizador GPS Xexun X24 a este vehículo introduciendo su IMEI</p>
          
          <div className="flex gap-2">
            <Input
              placeholder="IMEI del dispositivo (ej: 861045082965297)"
              value={imeiInput}
              onChange={(e) => setImeiInput(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleLink} disabled={linking || !imeiInput.trim()} size="sm">
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            El IMEI se encuentra en la etiqueta del dispositivo o en tracker.xexun.com → Gestión de terminales.
          </p>
        </div>
      )}
    </motion.div>
  );
}
