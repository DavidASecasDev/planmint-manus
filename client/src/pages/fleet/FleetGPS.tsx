/**
 * GPS Flota v3 — Premium fleet GPS tracking with Leaflet + OpenStreetMap + Geofences
 * 
 * Features:
 * - Leaflet with OpenStreetMap tiles (same style as Traccar/FindCarGPS)
 * - Premium glassmorphism sidebar with vehicle list
 * - Geofence management (create/edit/delete circles & polygons) via leaflet-draw
 * - Real-time vehicle tracking with auto-refresh + animated markers
 * - Vehicle detail panel on selection
 * - Permission-gated access (fleet.gps)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Circle as LCircle, Polygon as LPolygon, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTraccar, TraccarDevice, TraccarPosition } from '@/hooks/useTraccar';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { usePermissions } from '@/hooks/usePermissions';
import { useGeofences, Geofence, GeofenceCoordinate } from '@/hooks/useGeofences';
import { useGeofenceAlerts, GeofenceAlert } from '@/hooks/useGeofenceAlerts';
import { AnimatedMarker } from '@/components/map/AnimatedMarker';
import { VehicleDetailPanel } from '@/components/fleet/VehicleDetailPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MapPin, RefreshCw, Wifi, WifiOff, Navigation, Car, Loader2,
  Search, Satellite, Clock, Gauge, ChevronLeft, ChevronRight,
  Radio, ShieldAlert, Plus, Trash2, Edit2, Eye, EyeOff,
  Pentagon, Circle, AlertTriangle, X, Settings2, Layers, Crosshair
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Types ──
interface FleetVehicleGPS {
  id: string;
  matricula: string;
  modelo: string | null;
  marca: string | null;
  color: string | null;
  combustible: string | null;
  photo_url: string | null;
  traccar_device_id: string;
  device?: TraccarDevice;
  position?: TraccarPosition;
}

type FilterStatus = 'all' | 'online' | 'offline';
type SidebarTab = 'vehicles' | 'geofences' | 'alerts';

// ── Constants ──
const MALLORCA_CENTER: [number, number] = [39.5696, 2.6502];
const DEFAULT_ZOOM = 11;
const REFRESH_INTERVAL = 10_000; // 10s auto-refresh for near real-time tracking

// ── Vehicle marker icon builder ──
function createVehicleIcon(isOnline: boolean, isSelected: boolean, course: number = 0, isFollowing: boolean = false): L.DivIcon {
  const color = isFollowing ? '#2563eb' : isOnline ? '#22c55e' : '#94a3b8';
  const borderColor = isFollowing ? '#60a5fa' : isSelected ? '#c9a96e' : 'white';
  const size = isFollowing ? 46 : isSelected ? 44 : 36;
  const shadowSize = isFollowing ? 58 : isSelected ? 52 : 44;
  const rotation = course || 0;

  // Pulsing ring for followed vehicle
  const pulseRing = isFollowing
    ? `<div style="position:absolute;inset:0;border-radius:50%;border:3px solid #3b82f6;animation:follow-pulse 1.5s ease-out infinite;"></div>
       <div style="position:absolute;inset:4px;border-radius:50%;border:2px solid #60a5fa;opacity:0.5;animation:follow-pulse 1.5s ease-out infinite 0.3s;"></div>`
    : '';

  const bgPulse = isFollowing
    ? 'animation:follow-glow 2s ease-in-out infinite;'
    : (isOnline && isSelected ? 'animation:pulse 2s infinite;' : '');

  const svg = `<div style="position:relative;width:${shadowSize}px;height:${shadowSize}px;display:flex;align-items:center;justify-content:center">
    ${pulseRing}
    <div style="position:absolute;inset:${(shadowSize - size) / 2}px;background:${color};opacity:0.15;border-radius:50%;${bgPulse}"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="filter:drop-shadow(0 2px 6px rgba(37,99,235,${isFollowing ? '0.5' : '0.3'}))">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="${borderColor}" stroke-width="3"/>
      <g transform="rotate(${rotation} ${size/2} ${size/2})">
        <path d="M${size/2} ${size*0.22} L${size*0.68} ${size*0.68} L${size/2} ${size*0.58} L${size*0.32} ${size*0.68} Z" fill="white" opacity="0.9"/>
      </g>
    </svg>
  </div>`;

  return L.divIcon({
    className: `fleet-vehicle-marker${isFollowing ? ' fleet-marker-following' : ''}`,
    html: svg,
    iconSize: [shadowSize, shadowSize],
    iconAnchor: [shadowSize / 2, shadowSize / 2],
    popupAnchor: [0, -(shadowSize / 2)],
  });
}

// ── Drawing control component ──
function DrawingControl({
  drawingMode,
  color,
  onCircleComplete,
  onPolygonComplete,
}: {
  drawingMode: 'circle' | 'polygon' | null;
  color: string;
  onCircleComplete: (center: [number, number], radius: number) => void;
  onPolygonComplete: (coords: GeofenceCoordinate[]) => void;
}) {
  const map = useMap();
  const drawControlRef = useRef<any>(null);

  useEffect(() => {
    if (!drawingMode) {
      // Remove any existing draw control
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      return;
    }

    // Create a feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Start drawing immediately based on mode
    let handler: any;
    if (drawingMode === 'circle') {
      handler = new (L.Draw as any).Circle(map, {
        shapeOptions: {
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
        },
      });
    } else {
      handler = new (L.Draw as any).Polygon(map, {
        shapeOptions: {
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
        },
        allowIntersection: false,
        showArea: true,
      });
    }

    handler.enable();

    // Listen for draw:created event
    const onCreated = (e: any) => {
      const layer = e.layer;
      if (drawingMode === 'circle') {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        onCircleComplete([center.lat, center.lng], radius);
      } else {
        const latlngs = layer.getLatLngs()[0];
        const coords: GeofenceCoordinate[] = latlngs.map((ll: any) => ({
          lat: ll.lat,
          lng: ll.lng,
        }));
        onPolygonComplete(coords);
      }
      // Remove the drawn layer (we'll render it via React)
      map.removeLayer(layer);
    };

    map.on(L.Draw.Event.CREATED, onCreated);

    return () => {
      handler.disable();
      map.off(L.Draw.Event.CREATED, onCreated);
      map.removeLayer(drawnItems);
    };
  }, [drawingMode, color, map, onCircleComplete, onPolygonComplete]);

  return null;
}

// ── Map controller for programmatic pan/zoom ──
function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

// ── Main Component ──
export default function FleetGPS() {
  const { hasTraccar, settingsLoading: gpsSettingsLoading, fetchDevices, devices, loading: devicesLoading, fetchPositions, positions } = useTraccar();
  const { vehicles, isLoading: vehiclesLoading } = useFleetVehicles();
  const { isAdmin, hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { geofences, loading: geofencesLoading, createGeofence, updateGeofence, deleteGeofence, fetchGeofences } = useGeofences();
  const { alerts: geofenceAlerts, loading: alertsLoading, fetchAlerts: fetchGeofenceAlerts } = useGeofenceAlerts();

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('vehicles');
  const [showGeofences, setShowGeofences] = useState(true);
  const [drawingMode, setDrawingMode] = useState<'circle' | 'polygon' | null>(null);
  const [geofenceDialogOpen, setGeofenceDialogOpen] = useState(false);
  const [newGeofenceName, setNewGeofenceName] = useState('');
  const [newGeofenceColor, setNewGeofenceColor] = useState('#3B82F6');
  const [newGeofenceAlertEnter, setNewGeofenceAlertEnter] = useState(true);
  const [newGeofenceAlertExit, setNewGeofenceAlertExit] = useState(false);
  const [pendingGeofenceData, setPendingGeofenceData] = useState<any>(null);
  const [mapTarget, setMapTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [routePositions, setRoutePositions] = useState<Array<{ lat: number; lng: number; speed: number; course: number; address: string | null; time: string; altitude: number }>>([]);
  const [routePlaybackIndex, setRoutePlaybackIndex] = useState<number>(-1);
  const [followingVehicleId, setFollowingVehicleId] = useState<string | null>(null);

  // Overspeed alert state
  const [speedThreshold, setSpeedThreshold] = useState<number>(() => {
    try { return Number(localStorage.getItem('gps_speed_threshold')) || 120; } catch { return 120; }
  });
  const [overspeedAlerts, setOverspeedAlerts] = useState<Array<{
    id: string;
    vehicleId: string;
    matricula: string;
    speed: number;
    threshold: number;
    lat: number;
    lng: number;
    timestamp: Date;
  }>>([]);
  const [showOverspeedBanner, setShowOverspeedBanner] = useState(false);
  const [currentOverspeedVehicle, setCurrentOverspeedVehicle] = useState<string | null>(null);
  const lastOverspeedAlertRef = useRef<string | null>(null);

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
      .filter(v => v.xexun_imei || v.traccar_device_id)
      .map(v => {
        const deviceId = v.xexun_imei || v.traccar_device_id;
        const device = devices.find(d => String(d.uniqueId) === deviceId || String(d.id) === deviceId);
        const position = positions.find((p: any) => String(p.deviceId) === deviceId || String(p.imei) === deviceId);
        return {
          id: v.id,
          matricula: v.matricula,
          modelo: v.modelo,
          marca: v.marca,
          color: v.color,
          combustible: v.combustible,
          photo_url: v.photo_url,
          traccar_device_id: deviceId!,
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
            batteryLevel: (position as any).batteryLevel ?? (position as any).attributes?.batteryLevel ?? (position as any).battery_level ?? undefined,
            attributes: (position as any).attributes || {},
          } : undefined,
        };
      });
  }, [vehicles, devices, positions]);

  // Filtered list
  const filteredVehicles = useMemo(() => {
    let list = vehiclesWithGPS;
    if (filter === 'online') {
      list = list.filter(v => v.device?.status === 'online');
    } else if (filter === 'offline') {
      list = list.filter(v => v.device?.status !== 'online');
    }
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

  // Selected vehicle
  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehiclesWithGPS.find(v => v.id === selectedVehicleId) || null;
  }, [selectedVehicleId, vehiclesWithGPS]);

  // Follow vehicle effect - keep map centered at street level
  useEffect(() => {
    if (!followingVehicleId) return;
    const vehicle = vehiclesWithGPS.find(v => v.id === followingVehicleId);
    if (vehicle?.position) {
      setMapTarget({ center: [vehicle.position.latitude, vehicle.position.longitude], zoom: 17 });
    }
  }, [followingVehicleId, vehiclesWithGPS]);

  // Overspeed detection — check ALL vehicles on every data refresh
  useEffect(() => {
    if (!vehiclesWithGPS.length) return;
    vehiclesWithGPS.forEach(vehicle => {
      if (!vehicle.position || vehicle.device?.status !== 'online') return;
      const speedKmh = Math.round(vehicle.position.speed * 1.852);
      if (speedKmh > speedThreshold) {
        const alertKey = `${vehicle.id}-${Math.floor(Date.now() / 30000)}`; // Deduplicate within 30s windows
        if (alertKey === lastOverspeedAlertRef.current) return;
        lastOverspeedAlertRef.current = alertKey;

        const newAlert = {
          id: `overspeed-${vehicle.id}-${Date.now()}`,
          vehicleId: vehicle.id,
          matricula: vehicle.matricula,
          speed: speedKmh,
          threshold: speedThreshold,
          lat: vehicle.position.latitude,
          lng: vehicle.position.longitude,
          timestamp: new Date(),
        };

        setOverspeedAlerts(prev => [newAlert, ...prev].slice(0, 50));
        setShowOverspeedBanner(true);
        setCurrentOverspeedVehicle(vehicle.id);

        // Toast notification
        toast.error(
          `${vehicle.matricula} a ${speedKmh} km/h`,
          { description: `Excede el l\u00edmite de ${speedThreshold} km/h`, duration: 6000 }
        );

        // Auto-hide banner after 8s
        setTimeout(() => {
          setShowOverspeedBanner(false);
          setCurrentOverspeedVehicle(null);
        }, 8000);
      }
    });
  }, [vehiclesWithGPS, speedThreshold]);

  // Persist speed threshold to localStorage
  useEffect(() => {
    try { localStorage.setItem('gps_speed_threshold', String(speedThreshold)); } catch {}
  }, [speedThreshold]);

  // Handle vehicle selection — pan map + open detail panel
  const handleSelectVehicle = (vehicle: FleetVehicleGPS) => {
    setSelectedVehicleId(vehicle.id);
    setDetailPanelOpen(true);
    if (vehicle.position) {
      setMapTarget({ center: [vehicle.position.latitude, vehicle.position.longitude], zoom: 15 });
    }
  };

  // Close detail panel
  const handleCloseDetail = () => {
    setDetailPanelOpen(false);
    setSelectedVehicleId(null);
    setRoutePositions([]);
    setRoutePlaybackIndex(-1);
    setFollowingVehicleId(null);
  };

  // Follow vehicle — keep map centered on it
  const handleFollowVehicle = (vehicleId: string) => {
    setFollowingVehicleId(prev => prev === vehicleId ? null : vehicleId);
    toast.success(followingVehicleId === vehicleId ? 'Dejando de seguir' : 'Siguiendo vehículo');
  };

  // Route loaded callback
  const handleRouteLoaded = useCallback((positions: Array<{ lat: number; lng: number; speed: number; course: number; address: string | null; time: string; altitude: number }>) => {
    setRoutePositions(positions);
    setRoutePlaybackIndex(positions.length - 1);
  }, []);

  // Route playback update
  const handleRoutePlaybackUpdate = useCallback((index: number) => {
    setRoutePlaybackIndex(index);
  }, []);

  // Route clear
  const handleRouteClear = useCallback(() => {
    setRoutePositions([]);
    setRoutePlaybackIndex(-1);
  }, []);

  // Handle geofence drawing complete
  const handleCircleComplete = useCallback((center: [number, number], radius: number) => {
    setPendingGeofenceData({
      type: 'circle',
      center_lat: center[0],
      center_lng: center[1],
      radius_meters: radius,
    });
    setGeofenceDialogOpen(true);
    setDrawingMode(null);
  }, []);

  const handlePolygonComplete = useCallback((coords: GeofenceCoordinate[]) => {
    setPendingGeofenceData({ type: 'polygon', coordinates: coords });
    setGeofenceDialogOpen(true);
    setDrawingMode(null);
  }, []);

  // Save new geofence
  const handleSaveGeofence = async () => {
    if (!newGeofenceName.trim()) {
      toast.error('Introduce un nombre para la geocerca');
      return;
    }
    if (!pendingGeofenceData) return;

    await createGeofence({
      name: newGeofenceName,
      ...pendingGeofenceData,
      color: newGeofenceColor,
      opacity: 0.2,
      is_active: true,
      alert_on_enter: newGeofenceAlertEnter,
      alert_on_exit: newGeofenceAlertExit,
    });

    // Reset
    setGeofenceDialogOpen(false);
    setNewGeofenceName('');
    setNewGeofenceColor('#3B82F6');
    setNewGeofenceAlertEnter(true);
    setNewGeofenceAlertExit(false);
    setPendingGeofenceData(null);
  };

  // Focus on geofence
  const handleFocusGeofence = (geofence: Geofence) => {
    if (geofence.type === 'circle' && geofence.center_lat && geofence.center_lng) {
      setMapTarget({ center: [geofence.center_lat, geofence.center_lng], zoom: 14 });
    } else if (geofence.coordinates && geofence.coordinates.length > 0) {
      const bounds = L.latLngBounds(geofence.coordinates.map(c => [c.lat, c.lng] as [number, number]));
      const center = bounds.getCenter();
      setMapTarget({ center: [center.lat, center.lng], zoom: 14 });
    }
  };

  // ── Loading states ──
  if (permissionsLoading || gpsSettingsLoading) {
    return (
      <AppLayout title="GPS Flota">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!canAccess) {
    return (
      <AppLayout title="GPS Flota">
        <div className="max-w-md mx-auto text-center py-20">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
          <h2 className="text-lg font-semibold mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground text-sm">
            No tienes permisos para acceder a la vista GPS de la flota.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!hasTraccar) {
    return (
      <AppLayout title="GPS Flota">
        <div className="max-w-md mx-auto text-center py-20">
          <Satellite className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">GPS no configurado</h2>
          <p className="text-muted-foreground text-sm">
            La integración GPS no está activa. Ve a Ajustes → Integraciones y activa "GPS Tracking - Xexun" para ver la ubicación de tus vehículos en tiempo real.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="GPS Flota" fullWidth>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden relative -m-4 md:-m-6 lg:-m-8">
        {/* ── Sidebar ── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="h-full bg-white/95 backdrop-blur-xl border-r border-border/50 flex flex-col shrink-0 overflow-hidden shadow-xl z-10"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-border/30">
                {/* Tab switcher */}
                <div className="flex gap-1 p-1 bg-muted/50 rounded-lg mb-3">
                  <button
                    onClick={() => setSidebarTab('vehicles')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      sidebarTab === 'vehicles'
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Car className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Vehículos
                  </button>
                  <button
                    onClick={() => setSidebarTab('geofences')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      sidebarTab === 'geofences'
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Pentagon className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Geocercas
                  </button>
                  <button
                    onClick={() => setSidebarTab('alerts')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all relative",
                      sidebarTab === 'alerts'
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Alertas
                    {(geofenceAlerts.length + overspeedAlerts.length) > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {(geofenceAlerts.length + overspeedAlerts.length) > 9 ? '9+' : (geofenceAlerts.length + overspeedAlerts.length)}
                      </span>
                    )}
                  </button>
                </div>

                {sidebarTab === 'vehicles' && (
                  <>
                    {/* Status header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando...'}
                        </span>
                      </div>
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

                    {/* Filter chips */}
                    <div className="flex gap-1.5 mb-3">
                      {[
                        { key: 'all' as FilterStatus, label: 'Todos', count: totalCount },
                        { key: 'online' as FilterStatus, label: 'Online', count: onlineCount },
                        { key: 'offline' as FilterStatus, label: 'Offline', count: offlineCount },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setFilter(f.key)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all",
                            filter === f.key
                              ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {f.label} ({f.count})
                        </button>
                      ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar matrícula, marca o modelo..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-muted/30 border-0 focus-visible:ring-1"
                      />
                    </div>
                  </>
                )}

                {sidebarTab === 'geofences' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="show-geofences"
                          checked={showGeofences}
                          onCheckedChange={setShowGeofences}
                        />
                        <Label htmlFor="show-geofences" className="text-xs">Mostrar en mapa</Label>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={drawingMode === 'circle' ? 'default' : 'outline'}
                        className="h-8 text-xs gap-1.5 flex-1"
                        onClick={() => setDrawingMode(drawingMode === 'circle' ? null : 'circle')}
                      >
                        <Circle className="h-3.5 w-3.5" />
                        Círculo
                      </Button>
                      <Button
                        size="sm"
                        variant={drawingMode === 'polygon' ? 'default' : 'outline'}
                        className="h-8 text-xs gap-1.5 flex-1"
                        onClick={() => setDrawingMode(drawingMode === 'polygon' ? null : 'polygon')}
                      >
                        <Pentagon className="h-3.5 w-3.5" />
                        Polígono
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {sidebarTab === 'vehicles' && (
                  <>
                    {devicesLoading || vehiclesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredVehicles.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <Car className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">
                          {search ? 'Sin resultados' : 'No hay vehículos con GPS'}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredVehicles.map(vehicle => (
                          <VehicleCard
                            key={vehicle.id}
                            vehicle={vehicle}
                            isSelected={selectedVehicleId === vehicle.id}
                            isFollowing={followingVehicleId === vehicle.id}
                            onClick={() => handleSelectVehicle(vehicle)}
                            onFollow={(e) => { e.stopPropagation(); handleFollowVehicle(vehicle.id); }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {sidebarTab === 'geofences' && (
                  <div className="p-2 space-y-1">
                    {drawingMode && (
                      <div className="mx-2 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700 font-medium">
                          {drawingMode === 'circle'
                            ? 'Haz click en el mapa y arrastra para dibujar un círculo'
                            : 'Haz click en el mapa para dibujar los vértices del polígono. Haz click en el primer punto para cerrar.'}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-6 text-xs text-blue-600"
                          onClick={() => setDrawingMode(null)}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                      </div>
                    )}

                    {geofencesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : geofences.length === 0 && !drawingMode ? (
                      <div className="text-center py-12 px-4">
                        <Pentagon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground mb-2">No hay geocercas</p>
                        <p className="text-xs text-muted-foreground">
                          Usa los botones de arriba para dibujar una zona en el mapa
                        </p>
                      </div>
                    ) : (
                      geofences.map(geofence => (
                        <GeofenceCard
                          key={geofence.id}
                          geofence={geofence}
                          onToggleActive={async () => {
                            await updateGeofence(geofence.id, { is_active: !geofence.is_active });
                          }}
                          onDelete={async () => {
                            if (confirm('¿Eliminar esta geocerca?')) {
                              await deleteGeofence(geofence.id);
                            }
                          }}
                          onFocus={() => handleFocusGeofence(geofence)}
                        />
                      ))
                    )}
                  </div>
                )}

                {sidebarTab === 'alerts' && (
                  <div className="p-2 space-y-1">
                    {/* Speed threshold config */}
                    <div className="p-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs font-semibold text-red-700">L\u00edmite de velocidad</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={60}
                          max={200}
                          step={10}
                          value={speedThreshold}
                          onChange={e => setSpeedThreshold(Number(e.target.value))}
                          className="flex-1 h-1.5 accent-red-500 cursor-pointer"
                        />
                        <span className="text-sm font-bold text-red-600 min-w-[52px] text-right">{speedThreshold} km/h</span>
                      </div>
                    </div>

                    {/* Overspeed alerts section */}
                    {overspeedAlerts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 px-1 py-1.5">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Velocidad excesiva ({overspeedAlerts.length})</span>
                        </div>
                        {overspeedAlerts.slice(0, 10).map(alert => (
                          <div
                            key={alert.id}
                            onClick={() => setMapTarget({ center: [alert.lat, alert.lng], zoom: 16 })}
                            className="p-3 rounded-xl border bg-white border-red-100 hover:border-red-200 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-50 border-2 border-red-300">
                                <Gauge className="h-3.5 w-3.5 text-red-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-semibold">{alert.matricula}</span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-red-200 text-red-700 bg-red-50">
                                    {alert.speed} km/h
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  L\u00edmite: {alert.threshold} km/h (+{alert.speed - alert.threshold} km/h)
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] text-muted-foreground">
                                  {alert.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Geofence alerts section */}
                    {geofenceAlerts.length > 0 && (
                      <div className="flex items-center gap-2 px-1 py-1.5 mt-2">
                        <ShieldAlert className="h-3 w-3 text-blue-500" />
                        <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Geocercas ({geofenceAlerts.length})</span>
                      </div>
                    )}

                    {alertsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : geofenceAlerts.length === 0 && overspeedAlerts.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground mb-2">Sin alertas</p>
                        <p className="text-xs text-muted-foreground">
                          Las alertas aparecer\u00e1n cuando un veh\u00edculo exceda la velocidad l\u00edmite o entre/salga de una geocerca
                        </p>
                      </div>
                    ) : (
                      geofenceAlerts.map(alert => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          onClick={() => {
                            if (alert.latitude && alert.longitude) {
                              setMapTarget({ center: [alert.latitude, alert.longitude], zoom: 16 });
                            }
                          }}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Sidebar Toggle ── */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn(
            "absolute top-4 z-20 bg-white/90 backdrop-blur-sm border border-border/50 rounded-lg p-2 shadow-lg hover:bg-white transition-all",
            sidebarOpen ? "left-[392px]" : "left-4"
          )}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* ── Map ── */}
        <div className="flex-1 relative">
          <MapContainer
            center={MALLORCA_CENTER}
            zoom={DEFAULT_ZOOM}
            className="h-full w-full"
            zoomControl={false}
            style={{ background: '#f0f0f0' }}
          >
            {/* Google Maps tiles — same visual style as FindCarGPS */}
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              maxZoom={20}
            />

            {/* Zoom control in bottom-right */}
            <ZoomControl />

            {/* Map controller for programmatic navigation */}
            {mapTarget && <MapController center={mapTarget.center} zoom={mapTarget.zoom} />}

            {/* Drawing control */}
            <DrawingControl
              drawingMode={drawingMode}
              color={newGeofenceColor}
              onCircleComplete={handleCircleComplete}
              onPolygonComplete={handlePolygonComplete}
            />

            {/* Vehicle markers */}
            {filteredVehicles.map(vehicle => {
              if (!vehicle.position) return null;
              const isOnline = vehicle.device?.status === 'online';
              const isSelected = selectedVehicleId === vehicle.id;
              const isFollowed = followingVehicleId === vehicle.id;

              return (
                <AnimatedMarker
                  key={vehicle.id}
                  position={[vehicle.position.latitude, vehicle.position.longitude]}
                  icon={createVehicleIcon(isOnline, isSelected, vehicle.position.course, isFollowed)}
                  markerId={vehicle.id}
                  animationDuration={2000}
                  onClick={() => handleSelectVehicle(vehicle)}
                />
              );
            })}

            {/* Route polyline */}
            {routePositions.length > 1 && (
              <Polyline
                positions={routePositions.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: '#3B82F6', weight: 3, opacity: 0.8, dashArray: '8 4' }}
              />
            )}

            {/* Route playback marker */}
            {routePositions.length > 0 && routePlaybackIndex >= 0 && routePlaybackIndex < routePositions.length && (
              <CircleMarker
                center={[routePositions[routePlaybackIndex].lat, routePositions[routePlaybackIndex].lng]}
                radius={7}
                pathOptions={{ color: '#1d4ed8', fillColor: '#3B82F6', fillOpacity: 1, weight: 2 }}
              />
            )}

            {/* Geofences */}
            {showGeofences && geofences.filter(g => g.is_active).map(geofence => {
              if (geofence.type === 'circle' && geofence.center_lat && geofence.center_lng && geofence.radius_meters) {
                return (
                  <LCircle
                    key={geofence.id}
                    center={[geofence.center_lat, geofence.center_lng]}
                    radius={geofence.radius_meters}
                    pathOptions={{
                      color: geofence.color,
                      fillColor: geofence.color,
                      fillOpacity: geofence.opacity,
                      weight: 2,
                    }}
                  />
                );
              } else if (geofence.type === 'polygon' && geofence.coordinates && geofence.coordinates.length >= 3) {
                return (
                  <LPolygon
                    key={geofence.id}
                    positions={geofence.coordinates.map(c => [c.lat, c.lng] as [number, number])}
                    pathOptions={{
                      color: geofence.color,
                      fillColor: geofence.color,
                      fillOpacity: geofence.opacity,
                      weight: 2,
                    }}
                  />
                );
              }
              return null;
            })}
          </MapContainer>

          {/* LIVE follow banner */}
          <AnimatePresence>
            {followingVehicleId && (() => {
              const followedVehicle = vehiclesWithGPS.find(v => v.id === followingVehicleId);
              if (!followedVehicle) return null;
              return (
                <motion.div
                  key="live-banner"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]"
                >
                  <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-full px-4 py-2 shadow-lg flex items-center gap-3">
                    {/* Pulsing live dot */}
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider">LIVE</span>
                    <span className="text-xs font-semibold text-foreground">{followedVehicle.matricula}</span>
                    {followedVehicle.position?.speed != null && followedVehicle.position.speed > 0 && (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {Math.round(followedVehicle.position.speed * 1.852)} km/h
                      </span>
                    )}
                    <button
                      onClick={() => setFollowingVehicleId(null)}
                      className="ml-1 p-1 rounded-full hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
                      title="Dejar de seguir"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Overspeed alert banner */}
          <AnimatePresence>
            {showOverspeedBanner && currentOverspeedVehicle && (() => {
              const overspeedVehicle = vehiclesWithGPS.find(v => v.id === currentOverspeedVehicle);
              const latestAlert = overspeedAlerts[0];
              if (!overspeedVehicle || !latestAlert) return null;
              return (
                <motion.div
                  key="overspeed-banner"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1001]"
                >
                  <div className="bg-red-50/95 backdrop-blur-md border-2 border-red-300 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-4">
                    {/* Warning icon with pulse */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-30" />
                      <div className="relative w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                        <Gauge className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-800">EXCESO DE VELOCIDAD</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono font-bold text-red-700">{latestAlert.matricula}</span>
                        <span className="text-xs text-red-600">—</span>
                        <span className="text-lg font-black text-red-600">{latestAlert.speed}</span>
                        <span className="text-xs font-semibold text-red-500">km/h</span>
                      </div>
                      <p className="text-[10px] text-red-500 mt-0.5">L\u00edmite: {latestAlert.threshold} km/h</p>
                    </div>
                    {/* Close */}
                    <button
                      onClick={() => { setShowOverspeedBanner(false); setCurrentOverspeedVehicle(null); }}
                      className="ml-2 p-1.5 rounded-full hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* Status bar overlay */}
          <div className="absolute bottom-4 right-4 z-[1000] flex items-center gap-2">
            <div className="bg-white/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 flex items-center gap-2 shadow-md">
              <Radio className={cn("h-3 w-3", refreshing ? "text-primary animate-pulse" : "text-green-500")} />
              <span className="text-[11px] font-medium text-muted-foreground">
                Auto-refresh 10s
              </span>
            </div>
            {geofences.length > 0 && (
              <button
                onClick={() => setShowGeofences(!showGeofences)}
                className={cn(
                  "bg-white/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 flex items-center gap-2 shadow-md transition-colors",
                  showGeofences ? "text-blue-600" : "text-muted-foreground"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium">
                  {geofences.filter(g => g.is_active).length} geocercas
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ── Vehicle Detail Panel ── */}
        {detailPanelOpen && selectedVehicle && (
          <VehicleDetailPanel
            vehicle={selectedVehicle}
            onClose={handleCloseDetail}
            onFollowVehicle={(id) => handleFollowVehicle(id)}
            onRouteLoaded={handleRouteLoaded}
            onRoutePlaybackUpdate={handleRoutePlaybackUpdate}
            onRouteClear={handleRouteClear}
          />
        )}

        {/* ── New Geofence Dialog ── */}
        <Dialog open={geofenceDialogOpen} onOpenChange={setGeofenceDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva Geocerca</DialogTitle>
              <DialogDescription>
                Define un nombre y configuración para la zona geográfica
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Oficina central, Aeropuerto..."
                  value={newGeofenceName}
                  onChange={e => setNewGeofenceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {['#3B82F6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#c9a96e'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewGeofenceColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        newGeofenceColor === color ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Alertas</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Al entrar en la zona</span>
                  <Switch checked={newGeofenceAlertEnter} onCheckedChange={setNewGeofenceAlertEnter} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Al salir de la zona</span>
                  <Switch checked={newGeofenceAlertExit} onCheckedChange={setNewGeofenceAlertExit} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setGeofenceDialogOpen(false); setPendingGeofenceData(null); }}>
                Cancelar
              </Button>
              <Button onClick={handleSaveGeofence}>
                Crear geocerca
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// ── Zoom Control Component ──
function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const zoomControl = L.control.zoom({ position: 'bottomright' });
    zoomControl.addTo(map);
    return () => {
      map.removeControl(zoomControl);
    };
  }, [map]);
  return null;
}

// ── Vehicle Card Component ──
function VehicleCard({
  vehicle,
  isSelected,
  isFollowing,
  onClick,
  onFollow,
}: {
  vehicle: FleetVehicleGPS;
  isSelected: boolean;
  isFollowing: boolean;
  onClick: () => void;
  onFollow: (e: React.MouseEvent) => void;
}) {
  const isOnline = vehicle.device?.status === 'online';
  const speed = vehicle.position?.speed;
  const speedKmh = speed ? Math.round(speed * 1.852) : 0;
  const attrs = (vehicle.position as any)?.attributes || {};
  const batteryLevel = vehicle.position?.batteryLevel;
  const pdop = attrs.pdop as number | undefined;
  const csq = attrs.csq as number | undefined;
  const signalStrength = attrs.signalStrength as number | undefined;

  return (
    <motion.div
      layout
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl cursor-pointer transition-all border",
        isFollowing
          ? "bg-blue-50/80 border-blue-300 shadow-md ring-1 ring-blue-200"
          : isSelected
            ? "bg-primary/5 border-primary/30 shadow-sm"
            : "bg-white border-transparent hover:bg-muted/30 hover:border-border/50"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm relative",
          isFollowing
            ? "bg-gradient-to-br from-blue-400 to-blue-600"
            : isOnline
              ? "bg-gradient-to-br from-green-400 to-green-600"
              : "bg-gradient-to-br from-gray-300 to-gray-400"
        )}>
          <Car className="h-4.5 w-4.5 text-white" />
          {isFollowing && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>

        {/* Vehicle info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold tracking-wider">{vehicle.matricula}</span>
            {isOnline && speedKmh > 0 && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {speedKmh} km/h
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || 'Sin modelo'}
          </p>
        </div>

        {/* Battery + Status */}
        <div className="flex items-center gap-1.5">
          {batteryLevel != null && (
            <div className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
              batteryLevel > 40 ? "bg-green-50 text-green-700" :
              batteryLevel > 15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
            )}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="6" width="18" height="12" rx="2" />
                <line x1="23" y1="10" x2="23" y2="14" />
                <rect x="3" y="8" width={`${Math.max(2, batteryLevel * 14 / 100)}`} height="8" rx="1" fill="currentColor" opacity="0.6" />
              </svg>
              {Math.round(batteryLevel)}%
            </div>
          )}
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
            isOnline ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
          )}>
            {isOnline ? 'ON' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Telemetry row: PDOP, CSQ, Signal */}
      {isOnline && (pdop != null || csq != null || signalStrength != null) && (
        <div className="flex items-center gap-2 mt-2 ml-[52px] flex-wrap">
          {pdop != null && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground" title="PDOP - Precisión GPS (menor = mejor)">
              <Satellite className="h-3 w-3" />
              <span className={cn(
                "font-semibold",
                pdop <= 2 ? "text-green-600" : pdop <= 5 ? "text-amber-600" : "text-red-600"
              )}>{pdop.toFixed(1)}</span>
            </div>
          )}
          {csq != null && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground" title="CSQ - Calidad señal celular (0-31)">
              <Radio className="h-3 w-3" />
              <span className={cn(
                "font-semibold",
                csq >= 15 ? "text-green-600" : csq >= 8 ? "text-amber-600" : "text-red-600"
              )}>{csq}</span>
            </div>
          )}
          {signalStrength != null && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Fuerza de señal">
              <Wifi className="h-3 w-3" />
              <span className={cn(
                "font-semibold",
                signalStrength >= 60 ? "text-green-600" : signalStrength >= 30 ? "text-amber-600" : "text-red-600"
              )}>{signalStrength}%</span>
            </div>
          )}
        </div>
      )}

      {/* Address */}
      {vehicle.position?.address && (
        <p className="text-[11px] text-muted-foreground mt-2 ml-[52px] truncate leading-tight">
          {vehicle.position.address}
        </p>
      )}

      {/* Time - show staleness warning if position is older than 5 minutes */}
      {vehicle.position?.deviceTime && (() => {
        const posAge = Date.now() - new Date(vehicle.position.deviceTime).getTime();
        const isStale = posAge > 5 * 60 * 1000; // >5 min
        const isVeryStale = posAge > 30 * 60 * 1000; // >30 min
        return (
          <p className={`text-[10px] mt-1 ml-[52px] ${isVeryStale ? 'text-red-400' : isStale ? 'text-amber-400' : 'text-muted-foreground/60'}`}>
            {new Date(vehicle.position.deviceTime).toLocaleString('es-ES', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
            {isStale && (
              <span className="ml-1">
                {isVeryStale ? '⚠️' : '⏱️'}
              </span>
            )}
          </p>
        );
      })()}

      {/* Follow button */}
      {isOnline && vehicle.position && (
        <div className="flex items-center justify-end mt-2">
          <button
            onClick={onFollow}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
              isFollowing
                ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"
                : "text-muted-foreground hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100"
            )}
            title={isFollowing ? 'Dejar de seguir' : 'Seguir en tiempo real'}
          >
            <Crosshair className={cn("h-3 w-3", isFollowing && "animate-pulse")} />
            {isFollowing ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Geofence Card Component ──
function GeofenceCard({
  geofence,
  onToggleActive,
  onDelete,
  onFocus,
}: {
  geofence: Geofence;
  onToggleActive: () => void;
  onDelete: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="p-3 rounded-xl border bg-white border-transparent hover:border-border/50 transition-all">
      <div className="flex items-center gap-3">
        {/* Color indicator */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: geofence.color + '20', border: `2px solid ${geofence.color}` }}
        >
          {geofence.type === 'circle' ? (
            <Circle className="h-3.5 w-3.5" style={{ color: geofence.color }} />
          ) : (
            <Pentagon className="h-3.5 w-3.5" style={{ color: geofence.color }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{geofence.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {geofence.type === 'circle'
              ? `Radio: ${geofence.radius_meters ? Math.round(geofence.radius_meters) : 0}m`
              : `${geofence.coordinates?.length || 0} vértices`}
            {geofence.alert_on_enter && ' · ↗️ Entrada'}
            {geofence.alert_on_exit && ' · ↙️ Salida'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onFocus}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Centrar en mapa"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
          <Switch
            checked={geofence.is_active}
            onCheckedChange={onToggleActive}
            className="scale-75"
          />
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Alert Card Component ──
function AlertCard({
  alert,
  onClick,
}: {
  alert: GeofenceAlert;
  onClick: () => void;
}) {
  const isEnter = alert.event_type === 'enter';
  const timeStr = new Date(alert.triggered_at).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={onClick}
      className="p-3 rounded-xl border bg-white border-transparent hover:border-border/50 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Event icon */}
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isEnter ? "bg-blue-50 border-2 border-blue-300" : "bg-orange-50 border-2 border-orange-300"
        )}>
          {isEnter ? (
            <Navigation className="h-3.5 w-3.5 text-blue-600" style={{ transform: 'rotate(45deg)' }} />
          ) : (
            <Navigation className="h-3.5 w-3.5 text-orange-600" style={{ transform: 'rotate(-135deg)' }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">{alert.vehicle_plate || 'Desconocido'}</span>
            <Badge variant="outline" className={cn(
              "text-[9px] px-1.5 py-0",
              isEnter ? "border-blue-200 text-blue-700 bg-blue-50" : "border-orange-200 text-orange-700 bg-orange-50"
            )}>
              {isEnter ? '↗ Entrada' : '↙ Salida'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {alert.geofence_name || 'Geocerca'}
          </p>
        </div>

        {/* Time */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground">{timeStr}</p>
          {alert.speed != null && alert.speed > 0 && (
            <p className="text-[10px] text-muted-foreground/60">
              {Math.round(alert.speed * 1.852)} km/h
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
