/**
 * Live Map Page — Shows "En camino" operations with Supabase Realtime
 * Uses Leaflet with OpenStreetMap tiles (no API key needed)
 * Receives instant push updates via Supabase Realtime (< 1 second latency)
 * Falls back to polling every 60s if realtime connection drops
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiInvoke } from '@/lib/apiClient';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Navigation, Clock, MapPin, User, ArrowRight, ExternalLink, Truck, RotateCcw, Radio, AlertTriangle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRealtimeEnCamino, type EnCaminoRecord, type RealtimeStatus } from '@/hooks/useRealtimeEnCamino';
import { useLocationTrail } from '@/hooks/useLocationTrail';
import { AnimatedMarker } from '@/components/map/AnimatedMarker';

// ── Types ──
type GeocodeSource = 'alias' | 'nominatim' | 'google';

interface GeocodedRecord extends EnCaminoRecord {
  lat: number;
  lng: number;
  geocoded: boolean;
  geocodeSource: GeocodeSource;
}

// ── Constants ──
const AZUL_CARS_BASE = { lat: 39.5361, lng: 2.7339 }; // Polígono Son Oms
const PALMA_CENTER = { lat: 39.5696, lng: 2.6502 };
const DEFAULT_ZOOM = 11;

// ── Location Aliases ──
interface LocationAlias {
  coords: { lat: number; lng: number };
  routingTarget: { lat: number; lng: number };
  lastMileWaypoints: [number, number][];
  extraMinutes: number;
}

const LOCATION_ALIASES: Record<string, LocationAlias> = {
  'parking_g_aeropuerto': {
    coords: { lat: 39.5505, lng: 2.7275 },
    routingTarget: { lat: 39.5472, lng: 2.7252 },
    lastMileWaypoints: [
      [39.5472, 2.7252],
      [39.5478, 2.7258],
      [39.5485, 2.7263],
      [39.5492, 2.7268],
      [39.5498, 2.7272],
      [39.5505, 2.7275],
    ],
    extraMinutes: 2,
  },
};

const ALIAS_MATCHERS: { keywords: string[]; aliasKey: string }[] = [
  {
    keywords: ['aeropuerto', 'aeropuerto de palma', 'pmi', 'parking g', 'aeropuerto palma de mallorca', '07611'],
    aliasKey: 'parking_g_aeropuerto',
  },
];

function matchLocationAlias(address: string): LocationAlias | null {
  const normalized = address.toLowerCase().trim();
  for (const matcher of ALIAS_MATCHERS) {
    for (const keyword of matcher.keywords) {
      if (normalized.includes(keyword)) {
        return LOCATION_ALIASES[matcher.aliasKey];
      }
    }
  }
  return null;
}

// ── Custom marker icons (professional SVG markers) ──
const createIcon = (color: string, pulse: boolean = false) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
    <defs>
      <filter id="shadow-${color.replace('#','')}" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="${color}" filter="url(#shadow-${color.replace('#','')})"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: `<div class="${pulse ? 'animate-pulse' : ''}" style="display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${svg}</div>`,
    className: 'custom-marker',
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -42],
  });
};

const entregaIcon = createIcon('#2563eb', true); // blue-600
const devolucionIcon = createIcon('#d97706', true); // amber-600
const baseIcon = createIcon('#059669'); // emerald-600

// Car icon for live location tracking
const createCarIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
    <g transform="translate(8,8)" fill="white">
      <path d="M13.5 5.5l-1.2-3.6C12 1.1 11.2 0.5 10.3 0.5H5.7C4.8 0.5 4 1.1 3.7 1.9L2.5 5.5C1.6 5.8 1 6.6 1 7.5v4c0 0.6 0.4 1 1 1h0.5c0.3 0 0.5-0.2 0.5-0.5v-0.5h10v0.5c0 0.3 0.2 0.5 0.5 0.5H14c0.6 0 1-0.4 1-1v-4c0-0.9-0.6-1.7-1.5-2zM4.5 2.5c0.1-0.3 0.4-0.5 0.7-0.5h5.6c0.3 0 0.6 0.2 0.7 0.5l1 3h-9l1-3zM4 9.5c-0.6 0-1-0.4-1-1s0.4-1 1-1 1 0.4 1 1-0.4 1-1 1zm8 0c-0.6 0-1-0.4-1-1s0.4-1 1-1 1 0.4 1 1-0.4 1-1 1z"/>
    </g>
    <circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="1" opacity="0.4">
      <animate attributeName="r" from="14" to="20" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'live-car-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const entregaCarIcon = createCarIcon('#2563eb');
const devolucionCarIcon = createCarIcon('#d97706');

// ── Geocode result with source tracking ──
interface GeocodeResult {
  lat: number;
  lng: number;
  source: GeocodeSource;
}

// ── Geocode helper ──
async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const alias = matchLocationAlias(address);
  if (alias) {
    return { ...alias.coords, source: 'alias' };
  }
  
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=es`
    );
    const data = await resp.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'nominatim' };
    }
  } catch {
    // Nominatim failed, continue to fallback
  }

  try {
    const { data: geoData } = await apiInvoke<{ ok: boolean; result: { lat: number; lng: number; formattedAddress: string } | null }>(
      'geocode',
      { body: { address } }
    );
    if (geoData?.ok && geoData.result) {
      return { lat: geoData.result.lat, lng: geoData.result.lng, source: 'google' };
    }
  } catch {
    // Google Maps fallback also failed
  }

  return null;
}

// ── Route result type ──
interface RouteResult {
  positions: [number, number][];
  distanceKm: number;
  durationMinutes: number;
}

// ── OSRM route fetcher ──
async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  destinationAddress?: string
): Promise<RouteResult | null> {
  try {
    const alias = destinationAddress ? matchLocationAlias(destinationAddress) : null;
    const routingTarget = alias ? alias.routingTarget : to;
    
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${routingTarget.lng},${routingTarget.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    
    const route = data.routes[0];
    let positions: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] as [number, number]
    );
    
    if (alias && alias.lastMileWaypoints.length > 0) {
      positions = [...positions, ...alias.lastMileWaypoints];
    }
    
    const extraMinutes = alias?.extraMinutes || 0;
    return {
      positions,
      distanceKm: +(route.distance / 1000).toFixed(1),
      durationMinutes: Math.round(route.duration / 60) + extraMinutes,
    };
  } catch {
    return null;
  }
}

// ── Map auto-fit component ──
function FitBounds({ markers }: { markers: GeocodedRecord[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
    bounds.extend([AZUL_CARS_BASE.lat, AZUL_CARS_BASE.lng]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [markers, map]);
  return null;
}

// ── Helper: time urgency color ──
function getUrgencyColor(minutesAgo: number) {
  if (minutesAgo > 45) return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800' };
  if (minutesAgo > 20) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' };
  return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' };
}

// ── Connection Status Indicator ──
function ConnectionIndicator({ status }: { status: RealtimeStatus }) {
  const config = {
    connected: {
      icon: <Wifi className="h-3 w-3" />,
      label: 'En tiempo real',
      className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      dotClass: 'bg-emerald-500 animate-pulse',
    },
    connecting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Conectando...',
      className: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      dotClass: 'bg-amber-500',
    },
    disconnected: {
      icon: <WifiOff className="h-3 w-3" />,
      label: 'Sin conexión',
      className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
      dotClass: 'bg-red-500',
    },
  }[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all",
            config.className
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)} />
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {status === 'connected' && 'Conectado a Supabase Realtime. Las actualizaciones llegan al instante.'}
          {status === 'connecting' && 'Estableciendo conexión en tiempo real...'}
          {status === 'disconnected' && 'Conexión perdida. Actualizando cada 60 segundos como respaldo.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Main Component ──
export default function LiveMapPage() {
  const {
    records,
    loading,
    refreshing,
    lastUpdated,
    realtimeStatus,
    fetchRecords,
  } = useRealtimeEnCamino();

  // GPS trail for live route history polylines
  const { trails } = useLocationTrail(records);

  const [tick, setTick] = useState(0);
  const geocodeCache = useRef<Record<string, GeocodeResult | null>>({});
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const routeCache = useRef<Record<string, RouteResult | null>>({});
  const [liveRoutes, setLiveRoutes] = useState<Record<string, RouteResult>>({});
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showEntregas, setShowEntregas] = useState(true);
  const [showDevoluciones, setShowDevoluciones] = useState(true);
  // Track which addresses are currently being geocoded to avoid duplicate requests
  const geocodingInProgress = useRef<Set<string>>(new Set());

  // Tick for relative time display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  };

  // Geocode only NEW addresses that aren't in cache yet.
  // This runs when records change but does NOT replace the geocoded records list;
  // it only populates the cache. The actual geocodedRecords are computed via useMemo below.
  useEffect(() => {
    let cancelled = false;
    async function geocodeNewAddresses() {
      const uncachedAddresses: string[] = [];
      for (const rec of records) {
        const addr = rec.destination_address;
        if (!addr) continue;
        if (geocodeCache.current[addr] !== undefined) continue;
        if (geocodingInProgress.current.has(addr)) continue;
        if (!uncachedAddresses.includes(addr)) uncachedAddresses.push(addr);
      }

      if (uncachedAddresses.length === 0) return;

      for (const addr of uncachedAddresses) {
        if (cancelled) return;
        geocodingInProgress.current.add(addr);

        // Throttle: wait 1.1s between geocode calls to respect Nominatim rate limit (1 req/s)
        if (uncachedAddresses.indexOf(addr) > 0) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
        if (cancelled) return;

        const result = await geocodeAddress(addr);
        geocodeCache.current[addr] = result;
        geocodingInProgress.current.delete(addr);
      }

      // Force a re-render so the useMemo picks up the new cache entries
      if (!cancelled) {
        setTick(t => t + 1);
      }
    }
    geocodeNewAddresses();
    return () => { cancelled = true; };
  }, [records]);

  // Compute geocoded records from records + cache (instant, no async)
  // This is the key fix: GPS updates change `records` but geocodeCache is stable,
  // so geocodedRecords update instantly without waiting for geocoding API calls.
  const geocodedRecords = useMemo(() => {
    const results: GeocodedRecord[] = [];
    for (const rec of records) {
      const addr = rec.destination_address;
      if (!addr) continue;
      const cached = geocodeCache.current[addr];
      if (cached) {
        results.push({ ...rec, lat: cached.lat, lng: cached.lng, geocoded: true, geocodeSource: cached.source });
      }
    }
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, tick]);

  // Fetch real road routes when geocoded records change
  useEffect(() => {
    let cancelled = false;
    async function fetchAllRoutes() {
      const newRoutes: Record<string, RouteResult> = {};
      for (const rec of geocodedRecords) {
        if (cancelled) return;
        const cacheKey = `${rec.lat},${rec.lng}`;
        if (routeCache.current[cacheKey] !== undefined) {
          const cached = routeCache.current[cacheKey];
          if (cached) newRoutes[rec.id] = cached;
          continue;
        }
        const route = await fetchRoute(AZUL_CARS_BASE, { lat: rec.lat, lng: rec.lng }, rec.destination_address || undefined);
        routeCache.current[cacheKey] = route;
        if (route) newRoutes[rec.id] = route;
      }
      if (!cancelled) setRoutes(newRoutes);
    }
    if (geocodedRecords.length > 0) {
      fetchAllRoutes();
    } else {
      setRoutes({});
    }
    return () => { cancelled = true; };
  }, [geocodedRecords]);

  // Fetch live routes from rental's current position to destination
  // Throttled to every 30s to avoid blocking render with OSRM calls on each GPS update.
  // The AnimatedMarker handles smooth visual movement independently.
  const liveRouteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRouteFetchRef = useRef<() => void>(() => {});

  // Keep the fetch function up-to-date with latest records/geocodedRecords
  liveRouteFetchRef.current = async () => {
    const liveRecords = geocodedRecords.filter(r => {
      const original = records.find(o => o.id === r.id);
      return original?.sharing_location && original?.current_lat != null && original?.current_lng != null;
    });
    if (liveRecords.length === 0) {
      setLiveRoutes({});
      return;
    }
    const newLiveRoutes: Record<string, RouteResult> = {};
    for (const rec of liveRecords) {
      const original = records.find(o => o.id === rec.id)!;
      const route = await fetchRoute(
        { lat: original.current_lat!, lng: original.current_lng! },
        { lat: rec.lat, lng: rec.lng },
        rec.destination_address || undefined
      );
      if (route) newLiveRoutes[rec.id] = route;
    }
    setLiveRoutes(newLiveRoutes);
  };

  useEffect(() => {
    const liveCount = records.filter(r => r.sharing_location && r.current_lat != null).length;
    if (liveCount > 0 && geocodedRecords.length > 0) {
      // Fetch once immediately, then every 30s
      liveRouteFetchRef.current();
      if (!liveRouteTimerRef.current) {
        liveRouteTimerRef.current = setInterval(() => liveRouteFetchRef.current(), 30_000);
      }
    } else {
      setLiveRoutes({});
      if (liveRouteTimerRef.current) {
        clearInterval(liveRouteTimerRef.current);
        liveRouteTimerRef.current = null;
      }
    }
    return () => {
      if (liveRouteTimerRef.current) {
        clearInterval(liveRouteTimerRef.current);
        liveRouteTimerRef.current = null;
      }
    };
    // Only re-run when the number of live records changes, not on every GPS update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodedRecords.length, records.filter(r => r.sharing_location && r.current_lat != null).length]);

  const entregas = geocodedRecords.filter(r => r.operation_type === 'entrega');
  const devoluciones = geocodedRecords.filter(r => r.operation_type === 'devolucion');
  const failedGeocode = records.filter(r => r.destination_address && !geocodedRecords.find(g => g.id === r.id));

  // Filtered records based on toggle state
  const filteredGeocodedRecords = geocodedRecords.filter(r => {
    if (r.operation_type === 'entrega' && !showEntregas) return false;
    if (r.operation_type === 'devolucion' && !showDevoluciones) return false;
    return true;
  });
  const filteredRecords = records.filter(r => {
    if (r.operation_type === 'entrega' && !showEntregas) return false;
    if (r.operation_type === 'devolucion' && !showDevoluciones) return false;
    return true;
  });

  return (
    <AppLayout title="Mapa En Camino" fullWidth>
      <div className="h-full flex flex-col -m-4 md:-m-6 lg:-m-8">
        {/* ── Compact Status Bar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Radio className="h-4 w-4 text-emerald-500" />
                {records.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <span className="text-sm font-semibold font-[Montserrat] tracking-tight">
                En Directo
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            {/* Connection status indicator */}
            <ConnectionIndicator status={realtimeStatus} />
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-3 text-xs">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowEntregas(v => !v)}
                      className={cn(
                        "flex items-center gap-1.5 font-medium rounded-md px-2 py-1 transition-all border",
                        showEntregas
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                          : "bg-muted/50 border-transparent text-muted-foreground line-through opacity-60 hover:opacity-80"
                      )}
                    >
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full transition-all",
                        showEntregas ? "bg-blue-500 ring-2 ring-blue-500/20" : "bg-muted-foreground/40"
                      )} />
                      <span>{entregas.length}</span>
                      <span className="hidden sm:inline">entregas</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{showEntregas ? 'Ocultar entregas' : 'Mostrar entregas'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowDevoluciones(v => !v)}
                      className={cn(
                        "flex items-center gap-1.5 font-medium rounded-md px-2 py-1 transition-all border",
                        showDevoluciones
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                          : "bg-muted/50 border-transparent text-muted-foreground line-through opacity-60 hover:opacity-80"
                      )}
                    >
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full transition-all",
                        showDevoluciones ? "bg-amber-500 ring-2 ring-amber-500/20" : "bg-muted-foreground/40"
                      )} />
                      <span>{devoluciones.length}</span>
                      <span className="hidden sm:inline">devoluciones</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{showDevoluciones ? 'Ocultar devoluciones' : 'Mostrar devoluciones'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {failedGeocode.length > 0 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="font-medium">{failedGeocode.length}</span>
                        <span className="hidden sm:inline">sin ubicar</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium mb-1">Direcciones no geocodificadas:</p>
                      {failedGeocode.map(r => (
                        <p key={r.id} className="text-xs">{r.destination_address}</p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchRecords(true)}
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-all rounded-md px-2 py-1 hover:bg-muted",
              refreshing && "text-foreground"
            )}
            title="Actualizar ahora"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">
              {lastUpdated ? formatRelativeTime(lastUpdated) : 'Cargando...'}
            </span>
          </button>
        </div>

        {/* ── Map + Sidebar ── */}
        <div className="flex-1 flex min-h-0">
          {/* Map Area */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-muted-foreground/20 border-t-emerald-500 animate-spin" />
                <p className="text-sm text-muted-foreground">Cargando mapa...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              /* Empty state overlay on map */
              <div className="relative h-full">
                <MapContainer
                  center={[PALMA_CENTER.lat, PALMA_CENTER.lng]}
                  zoom={DEFAULT_ZOOM}
                  className="h-full w-full"
                  style={{ minHeight: '400px' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                  />
                  <Marker position={[AZUL_CARS_BASE.lat, AZUL_CARS_BASE.lng]} icon={baseIcon}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold text-emerald-600">Base — Azul Cars</p>
                        <p className="text-xs text-gray-500">Carrer del Canal de Sant Jordi, 29, L3</p>
                        <p className="text-xs text-gray-500">07610 Palma, Mallorca</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-8 py-6 shadow-lg text-center max-w-sm pointer-events-auto">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Navigation className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {records.length > 0 ? 'Operaciones ocultas por filtro' : 'Sin operaciones activas'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {records.length > 0
                        ? `Hay ${records.length} operación(es) activa(s) pero están ocultas por los filtros. Activa los toggles de entregas o devoluciones para verlas.`
                        : 'No hay vehículos en camino en este momento. Las operaciones aparecerán aquí automáticamente cuando se inicien desde Reservas.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <MapContainer
                center={[PALMA_CENTER.lat, PALMA_CENTER.lng]}
                zoom={DEFAULT_ZOOM}
                className="h-full w-full"
                style={{ minHeight: '400px' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                />

                {/* Base marker */}
                <Marker position={[AZUL_CARS_BASE.lat, AZUL_CARS_BASE.lng]} icon={baseIcon}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-600">Base — Azul Cars</p>
                      <p className="text-xs text-gray-500">Carrer del Canal de Sant Jordi, 29, L3</p>
                      <p className="text-xs text-gray-500">07610 Palma, Mallorca</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Route polylines */}
                {filteredGeocodedRecords.map((rec) => {
                  const routeData = routes[rec.id];
                  if (!routeData) return null;
                  const color = rec.operation_type === 'entrega' ? '#2563eb' : '#d97706';
                  const isGoogleFallback = rec.geocodeSource === 'google';
                  return (
                    <Polyline
                      key={`line-${rec.id}`}
                      positions={routeData.positions}
                      pathOptions={{
                        color,
                        weight: 4,
                        opacity: selectedRecordId === rec.id ? 1 : 0.7,
                        lineCap: 'round',
                        lineJoin: 'round',
                        ...(isGoogleFallback ? { dashArray: '10, 8' } : {}),
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[180px]">
                          <div className="flex items-center gap-1.5 font-semibold mb-1.5">
                            {rec.operation_type === 'entrega' ? (
                              <><Truck className="h-3.5 w-3.5 text-blue-600" /> Entrega</>
                            ) : (
                              <><RotateCcw className="h-3.5 w-3.5 text-amber-600" /> Devolución</>
                            )}
                          </div>
                          {rec.external_reservation_id && (
                            <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                          )}
                          <p className="text-xs text-gray-600">{rec.destination_address}</p>
                          <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-gray-700">
                            <Clock className="h-3 w-3" />
                            ETA: {routeData.durationMinutes} min ({routeData.distanceKm} km)
                          </div>
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Live route polylines (from rental's current position to destination) */}
                {Object.entries(liveRoutes).map(([recId, routeData]) => {
                  const rec = filteredGeocodedRecords.find(r => r.id === recId);
                  if (!rec) return null;
                  return (
                    <Polyline
                      key={`live-route-${recId}`}
                      positions={routeData.positions}
                      pathOptions={{
                        color: '#10b981',
                        weight: 4,
                        opacity: 0.9,
                        dashArray: '8, 6',
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[180px]">
                          <div className="flex items-center gap-1.5 font-semibold mb-1.5 text-emerald-600">
                            <Radio className="h-3.5 w-3.5" /> Ruta en vivo
                          </div>
                          {rec.external_reservation_id && (
                            <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                          )}
                          <p className="text-xs text-gray-600">{rec.destination_address}</p>
                          <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-gray-700">
                            <Clock className="h-3 w-3" />
                            Restante: {routeData.durationMinutes} min ({routeData.distanceKm} km)
                          </div>
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* GPS trail polylines — real route history */}
                {filteredRecords.filter(r => r.sharing_location && trails[r.id] && trails[r.id].length > 1).map((rec) => {
                  const trailPositions = trails[rec.id].map(p => [p.lat, p.lng] as [number, number]);
                  return (
                    <Polyline
                      key={`trail-${rec.id}`}
                      positions={trailPositions}
                      pathOptions={{
                        color: '#10b981',
                        weight: 4,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[180px]">
                          <div className="flex items-center gap-1.5 font-semibold mb-1.5 text-emerald-600">
                            <Navigation className="h-3.5 w-3.5" /> Recorrido real
                          </div>
                          {rec.external_reservation_id && (
                            <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                          )}
                          <p className="text-xs text-gray-600">
                            {trails[rec.id].length} posiciones registradas
                          </p>
                          {trails[rec.id].length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Desde {format(new Date(trails[rec.id][0].time), 'HH:mm:ss')}
                              {trails[rec.id].length > 1 && ` hasta ${format(new Date(trails[rec.id][trails[rec.id].length - 1].time), 'HH:mm:ss')}`}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Live location car markers — animated for smooth movement */}
                {filteredRecords.filter(r => r.sharing_location && r.current_lat != null && r.current_lng != null).map((rec) => (
                  <AnimatedMarker
                    key={`live-${rec.id}`}
                    position={[rec.current_lat!, rec.current_lng!]}
                    icon={rec.operation_type === 'entrega' ? entregaCarIcon : devolucionCarIcon}
                    animationDuration={2000}
                    markerId={rec.id}
                  >
                    <Popup>
                      <div className="text-sm min-w-[200px]">
                        <div className="flex items-center gap-1.5 font-semibold mb-2">
                          <Radio className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-600">Ubicación en vivo</span>
                        </div>
                        {rec.external_reservation_id && (
                          <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                        )}
                        {rec.assigned_user_name && (
                          <p className="text-xs flex items-center gap-1 mb-1">
                            <User className="h-3 w-3 text-gray-400" /> {rec.assigned_user_name}
                          </p>
                        )}
                        <p className="text-xs flex items-center gap-1 mb-1">
                          <MapPin className="h-3 w-3 text-gray-400" /> Hacia: {rec.destination_address}
                        </p>
                        {rec.location_updated_at && (
                          <p className="text-xs text-gray-500">
                            Actualizado {formatRelativeTime(new Date(rec.location_updated_at))}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </AnimatedMarker>
                ))}

                {/* Destination markers */}
                {filteredGeocodedRecords.map((rec) => (
                  <Marker
                    key={rec.id}
                    position={[rec.lat, rec.lng]}
                    icon={rec.operation_type === 'entrega' ? entregaIcon : devolucionIcon}
                  >
                    <Popup>
                      <div className="text-sm min-w-[200px]">
                        <div className="flex items-center gap-1.5 font-semibold mb-2">
                          {rec.operation_type === 'entrega' ? (
                            <><Truck className="h-3.5 w-3.5 text-blue-600" /> Entrega</>
                          ) : (
                            <><RotateCcw className="h-3.5 w-3.5 text-amber-600" /> Devolución</>
                          )}
                        </div>
                        {rec.external_reservation_id && (
                          <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                        )}
                        {rec.assigned_user_name && (
                          <p className="text-xs flex items-center gap-1 mb-1">
                            <User className="h-3 w-3 text-gray-400" /> {rec.assigned_user_name}
                          </p>
                        )}
                        <p className="text-xs flex items-center gap-1 mb-1">
                          <MapPin className="h-3 w-3 text-gray-400" /> {rec.destination_address}
                        </p>
                        <p className="text-xs flex items-center gap-1 mb-2">
                          <Clock className="h-3 w-3 text-gray-400" /> Salió {formatRelativeTime(new Date(rec.en_camino_at))}
                        </p>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(rec.destination_address || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir en Google Maps
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {filteredGeocodedRecords.length > 0 && <FitBounds markers={filteredGeocodedRecords} />}
              </MapContainer>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="w-[340px] border-l border-border bg-card flex flex-col hidden lg:flex">
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold font-[Montserrat] tracking-tight">Operaciones</h2>
                <Badge variant="outline" className="text-[10px] font-medium tabular-nums">
                  {filteredRecords.length} activas
                </Badge>
              </div>
            </div>

            {/* Operation cards */}
            <div className="flex-1 overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {records.length > 0
                      ? 'Operaciones ocultas por filtro'
                      : 'No hay operaciones en camino'
                    }
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {filteredRecords.map((rec) => {
                    const enCaminoAt = new Date(rec.en_camino_at);
                    const minutesAgo = Math.floor((Date.now() - enCaminoAt.getTime()) / 60000);
                    const urgency = getUrgencyColor(minutesAgo);
                    const geocoded = filteredGeocodedRecords.find(g => g.id === rec.id);
                    const routeData = geocoded ? routes[geocoded.id] : null;
                    const isEntrega = rec.operation_type === 'entrega';
                    const isSelected = selectedRecordId === rec.id;

                    return (
                      <div
                        key={rec.id}
                        onClick={() => setSelectedRecordId(isSelected ? null : rec.id)}
                        className={cn(
                          "rounded-lg border transition-all cursor-pointer group",
                          isSelected
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-border hover:border-border/80 hover:bg-muted/30"
                        )}
                      >
                        {/* Card header */}
                        <div className="px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "h-6 w-6 rounded-md flex items-center justify-center",
                                isEntrega ? "bg-blue-100 dark:bg-blue-950" : "bg-amber-100 dark:bg-amber-950"
                              )}>
                                {isEntrega ? (
                                  <Truck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <RotateCcw className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                )}
                              </div>
                              <span className="text-xs font-semibold">
                                {isEntrega ? 'Entrega' : 'Devolución'}
                              </span>
                            </div>
                            {rec.external_reservation_id && (
                              <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                Nº {rec.external_reservation_id}
                              </span>
                            )}
                            <div className={cn(
                              "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                              urgency.bg, urgency.text, urgency.border, "border"
                            )}>
                              <Clock className="h-2.5 w-2.5" />
                              {minutesAgo} min
                            </div>
                          </div>

                          {/* User */}
                          {rec.assigned_user_name && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs font-medium truncate">{rec.assigned_user_name}</span>
                            </div>
                          )}

                          {/* Destination */}
                          <div className="flex items-start gap-1.5">
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="text-xs text-muted-foreground leading-tight line-clamp-2">
                              {rec.destination_address || 'Sin dirección'}
                            </span>
                          </div>

                          {/* Route info + departure time */}
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground">
                              Salió a las {format(enCaminoAt, 'HH:mm')}
                            </span>
                            {(() => {
                              const liveRoute = liveRoutes[rec.id];
                              const baseRoute = geocoded ? routes[geocoded.id] : null;
                              if (liveRoute) {
                                return (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                    <Navigation className="h-2.5 w-2.5" />
                                    {liveRoute.durationMinutes}' / {liveRoute.distanceKm} km restante
                                  </span>
                                );
                              }
                              if (baseRoute) {
                                return (
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    ETA {baseRoute.durationMinutes}' / {baseRoute.distanceKm} km
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Live location badge */}
                          {rec.sharing_location && rec.current_lat != null && (
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-semibold">
                                <Radio className="h-2.5 w-2.5 animate-pulse" />
                                En vivo
                              </span>
                              {trails[rec.id] && trails[rec.id].length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium">
                                  <Navigation className="h-2.5 w-2.5" />
                                  {trails[rec.id].length} pts
                                </span>
                              )}
                              {rec.location_updated_at && (
                                <span className="text-[9px] text-muted-foreground">
                                  {formatRelativeTime(new Date(rec.location_updated_at))}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Geocode source badge */}
                          {geocoded && (
                            <div className="mt-1.5">
                              <span className={cn(
                                "inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border",
                                geocoded.geocodeSource === 'alias'
                                  ? "border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
                                  : geocoded.geocodeSource === 'google'
                                  ? "border-violet-200 text-violet-700 bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:bg-violet-950/40"
                                  : "border-border text-muted-foreground bg-muted/50"
                              )}>
                                {geocoded.geocodeSource === 'alias' ? 'Ubicación predefinida' : geocoded.geocodeSource === 'google' ? 'Google Maps' : 'OpenStreetMap'}
                              </span>
                            </div>
                          )}
                          {!geocoded && rec.destination_address && (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/40">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                No se pudo ubicar
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar footer — Base info */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/30">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">Base: Carrer del Canal de Sant Jordi, 29 — Palma</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
