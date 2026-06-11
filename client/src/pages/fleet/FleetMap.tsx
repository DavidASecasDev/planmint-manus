import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTraccar, TraccarDevice, TraccarPosition } from '@/hooks/useTraccar';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, RefreshCw, Wifi, WifiOff, Navigation, Car, Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

interface FleetVehicleWithPosition {
  id: string;
  matricula: string;
  modelo: string | null;
  marca: string | null;
  traccar_device_id: string | null;
  device?: TraccarDevice;
  position?: TraccarPosition;
}

export default function FleetMap() {
  const { hasTraccar, fetchDevices, devices, loading: devicesLoading } = useTraccar();
  const { vehicles } = useFleetVehicles();
  const [vehiclesWithPositions, setVehiclesWithPositions] = useState<FleetVehicleWithPosition[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { fetchPositions: fetchAllPositions } = useTraccar();

  const loadData = useCallback(async () => {
    setLoadingPositions(true);
    await fetchDevices();
    setLoadingPositions(false);
    setLastUpdate(new Date());
  }, [fetchDevices]);

  useEffect(() => {
    if (hasTraccar) {
      loadData();
    }
  }, [hasTraccar, loadData]);

  // Merge vehicles with their device/position data
  useEffect(() => {
    if (!vehicles.length) return;

    const traccarVehicles = vehicles
      .filter(v => v.traccar_device_id)
      .map(v => {
        const device = devices.find(d => String(d.id) === v.traccar_device_id);
        return {
          id: v.id,
          matricula: v.matricula,
          modelo: v.modelo,
          marca: v.marca,
          traccar_device_id: v.traccar_device_id,
          device,
        } as FleetVehicleWithPosition;
      });

    setVehiclesWithPositions(traccarVehicles);
  }, [vehicles, devices]);

  const onlineCount = vehiclesWithPositions.filter(v => v.device?.status === 'online').length;
  const totalTracked = vehiclesWithPositions.length;

  if (!hasTraccar) {
    return (
      <AppLayout title="Mapa de Flota">
        <div className="max-w-2xl mx-auto text-center py-20">
          <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">Traccar no configurado</h2>
          <p className="text-muted-foreground text-sm">
            Configura la integración con Traccar en Ajustes → Integraciones para ver la ubicación de tus vehículos en tiempo real.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mapa de Flota">
      <div className="max-w-4xl mx-auto space-y-4 pb-8">
        {/* Header Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              <Wifi className="h-3 w-3 mr-1 text-green-500" />
              {onlineCount} en línea
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {totalTracked} con GPS
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                Actualizado {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={loadData} disabled={loadingPositions}>
              <RefreshCw className={`h-4 w-4 ${loadingPositions ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </motion.div>

        {/* Vehicle List */}
        {devicesLoading || loadingPositions ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : vehiclesWithPositions.length === 0 ? (
          <div className="text-center py-16">
            <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-sm font-medium mb-1">Sin vehículos con GPS</h3>
            <p className="text-xs text-muted-foreground">
              Vincula un localizador Traccar a tus vehículos desde la ficha de cada vehículo en Flota.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {vehiclesWithPositions.map((v, idx) => (
              <VehiclePositionCard key={v.id} vehicle={v} delay={idx * 0.03} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function VehiclePositionCard({ vehicle, delay }: { vehicle: FleetVehicleWithPosition; delay: number }) {
  const { fetchVehiclePosition } = useTraccar();
  const [position, setPosition] = useState<TraccarPosition | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(vehicle.device?.status || null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadPosition = async () => {
    setLoading(true);
    const result = await fetchVehiclePosition(vehicle.id);
    if (result) {
      setPosition(result.position);
      setDeviceStatus(result.device?.status || null);
    }
    setLoading(false);
  };

  const handleExpand = () => {
    if (!expanded && !position) {
      loadPosition();
    }
    setExpanded(!expanded);
  };

  const isOnline = deviceStatus === 'online' || vehicle.device?.status === 'online';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${expanded ? 'ring-1 ring-primary/20' : ''}`}
        onClick={handleExpand}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOnline ? 'bg-green-500/10' : 'bg-muted/60'
            }`}>
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold tracking-wider">{vehicle.matricula}</span>
                <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || 'Sin modelo'}
                {vehicle.device && ` · ${vehicle.device.name}`}
              </p>
            </div>
            <Navigation className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
          </div>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 pt-3 border-t border-border/50"
            >
              {loading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : position ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        {position.address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {position.speed > 0 ? `${Math.round(position.speed * 1.852)} km/h` : 'Detenido'}
                        {position.deviceTime && ` · ${new Date(position.deviceTime).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.google.com/maps?q=${position.latitude},${position.longitude}`, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver en Google Maps
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Sin posición disponible</p>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
