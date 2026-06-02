/**
 * Live Map Page — Shows "En camino" operations with Supabase Realtime
 * Uses Leaflet with OpenStreetMap tiles (no API key needed)
 * Receives instant push updates via Supabase Realtime (< 1 second latency)
 * Falls back to polling every 60s if realtime connection drops
 * 
 * REDESIGN: Premium visual treatment with glassmorphism, refined typography,
 * and brand-consistent Azul Cars styling.
 * 
 * IMPROVEMENTS v2:
 * - Share link button in sidebar cards (copies /track/:token URL)
 * - Click-to-focus: clicking a sidebar card pans/zooms the map to that marker
 * - Mobile bottom sheet: operations list accessible on small screens
 * - Live ETA from Google Maps for operations with GPS active
 * - Improved sidebar toggle visibility
 * - Selected marker visual highlight
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiInvoke } from '@/lib/apiClient';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Navigation, Clock, MapPin, User, ArrowRight, ExternalLink, Truck, RotateCcw, Radio, AlertTriangle, Wifi, WifiOff, Loader2, Eye, EyeOff, Car, Share2, Copy, Check, ChevronUp, ChevronDown, Crosshair, PanelRightClose, PanelRightOpen } from 'lucide-react';
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
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

// ── Types ──
type GeocodeSource = 'alias' | 'nominatim' | 'google';

interface GeocodedRecord extends EnCaminoRecord {
  lat: number;
  lng: number;
  geocoded: boolean;
  geocodeSource: GeocodeSource;
}

// ── Brand Constants ──
const brand = {
  navy: '#001321',
  gold: '#c9a96e',
  goldLight: '#d4b87a',
  warmBg: '#F5F3EF',
  borderLight: 'rgba(0,19,33,0.08)',
};

// ── Map Constants ──
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

// ── Custom marker icons (premium SVG markers with brand colors) ──
const createIcon = (color: string, pulse: boolean = false) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="45">
    <defs>
      <filter id="shadow-${color.replace('#','')}" x="-30%" y="-10%" width="160%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
      </filter>
      <linearGradient id="grad-${color.replace('#','')}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color};stop-opacity:0.8" />
      </linearGradient>
    </defs>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="url(#grad-${color.replace('#','')})" filter="url(#shadow-${color.replace('#','')})"/>
    <circle cx="12" cy="11" r="5" fill="white" opacity="0.95"/>
  </svg>`;
  return L.divIcon({
    html: `<div class="${pulse ? 'animate-pulse' : ''}" style="display:flex;align-items:center;justify-content:center;">${svg}</div>`,
    className: 'custom-marker',
    iconSize: [30, 45],
    iconAnchor: [15, 45],
    popupAnchor: [0, -45],
  });
};

const entregaIcon = createIcon('#1d4ed8', true); // blue-700
const devolucionIcon = createIcon('#b45309', true); // amber-700
const baseIcon = createIcon('#047857'); // emerald-700

// Car icon for live location tracking
const createCarIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
    <defs>
      <filter id="car-shadow-${color.replace('#','')}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <circle cx="18" cy="18" r="15" fill="${color}" stroke="white" stroke-width="2.5" filter="url(#car-shadow-${color.replace('#','')})"/>
    <g transform="translate(9,9)" fill="white">
      <path d="M13.5 5.5l-1.2-3.6C12 1.1 11.2 0.5 10.3 0.5H5.7C4.8 0.5 4 1.1 3.7 1.9L2.5 5.5C1.6 5.8 1 6.6 1 7.5v4c0 0.6 0.4 1 1 1h0.5c0.3 0 0.5-0.2 0.5-0.5v-0.5h10v0.5c0 0.3 0.2 0.5 0.5 0.5H14c0.6 0 1-0.4 1-1v-4c0-0.9-0.6-1.7-1.5-2zM4.5 2.5c0.1-0.3 0.4-0.5 0.7-0.5h5.6c0.3 0 0.6 0.2 0.7 0.5l1 3h-9l1-3zM4 9.5c-0.6 0-1-0.4-1-1s0.4-1 1-1 1 0.4 1 1-0.4 1-1 1zm8 0c-0.6 0-1-0.4-1-1s0.4-1 1-1 1 0.4 1 1-0.4 1-1 1z"/>
    </g>
    <circle cx="18" cy="18" r="15" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4">
      <animate attributeName="r" from="15" to="22" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'live-car-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

const entregaCarIcon = createCarIcon('#1d4ed8');
const devolucionCarIcon = createCarIcon('#b45309');

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

// ── Map auto-fit component (runs only once on initial load) ──
function FitBounds({ markers }: { markers: GeocodedRecord[] }) {
  const map = useMap();
  const hasFit = useRef(false);
  useEffect(() => {
    if (markers.length === 0 || hasFit.current) return;
    hasFit.current = true;
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
    bounds.extend([AZUL_CARS_BASE.lat, AZUL_CARS_BASE.lng]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [markers, map]);
  return null;
}

// ── FlyTo component: pans/zooms map to a specific location when triggered ──
function FlyToLocation({ target, trigger }: { target: { lat: number; lng: number } | null; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (!target || trigger === 0) return;
    map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
  }, [target, trigger, map]);
  return null;
}

// ── Helper: time urgency color ──
function getUrgencyColor(minutesAgo: number) {
  if (minutesAgo > 45) return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' };
  if (minutesAgo > 20) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' };
  return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
}

// ── Connection Status Indicator (premium pill) ──
function ConnectionIndicator({ status }: { status: RealtimeStatus }) {
  const config = {
    connected: {
      icon: <Wifi className="h-3 w-3" />,
      label: 'Tiempo real',
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      dotClass: 'bg-emerald-500 animate-pulse',
    },
    connecting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Conectando...',
      className: 'text-amber-700 bg-amber-50 border-amber-200',
      dotClass: 'bg-amber-500',
    },
    disconnected: {
      icon: <WifiOff className="h-3 w-3" />,
      label: 'Desconectado',
      className: 'text-red-700 bg-red-50 border-red-200',
      dotClass: 'bg-red-500',
    },
  }[status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all shadow-sm",
            config.className
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)} />
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[220px]">
          {status === 'connected' && 'Conectado a Supabase Realtime. Las actualizaciones llegan al instante.'}
          {status === 'connecting' && 'Estableciendo conexión en tiempo real...'}
          {status === 'disconnected' && 'Conexión perdida. Actualizando cada 60 segundos como respaldo.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── ETA data type ──
interface EtaData {
  eta_minutes: number | null;
  distance_km: number | null;
  duration_text: string | null;
  distance_text: string | null;
  status: string;
}

// ── Operation Card Component (shared between sidebar and mobile drawer) ──
function OperationCard({
  rec,
  records,
  geocodedRecords,
  routes,
  liveRoutes,
  trails,
  selectedRecordId,
  onSelect,
  onShareLink,
  copiedId,
  etaMap,
}: {
  rec: EnCaminoRecord;
  records: EnCaminoRecord[];
  geocodedRecords: GeocodedRecord[];
  routes: Record<string, RouteResult>;
  liveRoutes: Record<string, RouteResult>;
  trails: Record<string, any[]>;
  selectedRecordId: string | null;
  onSelect: (id: string) => void;
  onShareLink: (rec: EnCaminoRecord) => void;
  copiedId: string | null;
  etaMap: Record<string, EtaData>;
}) {
  const enCaminoAt = new Date(rec.en_camino_at);
  const minutesAgo = Math.floor((Date.now() - enCaminoAt.getTime()) / 60000);
  const urgency = getUrgencyColor(minutesAgo);
  const geocoded = geocodedRecords.find(g => g.id === rec.id);
  const routeData = geocoded ? routes[geocoded.id] : null;
  const isMovement = rec.reservation_id?.startsWith('mov_');
  const isEntrega = rec.operation_type === 'entrega';
  const isSelected = selectedRecordId === rec.id;
  const liveRoute = liveRoutes[rec.id];
  const isLive = rec.sharing_location && rec.current_lat != null;
  const eta = etaMap[rec.id];

  return (
    <div
      onClick={() => onSelect(rec.id)}
      className={cn(
        "rounded-xl border transition-all cursor-pointer group",
        isSelected
          ? "border-blue-200 bg-blue-50/50 shadow-md ring-1 ring-blue-100"
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      )}
    >
      <div className="px-3.5 py-3">
        {/* Card top row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center",
              isEntrega ? "bg-blue-100" : "bg-amber-100"
            )}>
              {isEntrega ? (
                <Truck className="h-3.5 w-3.5 text-blue-700" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold" style={{ color: brand.navy }}>
                {isMovement
                  ? (isEntrega ? 'Mov. Entrega' : 'Mov. Recogida')
                  : (isEntrega ? 'Entrega' : 'Devolución')}
              </span>
              {rec.external_reservation_id && !isMovement && (
                <span className="text-[10px] text-gray-500 font-medium">
                  Nº {rec.external_reservation_id}
                </span>
              )}
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border",
            urgency.bg, urgency.text, urgency.border
          )}>
            <Clock className="h-2.5 w-2.5" />
            {minutesAgo} min
          </div>
        </div>

        {/* User */}
        {rec.assigned_user_name && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <User className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-[11px] font-medium text-gray-700 truncate">{rec.assigned_user_name}</span>
          </div>
        )}

        {/* Destination */}
        <div className="flex items-start gap-1.5 mb-2">
          <MapPin className="h-3 w-3 text-gray-400 shrink-0 mt-0.5" />
          <span className="text-[11px] text-gray-600 leading-tight line-clamp-2">
            {rec.destination_address || 'Sin dirección'}
          </span>
        </div>

        {/* Route info + departure time */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-[10px] text-gray-500">
            Salió a las {format(enCaminoAt, 'HH:mm')}
          </span>
          {(() => {
            // Priority: Google Maps ETA > OSRM live route > OSRM static route
            if (eta && eta.status === 'ok' && eta.eta_minutes != null) {
              return (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <Navigation className="h-2.5 w-2.5" />
                  {eta.eta_minutes}' / {eta.distance_text || `${eta.distance_km} km`}
                </span>
              );
            }
            if (liveRoute) {
              return (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <Navigation className="h-2.5 w-2.5" />
                  {liveRoute.durationMinutes}' / {liveRoute.distanceKm} km
                </span>
              );
            }
            if (routeData) {
              return (
                <span className="text-[10px] font-medium text-gray-500">
                  ETA {routeData.durationMinutes}' / {routeData.distanceKm} km
                </span>
              );
            }
            return null;
          })()}
        </div>

        {/* Live location + trail badges + share button */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 font-bold">
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              GPS en vivo
            </span>
          )}
          {isLive && trails[rec.id] && trails[rec.id].length > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 font-medium">
              <Navigation className="h-2.5 w-2.5" />
              {trails[rec.id].length} pts
            </span>
          )}
          {geocoded && geocoded.geocodeSource === 'alias' && (
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 font-medium">
              Ubicación predefinida
            </span>
          )}
          {geocoded && geocoded.geocodeSource === 'google' && (
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border border-violet-200 text-violet-700 bg-violet-50 font-medium">
              Google Maps
            </span>
          )}
          {/* Share link button */}
          {rec.share_token && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShareLink(rec);
              }}
              className={cn(
                "inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-all",
                copiedId === rec.id
                  ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                  : "border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
              )}
              title="Copiar enlace de seguimiento para el cliente"
            >
              {copiedId === rec.id ? (
                <><Check className="h-2.5 w-2.5" /> Copiado</>
              ) : (
                <><Share2 className="h-2.5 w-2.5" /> Compartir</>
              )}
            </button>
          )}
        </div>
        {!geocoded && rec.destination_address && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border border-orange-200 text-orange-700 bg-orange-50 font-medium">
              <AlertTriangle className="h-2.5 w-2.5" />
              No se pudo ubicar
            </span>
          </div>
        )}
      </div>
    </div>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [etaMap, setEtaMap] = useState<Record<string, EtaData>>({});
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

  // ── Share link handler ──
  const handleShareLink = useCallback(async (rec: EnCaminoRecord) => {
    if (!rec.share_token) return;
    const url = `${window.location.origin}/track/${rec.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareId(rec.id);
      toast.success('Enlace de seguimiento copiado', {
        description: 'Pégalo en WhatsApp para enviárselo al cliente.',
      });
      setTimeout(() => setCopiedShareId(null), 3000);
    } catch {
      // Fallback for insecure contexts
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedShareId(rec.id);
      toast.success('Enlace copiado');
      setTimeout(() => setCopiedShareId(null), 3000);
    }
  }, []);



  // Geocode only NEW addresses that aren't in cache yet.
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

  // ── Click-to-focus handler ──
  const handleSelectRecord = useCallback((id: string) => {
    const isAlreadySelected = selectedRecordId === id;
    setSelectedRecordId(isAlreadySelected ? null : id);

    if (!isAlreadySelected) {
      // Find the record's position (live GPS or geocoded destination)
      const rec = records.find(r => r.id === id);
      if (rec?.sharing_location && rec.current_lat != null && rec.current_lng != null) {
        setFlyTarget({ lat: rec.current_lat, lng: rec.current_lng });
      } else {
        const geocoded = geocodedRecords.find(g => g.id === id);
        if (geocoded) {
          setFlyTarget({ lat: geocoded.lat, lng: geocoded.lng });
        }
      }
      setFlyTrigger(t => t + 1);
    }
  }, [selectedRecordId, records, geocodedRecords]);

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
  const liveRouteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRouteFetchRef = useRef<() => void>(() => {});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodedRecords.length, records.filter(r => r.sharing_location && r.current_lat != null).length]);

  // ── Fetch Google Maps ETA for live-tracking operations ──
  const etaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const etaFetchRef = useRef<() => void>(() => {});

  etaFetchRef.current = async () => {
    const liveRecords = records.filter(r => r.sharing_location && r.current_lat != null && r.share_token);
    if (liveRecords.length === 0) {
      setEtaMap({});
      return;
    }
    const newEtaMap: Record<string, EtaData> = {};
    for (const rec of liveRecords) {
      try {
        const resp = await fetch(`/api/track/${rec.share_token}/eta`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.ok) {
            newEtaMap[rec.id] = {
              eta_minutes: data.eta_minutes,
              distance_km: data.distance_km,
              duration_text: data.duration_text,
              distance_text: data.distance_text,
              status: data.status,
            };
          }
        }
      } catch {
        // Silently skip failed ETA fetches
      }
    }
    setEtaMap(newEtaMap);
  };

  useEffect(() => {
    const liveWithToken = records.filter(r => r.sharing_location && r.current_lat != null && r.share_token).length;
    if (liveWithToken > 0) {
      etaFetchRef.current();
      if (!etaTimerRef.current) {
        etaTimerRef.current = setInterval(() => etaFetchRef.current(), 45_000); // Every 45s
      }
    } else {
      setEtaMap({});
      if (etaTimerRef.current) {
        clearInterval(etaTimerRef.current);
        etaTimerRef.current = null;
      }
    }
    return () => {
      if (etaTimerRef.current) {
        clearInterval(etaTimerRef.current);
        etaTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.filter(r => r.sharing_location && r.current_lat != null && r.share_token).length]);

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

  const liveTrackingCount = records.filter(r => r.sharing_location && r.current_lat != null).length;

  return (
    <AppLayout title="Mapa En Vivo" fullWidth>
      <div className="h-full flex flex-col -m-4 md:-m-6 lg:-m-8">
        {/* ── Premium Status Bar ── */}
        <div
          className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b"
          style={{
            backgroundColor: 'rgba(245,243,239,0.92)',
            backdropFilter: 'blur(12px)',
            borderColor: brand.borderLight,
          }}
        >
          {/* Left section */}
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center h-7 w-7 rounded-lg" style={{ backgroundColor: 'rgba(0,19,33,0.06)' }}>
                <Radio className="h-3.5 w-3.5" style={{ color: brand.navy }} />
                {records.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                )}
              </div>
              <div className="flex flex-col">
                <span
                  className="text-[13px] font-bold leading-tight"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: brand.navy }}
                >
                  En Directo
                </span>
                <span className="text-[10px] leading-tight" style={{ color: brand.gold }}>
                  {records.length} operación{records.length !== 1 ? 'es' : ''} activa{records.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Separator */}
            <div className="h-6 w-px hidden sm:block" style={{ backgroundColor: brand.borderLight }} />

            {/* Connection status */}
            <ConnectionIndicator status={realtimeStatus} />

            {/* Separator */}
            <div className="h-6 w-px hidden md:block" style={{ backgroundColor: brand.borderLight }} />

            {/* Filter toggles */}
            <div className="hidden md:flex items-center gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowEntregas(v => !v)}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1.5 transition-all border shadow-sm",
                        showEntregas
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-white/60 border-gray-200 text-gray-400 line-through"
                      )}
                    >
                      <Truck className="h-3 w-3" />
                      <span>{entregas.length}</span>
                      <span className="hidden lg:inline">entregas</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{showEntregas ? 'Ocultar entregas' : 'Mostrar entregas'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowDevoluciones(v => !v)}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1.5 transition-all border shadow-sm",
                        showDevoluciones
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-white/60 border-gray-200 text-gray-400 line-through"
                      )}
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{devoluciones.length}</span>
                      <span className="hidden lg:inline">devoluciones</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{showDevoluciones ? 'Ocultar devoluciones' : 'Mostrar devoluciones'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Live tracking count */}
              {liveTrackingCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1.5 border shadow-sm bg-emerald-50 border-emerald-200 text-emerald-700">
                  <Car className="h-3 w-3" />
                  <span>{liveTrackingCount}</span>
                  <span className="hidden lg:inline">en vivo</span>
                </div>
              )}

              {failedGeocode.length > 0 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1.5 border shadow-sm bg-orange-50 border-orange-200 text-orange-700">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{failedGeocode.length} sin ubicar</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs" side="bottom">
                      <p className="font-semibold mb-1 text-xs">Direcciones no geocodificadas:</p>
                      {failedGeocode.map(r => (
                        <p key={r.id} className="text-[11px] text-muted-foreground">{r.destination_address}</p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Right section */}
          <button
            onClick={() => fetchRecords(true)}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-3 py-1.5 transition-all border shadow-sm",
              refreshing
                ? "bg-white border-gray-200 text-gray-700"
                : "bg-white/80 border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-white hover:border-gray-300"
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
        <div className="flex-1 flex min-h-0 relative">
          {/* Map Area */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: brand.warmBg }}>
                <div className="relative">
                  <div className="h-14 w-14 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: brand.navy }}>Cargando mapa</p>
                  <p className="text-xs text-gray-500 mt-0.5">Obteniendo operaciones activas...</p>
                </div>
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
                        <p className="font-semibold text-emerald-700">Base — Azul Cars</p>
                        <p className="text-xs text-gray-500">Carrer del Canal de Sant Jordi, 29, L3</p>
                        <p className="text-xs text-gray-500">07610 Palma, Mallorca</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="rounded-2xl px-10 py-8 shadow-xl text-center max-w-sm pointer-events-auto border"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(16px)',
                      borderColor: brand.borderLight,
                    }}
                  >
                    <div className="mx-auto mb-4 h-14 w-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,19,33,0.04)' }}>
                      <Navigation className="h-6 w-6" style={{ color: brand.navy }} />
                    </div>
                    <p className="text-base font-bold" style={{ fontFamily: 'Montserrat, sans-serif', color: brand.navy }}>
                      {records.length > 0 ? 'Operaciones ocultas' : 'Sin operaciones activas'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                      {records.length > 0
                        ? `Hay ${records.length} operación(es) activa(s) pero están ocultas por los filtros. Activa los toggles para verlas.`
                        : 'No hay vehículos en camino en este momento. Las operaciones aparecerán aquí automáticamente cuando se inicien.'
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
                      <p className="font-semibold text-emerald-700">Base — Azul Cars</p>
                      <p className="text-xs text-gray-500">Carrer del Canal de Sant Jordi, 29, L3</p>
                      <p className="text-xs text-gray-500">07610 Palma, Mallorca</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Route polylines */}
                {filteredGeocodedRecords.map((rec) => {
                  const routeData = routes[rec.id];
                  if (!routeData) return null;
                  const color = rec.operation_type === 'entrega' ? '#1d4ed8' : '#b45309';
                  const isGoogleFallback = rec.geocodeSource === 'google';
                  return (
                    <Polyline
                      key={`line-${rec.id}`}
                      positions={routeData.positions}
                      pathOptions={{
                        color,
                        weight: 4,
                        opacity: selectedRecordId === rec.id ? 1 : 0.65,
                        lineCap: 'round',
                        lineJoin: 'round',
                        ...(isGoogleFallback ? { dashArray: '10, 8' } : {}),
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[200px]">
                          <div className="flex items-center gap-1.5 font-bold mb-2" style={{ color: brand.navy }}>
                            {rec.operation_type === 'entrega' ? (
                              <><Truck className="h-3.5 w-3.5 text-blue-700" /> Entrega</>
                            ) : (
                              <><RotateCcw className="h-3.5 w-3.5 text-amber-700" /> Devolución</>
                            )}
                          </div>
                          {rec.external_reservation_id && (
                            <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                          )}
                          <p className="text-xs text-gray-600">{rec.destination_address}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: brand.navy }}>
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
                        color: '#059669',
                        weight: 4,
                        opacity: 0.9,
                        dashArray: '8, 6',
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[200px]">
                          <div className="flex items-center gap-1.5 font-bold mb-2 text-emerald-700">
                            <Radio className="h-3.5 w-3.5" /> Ruta en vivo
                          </div>
                          {rec.external_reservation_id && (
                            <p className="text-xs font-semibold mb-1">Reserva Nº {rec.external_reservation_id}</p>
                          )}
                          <p className="text-xs text-gray-600">{rec.destination_address}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-700">
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
                        color: '#059669',
                        weight: 4,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[200px]">
                          <div className="flex items-center gap-1.5 font-bold mb-2 text-emerald-700">
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
                {filteredRecords.filter(r => r.sharing_location && r.current_lat != null && r.current_lng != null).map((rec) => {
                  const popupHtml = `
                    <div style="font-size:0.875rem;min-width:220px;font-family:system-ui,-apple-system,sans-serif">
                      <div style="display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:8px;color:#047857">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;animation:pulse 1.5s infinite"></span>
                        Ubicación en vivo
                      </div>
                      ${rec.external_reservation_id ? `<p style="font-size:0.75rem;font-weight:600;margin-bottom:4px;color:#001321">Reserva Nº ${rec.external_reservation_id}</p>` : ''}
                      ${rec.assigned_user_name ? `<p style="font-size:0.75rem;margin-bottom:4px;color:#374151">👤 ${rec.assigned_user_name}</p>` : ''}
                      <p style="font-size:0.75rem;margin-bottom:4px;color:#6b7280">📍 Hacia: ${rec.destination_address || 'Sin destino'}</p>
                      ${rec.location_updated_at ? `<p style="font-size:0.7rem;color:#9ca3af;margin-top:6px">Actualizado ${formatRelativeTime(new Date(rec.location_updated_at))}</p>` : ''}
                    </div>
                  `;
                  return (
                    <AnimatedMarker
                      key={`live-${rec.id}`}
                      position={[rec.current_lat!, rec.current_lng!]}
                      icon={rec.operation_type === 'entrega' ? entregaCarIcon : devolucionCarIcon}
                      animationDuration={2000}
                      markerId={rec.id}
                      popupContent={popupHtml}
                    />
                  );
                })}

                {/* Destination markers */}
                {filteredGeocodedRecords.map((rec) => (
                  <Marker
                    key={rec.id}
                    position={[rec.lat, rec.lng]}
                    icon={rec.operation_type === 'entrega' ? entregaIcon : devolucionIcon}
                  >
                    <Popup>
                      <div className="text-sm min-w-[220px]">
                        <div className="flex items-center gap-1.5 font-bold mb-2" style={{ color: brand.navy }}>
                          {rec.operation_type === 'entrega' ? (
                            <><Truck className="h-3.5 w-3.5 text-blue-700" /> Entrega</>
                          ) : (
                            <><RotateCcw className="h-3.5 w-3.5 text-amber-700" /> Devolución</>
                          )}
                        </div>
                        {rec.external_reservation_id && (
                          <p className="text-xs font-semibold mb-1.5" style={{ color: brand.navy }}>Reserva Nº {rec.external_reservation_id}</p>
                        )}
                        {rec.assigned_user_name && (
                          <p className="text-xs flex items-center gap-1.5 mb-1 text-gray-600">
                            <User className="h-3 w-3 text-gray-400" /> {rec.assigned_user_name}
                          </p>
                        )}
                        <p className="text-xs flex items-center gap-1.5 mb-1 text-gray-600">
                          <MapPin className="h-3 w-3 text-gray-400" /> {rec.destination_address}
                        </p>
                        <p className="text-xs flex items-center gap-1.5 mb-2.5 text-gray-500">
                          <Clock className="h-3 w-3 text-gray-400" /> Salió {formatRelativeTime(new Date(rec.en_camino_at))}
                        </p>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(rec.destination_address || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
                          style={{ backgroundColor: 'rgba(0,19,33,0.05)', color: brand.navy }}
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir en Google Maps
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {filteredGeocodedRecords.length > 0 && <FitBounds markers={filteredGeocodedRecords} />}
                <FlyToLocation target={flyTarget} trigger={flyTrigger} />
              </MapContainer>
            )}

            {/* ── Mobile bottom sheet trigger (visible on < lg) ── */}
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
              <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
                <DrawerTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border transition-all"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(12px)',
                      borderColor: brand.borderLight,
                    }}
                  >
                    <Navigation className="h-4 w-4" style={{ color: brand.navy }} />
                    <span className="text-xs font-bold" style={{ color: brand.navy }}>
                      {filteredRecords.length} operación{filteredRecords.length !== 1 ? 'es' : ''}
                    </span>
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[70vh]">
                  <DrawerHeader className="pb-2">
                    <DrawerTitle className="text-sm font-bold flex items-center gap-2" style={{ color: brand.navy }}>
                      <Navigation className="h-4 w-4" />
                      Operaciones En Camino
                    </DrawerTitle>
                  </DrawerHeader>
                  <div className="overflow-y-auto px-4 pb-6 space-y-2">
                    {filteredRecords.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500">No hay operaciones activas</p>
                      </div>
                    ) : (
                      filteredRecords.map((rec) => (
                        <OperationCard
                          key={rec.id}
                          rec={rec}
                          records={records}
                          geocodedRecords={geocodedRecords}
                          routes={routes}
                          liveRoutes={liveRoutes}
                          trails={trails}
                          selectedRecordId={selectedRecordId}
                          onSelect={(id) => {
                            handleSelectRecord(id);
                            setMobileDrawerOpen(false);
                          }}
                          onShareLink={handleShareLink}
                          copiedId={copiedShareId}
                          etaMap={etaMap}
                        />
                      ))
                    )}
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>

          {/* ── Premium Sidebar (desktop only) ── */}
          <div
            className={cn(
              "border-l flex flex-col hidden lg:flex transition-all duration-300",
              sidebarCollapsed ? "w-0 overflow-hidden border-l-0" : "w-[360px]"
            )}
            style={{ backgroundColor: '#FAFAF8', borderColor: brand.borderLight }}
          >
            {/* Sidebar header */}
            <div className="px-4 py-3.5 border-b" style={{ borderColor: brand.borderLight }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,19,33,0.06)' }}>
                    <Navigation className="h-3.5 w-3.5" style={{ color: brand.navy }} />
                  </div>
                  <h2
                    className="text-[13px] font-bold tracking-tight"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: brand.navy }}
                  >
                    Operaciones
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                    style={{ backgroundColor: 'rgba(0,19,33,0.04)', borderColor: brand.borderLight, color: brand.navy }}
                  >
                    {filteredRecords.length} activa{filteredRecords.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Operation cards */}
            <div className="flex-1 overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(0,19,33,0.04)' }}>
                    <Navigation className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: brand.navy }}>
                    {records.length > 0 ? 'Operaciones ocultas' : 'Sin operaciones'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {records.length > 0
                      ? 'Activa los filtros para ver las operaciones'
                      : 'No hay vehículos en camino'
                    }
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {filteredRecords.map((rec) => (
                    <OperationCard
                      key={rec.id}
                      rec={rec}
                      records={records}
                      geocodedRecords={geocodedRecords}
                      routes={routes}
                      liveRoutes={liveRoutes}
                      trails={trails}
                      selectedRecordId={selectedRecordId}
                      onSelect={handleSelectRecord}
                      onShareLink={handleShareLink}
                      copiedId={copiedShareId}
                      etaMap={etaMap}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar footer — Base info */}
            <div className="px-4 py-3 border-t" style={{ borderColor: brand.borderLight, backgroundColor: 'rgba(0,19,33,0.02)' }}>
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-md flex items-center justify-center bg-emerald-100">
                  <MapPin className="h-3 w-3 text-emerald-700" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold" style={{ color: brand.navy }}>Base Azul Cars</span>
                  <span className="text-[9px] text-gray-500 truncate">Carrer del Canal de Sant Jordi, 29 — Palma</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar toggle button (improved visibility) */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className={cn(
              "hidden lg:flex absolute top-3 z-10 h-9 w-9 items-center justify-center rounded-lg border bg-white shadow-md transition-all hover:bg-gray-50 hover:shadow-lg",
            )}
            style={{
              borderColor: brand.borderLight,
              right: sidebarCollapsed ? '12px' : '372px',
            }}
            title={sidebarCollapsed ? 'Mostrar panel de operaciones' : 'Ocultar panel'}
          >
            {sidebarCollapsed ? (
              <PanelRightOpen className="h-4 w-4" style={{ color: brand.navy }} />
            ) : (
              <PanelRightClose className="h-4 w-4" style={{ color: brand.navy }} />
            )}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
