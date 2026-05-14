/**
 * Live Map Page — Shows "En camino" operations on a real-time map
 * Uses Leaflet with OpenStreetMap tiles (no API key needed)
 * Polls the en-camino-tracking endpoint every 30 seconds
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiInvoke } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Navigation, Clock, MapPin, User, Car, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';

// ── Types ──
interface EnCaminoRecord {
  id: string;
  reservation_id: string;
  operation_type: 'entrega' | 'devolucion';
  en_camino_at: string;
  destination_address: string | null;
  assigned_user_name: string | null;
  created_at: string;
}

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
const POLL_INTERVAL = 30_000; // 30 seconds
const DEFAULT_ZOOM = 11;

// ── Location Aliases ──
// Known locations that don't geocode well or need exact coordinates
interface LocationAlias {
  coords: { lat: number; lng: number };
  // OSRM routing target (nearest routable point on public road)
  routingTarget: { lat: number; lng: number };
  // Manual last-mile waypoints from routing target to final destination
  lastMileWaypoints: [number, number][];
  // Extra minutes to add to ETA for internal access (barriers, etc.)
  extraMinutes: number;
}

const LOCATION_ALIASES: Record<string, LocationAlias> = {
  'parking_g_aeropuerto': {
    // Exact Parking G location (Transport Meeting Point)
    coords: { lat: 39.5505, lng: 2.7275 },
    // Nearest routable point: roundabout on Carretera de l'Aeroport
    routingTarget: { lat: 39.5472, lng: 2.7252 },
    // Manual waypoints: from roundabout, through access road with barriers, to Parking G
    lastMileWaypoints: [
      [39.5472, 2.7252], // Roundabout exit on Carretera de l'Aeroport
      [39.5478, 2.7258], // Start of internal access road
      [39.5485, 2.7263], // Barrier point
      [39.5492, 2.7268], // Past barriers, internal road
      [39.5498, 2.7272], // Approaching Parking G
      [39.5505, 2.7275], // Parking G - Transport Meeting Point
    ],
    extraMinutes: 2, // Barriers + slow internal road
  },
};

// Keywords that match each alias
const ALIAS_MATCHERS: { keywords: string[]; aliasKey: string }[] = [
  {
    keywords: ['aeropuerto', 'aeropuerto de palma', 'pmi', 'parking g', 'aeropuerto palma de mallorca', '07611'],
    aliasKey: 'parking_g_aeropuerto',
  },
];

// Check if an address matches a known alias
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

// ── Custom marker icons ──
const createIcon = (color: string, pulse: boolean = false) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>`;
  return L.divIcon({
    html: `<div class="${pulse ? 'animate-pulse' : ''}" style="display:flex;align-items:center;justify-content:center;">${svg}</div>`,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const entregaIcon = createIcon('#3b82f6', true); // blue
const devolucionIcon = createIcon('#f59e0b', true); // amber
const baseIcon = createIcon('#10b981'); // green (base)

// ── Geocode result with source tracking ──
interface GeocodeResult {
  lat: number;
  lng: number;
  source: GeocodeSource;
}

// ── Geocode helper (uses aliases → Nominatim → Google Maps API fallback) ──
async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  // 1. Check aliases first (instant, no network)
  const alias = matchLocationAlias(address);
  if (alias) {
    return { ...alias.coords, source: 'alias' };
  }
  
  // 2. Try Nominatim (free, no API key)
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

  // 3. Fallback: Google Maps Geocoding via server proxy
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
  durationMinutes: number;
  distanceKm: number;
}

// ── OSRM route helper (free, no API key, real road routes) ──
// If the destination matches a location alias, routes to the routing target
// and appends manual last-mile waypoints
async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  destinationAddress?: string
): Promise<RouteResult | null> {
  try {
    // Check if destination has a known alias with last-mile waypoints
    const alias = destinationAddress ? matchLocationAlias(destinationAddress) : null;
    const routeTo = alias ? alias.routingTarget : to;
    
    const resp = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${routeTo.lng},${routeTo.lat}?overview=full&geometries=geojson`
    );
    const data = await resp.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // GeoJSON coordinates are [lng, lat], Leaflet needs [lat, lng]
      let positions: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
      let durationMinutes = Math.round(route.duration / 60);
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
      
      // Append last-mile waypoints if alias exists
      if (alias) {
        positions = [...positions, ...alias.lastMileWaypoints];
        // Enforce minimum 9 min total (7 min drive + 2 min barriers) based on Google Maps
        // OSRM often underestimates airport routes
        const minimumMinutes = 7 + alias.extraMinutes; // 7 + 2 = 9
        durationMinutes = Math.max(durationMinutes + alias.extraMinutes, minimumMinutes);
      }
      
      return { positions, durationMinutes, distanceKm };
    }
    return null;
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
    // Also include base
    bounds.extend([AZUL_CARS_BASE.lat, AZUL_CARS_BASE.lng]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [markers, map]);
  return null;
}

// ── Main Component ──
export default function LiveMapPage() {
  const [records, setRecords] = useState<EnCaminoRecord[]>([]);
  const [geocodedRecords, setGeocodedRecords] = useState<GeocodedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const geocodeCache = useRef<Record<string, GeocodeResult | null>>({});
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const routeCache = useRef<Record<string, RouteResult | null>>({});

  // Tick for relative time display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch en-camino records
  const fetchRecords = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const resp = await apiInvoke<{ ok: boolean; records: EnCaminoRecord[] }>('en-camino-tracking', {
        body: { _method: 'GET', date: today },
      });
      if (resp.data?.ok && resp.data.records) {
        setRecords(resp.data.records);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('[live-map] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchRecords();
    const interval = setInterval(() => fetchRecords(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRecords]);

  // Geocode records when they change
  useEffect(() => {
    let cancelled = false;
    async function geocodeAll() {
      const results: GeocodedRecord[] = [];
      for (const rec of records) {
        if (cancelled) return;
        const addr = rec.destination_address;
        if (!addr) continue;

        // Check cache
        if (geocodeCache.current[addr] !== undefined) {
          const cached = geocodeCache.current[addr];
          if (cached) {
            results.push({ ...rec, lat: cached.lat, lng: cached.lng, geocoded: true, geocodeSource: cached.source });
          }
          continue;
        }

        const result = await geocodeAddress(addr);
        geocodeCache.current[addr] = result;
        if (result) {
          results.push({ ...rec, lat: result.lat, lng: result.lng, geocoded: true, geocodeSource: result.source });
        }
      }
      if (!cancelled) {
        setGeocodedRecords(results);
      }
    }
    geocodeAll();
    return () => { cancelled = true; };
  }, [records]);

  const formatRelativeTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  };

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

  const entregas = geocodedRecords.filter(r => r.operation_type === 'entrega');
  const devoluciones = geocodedRecords.filter(r => r.operation_type === 'devolucion');

  return (
    <AppLayout title="Mapa En Camino" fullWidth>
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-emerald-500" />
          <h1 className="text-lg font-semibold">Mapa En Camino</h1>
          <Badge variant="outline" className="gap-1">
            <Navigation className="h-3 w-3" />
            {records.length} operaciones activas
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500" /> Entregas ({entregas.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500" /> Devoluciones ({devoluciones.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500" /> Base
            </span>
          </div>
          {/* Last updated + refresh */}
          <button
            onClick={() => fetchRecords(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Actualizar ahora"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {lastUpdated ? formatRelativeTime(lastUpdated) : 'Cargando...'}
          </button>
        </div>
      </div>

      {/* Map + sidebar */}
      <div className="flex-1 flex">
        {/* Map */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
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
                    <p className="font-semibold text-emerald-600">🏠 Base — Azul Cars</p>
                    <p className="text-xs text-gray-500">Carrer del Canal de Sant Jordi, 29, L3</p>
                    <p className="text-xs text-gray-500">07610 Palma, Mallorca</p>
                  </div>
                </Popup>
              </Marker>

              {/* Polylines from base to each destination (real road routes) */}
              {geocodedRecords.map((rec) => {
                const routeData = routes[rec.id];
                if (!routeData) return null;
                const color = rec.operation_type === 'entrega' ? '#2563eb' : '#d97706';
                // Dashed line for Google Maps fallback routes
                const isGoogleFallback = rec.geocodeSource === 'google';
                return (
                  <Polyline
                    key={`line-${rec.id}`}
                    positions={routeData.positions}
                    pathOptions={{
                      color,
                      weight: 5,
                      opacity: 0.85,
                      lineCap: 'round',
                      lineJoin: 'round',
                      ...(isGoogleFallback ? { dashArray: '10, 8' } : {}),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">
                          {rec.operation_type === 'entrega' ? '🚗 Entrega' : '🔄 Devolución'}
                        </p>
                        <p className="text-xs mt-1">📍 {rec.destination_address}</p>
                        <p className="text-xs mt-1 font-medium">⏱ ETA: {routeData.durationMinutes} min ({routeData.distanceKm} km)</p>
                        <p className="text-[10px] mt-1" style={{ color: rec.geocodeSource === 'google' ? '#7c3aed' : rec.geocodeSource === 'alias' ? '#059669' : '#6b7280' }}>
                          {rec.geocodeSource === 'google' ? '🌐 Ubicación vía Google Maps' : rec.geocodeSource === 'alias' ? '📌 Ubicación predefinida' : '🗺️ Ubicación vía Nominatim'}
                        </p>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}

              {/* En camino markers */}
              {geocodedRecords.map((rec) => (
                <Marker
                  key={rec.id}
                  position={[rec.lat, rec.lng]}
                  icon={rec.operation_type === 'entrega' ? entregaIcon : devolucionIcon}
                >
                  <Popup>
                    <div className="text-sm min-w-[200px]">
                      <p className="font-semibold">
                        {rec.operation_type === 'entrega' ? '🚗 Entrega' : '🔄 Devolución'}
                      </p>
                      {rec.assigned_user_name && (
                        <p className="text-xs flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" /> {rec.assigned_user_name}
                        </p>
                      )}
                      <p className="text-xs flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {rec.destination_address}
                      </p>
                      <p className="text-xs flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" /> Salió {formatRelativeTime(new Date(rec.en_camino_at))}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: rec.geocodeSource === 'google' ? '#7c3aed' : rec.geocodeSource === 'alias' ? '#059669' : '#6b7280' }}>
                        {rec.geocodeSource === 'google' ? '🌐 Ubicación vía Google Maps' : rec.geocodeSource === 'alias' ? '📌 Ubicación predefinida' : '🗺️ Ubicación vía Nominatim'}
                      </p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(rec.destination_address || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1"
                      >
                        <Navigation className="h-3 w-3" /> Abrir en Google Maps
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {geocodedRecords.length > 0 && <FitBounds markers={geocodedRecords} />}
            </MapContainer>
          )}
        </div>

        {/* Sidebar - operation list */}
        <div className="w-80 border-l bg-background overflow-y-auto hidden lg:block">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold">Operaciones En Camino</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {records.length === 0 ? 'No hay operaciones en camino' : `${records.length} operaciones activas hoy`}
            </p>
          </div>
          <div className="divide-y">
            {records.map((rec) => {
              const enCaminoAt = new Date(rec.en_camino_at);
              const minutesAgo = Math.floor((Date.now() - enCaminoAt.getTime()) / 60000);
              // Find the geocoded version to get the source
              const geocoded = geocodedRecords.find(g => g.id === rec.id);
              const source = geocoded?.geocodeSource;
              return (
                <div key={rec.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        rec.operation_type === 'entrega'
                          ? "border-blue-300 text-blue-700 bg-blue-50"
                          : "border-amber-300 text-amber-700 bg-amber-50"
                      )}
                    >
                      {rec.operation_type === 'entrega' ? 'Entrega' : 'Devolución'}
                    </Badge>
                    <span className={cn(
                      "text-[10px] font-medium",
                      minutesAgo > 45 ? "text-red-500" : minutesAgo > 20 ? "text-amber-500" : "text-emerald-500"
                    )}>
                      hace {minutesAgo} min
                    </span>
                    {source && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1 py-0",
                          source === 'google'
                            ? "border-violet-300 text-violet-700 bg-violet-50"
                            : source === 'alias'
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                            : "border-gray-300 text-gray-600 bg-gray-50"
                        )}
                      >
                        {source === 'google' ? '🌐 Google' : source === 'alias' ? '📌 Alias' : '🗺️ OSM'}
                      </Badge>
                    )}
                  </div>
                  {rec.assigned_user_name && (
                    <p className="text-xs font-medium flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {rec.assigned_user_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <ArrowRight className="h-3 w-3" />
                    {rec.destination_address || 'Sin dirección'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Salió a las {format(enCaminoAt, 'HH:mm')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
