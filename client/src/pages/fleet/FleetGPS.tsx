/**
 * GPS Flota — Real-time fleet GPS tracking page
 * Shows ALL vehicles with linked Traccar GPS devices on a Leaflet map
 * with a filterable sidebar list. Auto-refreshes every 30 seconds.
 * 
 * Access: Admin or users with fleet.gps permission only.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTraccar, TraccarDevice, TraccarPosition } from '@/hooks/useTraccar';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin, RefreshCw, Wifi, WifiOff, Navigation, Car, Loader2,
  Search, Satellite, Clock, Gauge, ExternalLink, ChevronLeft, ChevronRight,
  Radio, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──
interface FleetVehicleGPS {
  id: string;
  matricula: string;
  modelo: string | null;
  marca: string | null;
  traccar_device_id: string;
  device?: TraccarDevice;
  position?: TraccarPosition;
}

type FilterStatus = 'all' | 'online' | 'offline';

// ── Map Constants ──
const MALLORCA_CENTER: [number, number] = [39.5696, 2.6502];
const DEFAULT_ZOOM = 11;
const REFRESH_INTERVAL = 30_000; // 30 seconds

// ── Custom Leaflet markers ──
function createVehicleIcon(isOnline: boolean, isSelected: boolean) {
  const color = isOnline ? '#22c55e' : '#6b7280';
  const borderColor = isSelected ? '#c9a96e' : color;
  const size = isSelected ? 36 : 28;
  const borderWidth = isSelected ? 3 : 2;

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        border: ${borderWidth}px solid ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      ">
        <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// ── Map controller component ──
function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, { duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

// ── Main Component ──
export default function FleetGPS() {
  const { hasTraccar, fetchDevices, devices, loading: devicesLoading, fetchPositions, positions } = useTraccar();
  const { vehicles, isLoading: vehiclesLoading } = useFleetVehicles();
  const { isAdmin, hasPermission, isLoading: permissionsLoading } = usePermissions();

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Permission check
  const canAccess = isAdmin || hasPermission('fleet.gps' as any);

  // Load all data
  const loadData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchDevices(), fetchPositions()]);
    setLastUpdate(new Date());
    setRefreshing(false);
  }, [fetchDevices, fetchPositions]);

  // Initial load
  useEffect(() => {
    if (hasTraccar && canAccess) {
      loadData();
    }
  }, [hasTraccar, canAccess, loadData]);

  // Auto-refresh
  useEffect(() => {
    if (!hasTraccar || !canAccess) return;
    refreshTimerRef.current = setInterval(loadData, REFRESH_INTERVAL);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [hasTraccar, canAccess, loadData]);

  // Merge vehicles with their device/position data
  const vehiclesWithGPS = useMemo((): FleetVehicleGPS[] => {
    if (!vehicles.length) return [];

    return vehicles
      .filter(v => v.traccar_device_id)
      .map(v => {
        const device = devices.find(d => String(d.id) === v.traccar_device_id);
        const position = positions.find((p: any) => String(p.deviceId) === v.traccar_device_id);
        return {
          id: v.id,
          matricula: v.matricula,
          modelo: v.modelo,
          marca: v.marca,
          traccar_device_id: v.traccar_device_id!,
          device,
          position: position ? {
            latitude: position.latitude,
            longitude: position.longitude,
            speed: position.speed,
            course: position.course,
            address: position.address,
            deviceTime: position.deviceTime,
            valid: position.valid,
            altitude: position.altitude,
          } : undefined,
        };
      });
  }, [vehicles, devices, positions]);

  // Filtered list
  const filteredVehicles = useMemo(() => {
    let list = vehiclesWithGPS;

    // Filter by status
    if (filter === 'online') {
      list = list.filter(v => v.device?.status === 'online');
    } else if (filter === 'offline') {
      list = list.filter(v => v.device?.status !== 'online');
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(v =>
        v.matricula.toLowerCase().includes(q) ||
        (v.marca && v.marca.toLowerCase().includes(q)) ||
        (v.modelo && v.modelo.toLowerCase().includes(q))
      );
    }

    return list;
  }, [vehiclesWithGPS, filter, search]);

  // Stats
  const onlineCount = vehiclesWithGPS.filter(v => v.device?.status === 'online').length;
  const offlineCount = vehiclesWithGPS.length - onlineCount;
  const totalCount = vehiclesWithGPS.length;

  // Handle vehicle selection
  const handleSelectVehicle = (vehicle: FleetVehicleGPS) => {
    setSelectedVehicleId(vehicle.id);
    if (vehicle.position) {
      setMapCenter([vehicle.position.latitude, vehicle.position.longitude]);
    }
  };

  // Loading state
  if (permissionsLoading) {
    return (
      <AppLayout title="GPS Flota">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!canAccess) {
    return (
      <AppLayout title="GPS Flota">
        <div className="max-w-md mx-auto text-center py-20">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
          <h2 className="text-lg font-semibold mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground text-sm">
            No tienes permisos para acceder a la vista GPS de la flota.
            Contacta con un administrador si necesitas acceso.
          </p>
        </div>
      </AppLayout>
    );
  }

  // Traccar not configured
  if (!hasTraccar) {
    return (
      <AppLayout title="GPS Flota">
        <div className="max-w-md mx-auto text-center py-20">
          <Satellite className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">Traccar no configurado</h2>
          <p className="text-muted-foreground text-sm">
            Configura la integración con Traccar en Ajustes → Integraciones para ver la ubicación de tus vehículos en tiempo real.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="GPS Flota" fullWidth>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden relative">
        {/* ── Sidebar ── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full border-r border-border bg-background flex flex-col shrink-0 overflow-hidden"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Localizadores GPS</h2>
                  <div className="flex items-center gap-1.5">
                    {lastUpdate && (
                      <span className="text-[10px] text-muted-foreground">
                        {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={loadData}
                      disabled={refreshing}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-2">
                  <Badge
                    variant={filter === 'all' ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setFilter('all')}
                  >
                    Todos ({totalCount})
                  </Badge>
                  <Badge
                    variant={filter === 'online' ? 'default' : 'outline'}
                    className={cn("cursor-pointer text-xs", filter === 'online' && "bg-green-600 hover:bg-green-700")}
                    onClick={() => setFilter('online')}
                  >
                    <Wifi className="h-3 w-3 mr-1" />
                    Online ({onlineCount})
                  </Badge>
                  <Badge
                    variant={filter === 'offline' ? 'default' : 'outline'}
                    className={cn("cursor-pointer text-xs", filter === 'offline' && "bg-gray-600 hover:bg-gray-700")}
                    onClick={() => setFilter('offline')}
                  >
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline ({offlineCount})
                  </Badge>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar matrícula..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>

              {/* Vehicle List */}
              <div className="flex-1 overflow-y-auto">
                {devicesLoading || vehiclesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Car className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'Sin resultados para la búsqueda' : 'No hay vehículos con GPS vinculado'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredVehicles.map(vehicle => (
                      <VehicleListItem
                        key={vehicle.id}
                        vehicle={vehicle}
                        isSelected={selectedVehicleId === vehicle.id}
                        onClick={() => handleSelectVehicle(vehicle)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Sidebar Toggle ── */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-3 left-3 z-[1000] bg-background border border-border rounded-lg p-1.5 shadow-md hover:bg-accent transition-colors"
          style={{ left: sidebarOpen ? '372px' : '12px' }}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* ── Map ── */}
        <div className="flex-1 relative">
          <MapContainer
            center={MALLORCA_CENTER}
            zoom={DEFAULT_ZOOM}
            className="h-full w-full z-0"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={mapCenter} />

            {/* Vehicle markers */}
            {filteredVehicles
              .filter(v => v.position && v.position.latitude && v.position.longitude)
              .map(vehicle => {
                const isOnline = vehicle.device?.status === 'online';
                const isSelected = selectedVehicleId === vehicle.id;
                return (
                  <Marker
                    key={vehicle.id}
                    position={[vehicle.position!.latitude, vehicle.position!.longitude]}
                    icon={createVehicleIcon(isOnline, isSelected)}
                    eventHandlers={{
                      click: () => {
                        setSelectedVehicleId(vehicle.id);
                      },
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono font-bold text-sm">{vehicle.matricula}</span>
                          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {isOnline ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ')}
                        </p>
                        {vehicle.position?.address && (
                          <p className="text-xs mb-1">{vehicle.position.address}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {vehicle.position?.speed !== undefined && (
                            <span>
                              <Gauge className="h-3 w-3 inline mr-0.5" />
                              {vehicle.position.speed > 0 ? `${Math.round(vehicle.position.speed * 1.852)} km/h` : 'Detenido'}
                            </span>
                          )}
                          {vehicle.position?.deviceTime && (
                            <span>
                              <Clock className="h-3 w-3 inline mr-0.5" />
                              {new Date(vehicle.position.deviceTime).toLocaleString('es-ES', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 text-xs h-7"
                          onClick={() => {
                            window.open(
                              `https://www.google.com/maps?q=${vehicle.position!.latitude},${vehicle.position!.longitude}`,
                              '_blank'
                            );
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Google Maps
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>

          {/* Auto-refresh indicator */}
          <div className="absolute bottom-4 right-4 z-[1000] bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
            <Radio className={cn("h-3 w-3", refreshing ? "text-primary animate-pulse" : "text-green-500")} />
            <span className="text-[11px] text-muted-foreground">
              Auto-refresh 30s
            </span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Vehicle List Item ──
function VehicleListItem({
  vehicle,
  isSelected,
  onClick,
}: {
  vehicle: FleetVehicleGPS;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isOnline = vehicle.device?.status === 'online';
  const speed = vehicle.position?.speed;
  const speedKmh = speed ? Math.round(speed * 1.852) : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isOnline ? "bg-green-500/10" : "bg-muted"
        )}>
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Vehicle info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold tracking-wider">{vehicle.matricula}</span>
            <Badge
              variant={isOnline ? 'default' : 'secondary'}
              className={cn(
                "text-[10px] px-1.5 py-0",
                isOnline && "bg-green-600"
              )}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || 'Sin modelo'}
          </p>
        </div>

        {/* Speed / status */}
        {vehicle.position && isOnline && (
          <div className="text-right shrink-0">
            <span className={cn(
              "text-xs font-medium",
              speedKmh > 0 ? "text-blue-600" : "text-muted-foreground"
            )}>
              {speedKmh > 0 ? `${speedKmh} km/h` : 'Detenido'}
            </span>
          </div>
        )}
      </div>

      {/* Address line */}
      {vehicle.position?.address && (
        <p className="text-[11px] text-muted-foreground mt-1.5 ml-11 truncate">
          <MapPin className="h-3 w-3 inline mr-0.5 -mt-0.5" />
          {vehicle.position.address}
        </p>
      )}

      {/* Last update time */}
      {vehicle.position?.deviceTime && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 ml-11">
          <Clock className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />
          {new Date(vehicle.position.deviceTime).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
          })}
        </p>
      )}
    </div>
  );
}
