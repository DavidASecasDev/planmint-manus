/**
 * OperationsMapView — Map view for the Programación page.
 * Shows delivery/return operations for the selected day on a Leaflet map.
 * - Green markers for deliveries (Entrega)
 * - Blue markers for returns (Devolución)
 * - Orange markers for transfers
 * - Clustered markers for shared locations (airport, cruise terminal) with count badge
 * - Popup with client name, reservation number, confirmed time, and Google Maps link
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiInvoke } from '@/lib/apiClient';
import { MapPin, Loader2, ExternalLink, Navigation, Truck, RotateCcw, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──
export type TipoOperacion = 'Entrega' | 'Devolución' | 'Transfer';

export interface MapOperation {
  id: string;
  reservationId: string;
  externalReservationId: string;
  tipoOperacion: TipoOperacion;
  clienteNombre: string;
  clienteApellido: string;
  lugar: string | null;
  direccion: string | null;
  confirmedDatetime: string | null;
  fechaHora: string | null;
  isCompleted: boolean;
  assignedRentalName: string | null;
  vehiclePlate: string | null;
}

interface OperationsMapViewProps {
  operations: MapOperation[];
  isLoading?: boolean;
  organizationId?: string;
  fullPage?: boolean;
  dateControls?: React.ReactNode;
  onMarkCompleted?: (reservationId: string, tipoOperacion: TipoOperacion) => void;
}

interface GeocodedOperation extends MapOperation {
  lat: number;
  lng: number;
}

interface ClusteredGroup {
  lat: number;
  lng: number;
  operations: GeocodedOperation[];
  label: string;
}

// ── Constants ──
const MALLORCA_CENTER: [number, number] = [39.6131, 2.8882];
const MALLORCA_ZOOM = 10;
const CLUSTER_RADIUS_KM = 0.3; // 300m radius for clustering

// ── Known locations with fixed coordinates (avoid geocoding) ──
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number; label: string }> = {
  // ── Aeropuerto ──
  aeropuerto: { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },
  'aeropuerto de palma': { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },
  'aeropuerto palma': { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },
  pmi: { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },
  'parking g': { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },
  'clubs to hire': { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },
  'transport meeting point': { lat: 39.5490, lng: 2.7250, label: 'Aeropuerto de Palma - Parking G' },

  // ── Terminal de Cruceros / Puerto de Palma ──
  'terminal de cruceros': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'terminal de cruceros de palma': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'estacion maritima': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'estacion maritima palma': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'puerto de palma': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'puerto portals': { lat: 39.5250, lng: 2.5700, label: 'Puerto Portals' },

  // ── Puerto / Muelle Comercial de Alcúdia ──
  'muelle comercial': { lat: 39.8365, lng: 3.1400, label: 'Muelle Comercial de Alcúdia' },
  'muelle comercial de alcudia': { lat: 39.8365, lng: 3.1400, label: 'Muelle Comercial de Alcúdia' },
  'muelle comercial de alcúdia': { lat: 39.8365, lng: 3.1400, label: 'Muelle Comercial de Alcúdia' },
  'muelle comercial alcudia': { lat: 39.8365, lng: 3.1400, label: 'Muelle Comercial de Alcúdia' },
  'muelle comercial alcúdia': { lat: 39.8365, lng: 3.1400, label: 'Muelle Comercial de Alcúdia' },
  'puerto de alcudia': { lat: 39.8365, lng: 3.1400, label: 'Puerto de Alcúdia' },
  'puerto de alcúdia': { lat: 39.8365, lng: 3.1400, label: 'Puerto de Alcúdia' },
  'port d\'alcudia': { lat: 39.8365, lng: 3.1400, label: 'Port d\'Alcúdia' },
  'port d\'alcúdia': { lat: 39.8365, lng: 3.1400, label: 'Port d\'Alcúdia' },
  'terminal maritima alcudia': { lat: 39.8365, lng: 3.1400, label: 'Terminal Marítima Alcúdia' },
  'terminal maritima alcúdia': { lat: 39.8365, lng: 3.1400, label: 'Terminal Marítima Alcúdia' },

  // ── Oficina Azul Cars (Camí Fondo, 35, Llevant, 07007 Palma) ──
  'oficina azul': { lat: 39.5557, lng: 2.7170, label: 'Oficina Azul Cars - Llevant' },
  'oficina azul cars': { lat: 39.5557, lng: 2.7170, label: 'Oficina Azul Cars - Llevant' },
  'oficina azul cars - camí fondo': { lat: 39.5557, lng: 2.7170, label: 'Oficina Azul Cars - Llevant' },
  base: { lat: 39.5557, lng: 2.7170, label: 'Oficina Azul Cars - Llevant' },

  // ── Zonas de Mallorca (entregas a domicilio - centro aproximado) ──
  'palma de mallorca - entrega a domicilio': { lat: 39.5696, lng: 2.6502, label: 'Palma de Mallorca' },
  'palma de mallorca - entrega a domicilio gratuita': { lat: 39.5696, lng: 2.6502, label: 'Palma de Mallorca' },
  'playa de palma/el arenal': { lat: 39.5100, lng: 2.7500, label: 'Playa de Palma / El Arenal' },
  'playa de palma': { lat: 39.5100, lng: 2.7500, label: 'Playa de Palma' },
  'el arenal': { lat: 39.5050, lng: 2.7550, label: 'El Arenal' },
  'suroeste de mallorca - entrega a domicilio': { lat: 39.5100, lng: 2.5200, label: 'Suroeste de Mallorca' },
  'sur y este de mallorca - entrega a domicilio': { lat: 39.4500, lng: 2.9500, label: 'Sur y Este de Mallorca' },
  'norte de mallorca - entrega a domicilio': { lat: 39.8000, lng: 3.0000, label: 'Norte de Mallorca' },
  'centro de mallorca - entrega a domicilio': { lat: 39.6500, lng: 2.9000, label: 'Centro de Mallorca' },
  'sierra tramuntana - entrega a domicilio': { lat: 39.7600, lng: 2.7900, label: 'Sierra de Tramuntana' },
  'municipio de llucmajor - entrega a domicilio': { lat: 39.4900, lng: 2.8900, label: 'Llucmajor' },

  // ── Localidades frecuentes ──
  'alcudia': { lat: 39.8530, lng: 3.1210, label: 'Alcúdia' },
  'alcúdia': { lat: 39.8530, lng: 3.1210, label: 'Alcúdia' },
  paguera: { lat: 39.5350, lng: 2.4550, label: 'Paguera' },
  'palmanova': { lat: 39.5220, lng: 2.5350, label: 'Palmanova' },
  'magaluf': { lat: 39.5100, lng: 2.5250, label: 'Magaluf' },
  'santa ponsa': { lat: 39.5100, lng: 2.4700, label: 'Santa Ponsa' },
  'can picafort': { lat: 39.7650, lng: 3.1600, label: 'Can Picafort' },
  'cala millor': { lat: 39.6050, lng: 3.3800, label: 'Cala Millor' },
  'cala d\'or': { lat: 39.3750, lng: 3.2350, label: 'Cala d\'Or' },
  'porto cristo': { lat: 39.5400, lng: 3.3300, label: 'Porto Cristo' },
  'soller': { lat: 39.7650, lng: 2.7150, label: 'S\u00f3ller' },
  'pollensa': { lat: 39.8750, lng: 3.0150, label: 'Pollensa' },
  'inca': { lat: 39.7200, lng: 2.9100, label: 'Inca' },
  'manacor': { lat: 39.5700, lng: 3.2100, label: 'Manacor' },

  // ── Talleres / Partners ──
  'autovidal': { lat: 39.5750, lng: 2.6600, label: 'AutoVidal' },
  'fastech': { lat: 39.5500, lng: 2.7100, label: 'Fastech' },
};

// ── Professional marker icons (SVG pin with gradient and shadow) ──
const COLORS = {
  entrega: { main: '#059669', light: '#10b981', label: 'Entregas' },
  devolucion: { main: '#2563eb', light: '#3b82f6', label: 'Devoluciones' },
  transfer: { main: '#d97706', light: '#f59e0b', label: 'Transfers' },
} as const;

function createPinIcon(color: { main: string; light: string }, innerSvg: string): L.DivIcon {
  const id = color.main.replace('#', '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
    <defs>
      <filter id="ds-${id}" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
      </filter>
      <linearGradient id="g-${id}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${color.light}"/>
        <stop offset="100%" stop-color="${color.main}"/>
      </linearGradient>
    </defs>
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="url(#g-${id})" filter="url(#ds-${id})"/>
    <circle cx="14" cy="13" r="6" fill="white" opacity="0.95"/>
    <g transform="translate(8,7)">${innerSvg}</g>
  </svg>`;
  return L.divIcon({
    className: 'custom-op-marker',
    html: `<div style="display:flex;align-items:flex-end;justify-content:center">${svg}</div>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

function createClusterIcon(color: { main: string; light: string }, count: number): L.DivIcon {
  const size = Math.min(48, 32 + Math.log2(count) * 6);
  return L.divIcon({
    className: 'custom-op-cluster',
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;inset:0;background:${color.light};opacity:0.2;border-radius:50%;animation:pulse 2s infinite"></div>
      <div style="width:${size - 8}px;height:${size - 8}px;background:linear-gradient(135deg,${color.light},${color.main});border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center">
        <span style="color:white;font-size:${count > 99 ? 11 : 13}px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.3)">${count}</span>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

// Inner SVG icons for each operation type (12x12 viewBox)
const INNER_ENTREGA = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8l3-5h6l3 5v8a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="18" r="2"/><path d="M15 18h2a2 2 0 0 0 2-2v-4h-6"/><circle cx="17" cy="18" r="2"/><path d="M15 5h4l3 5"/></svg>`;
const INNER_DEVOLUCION = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
const INNER_TRANSFER = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;

const ENTREGA_ICON = createPinIcon(COLORS.entrega, INNER_ENTREGA);
const DEVOLUCION_ICON = createPinIcon(COLORS.devolucion, INNER_DEVOLUCION);
const TRANSFER_ICON = createPinIcon(COLORS.transfer, INNER_TRANSFER);

function getIconForType(tipo: TipoOperacion): L.DivIcon {
  switch (tipo) {
    case 'Entrega': return ENTREGA_ICON;
    case 'Devolución': return DEVOLUCION_ICON;
    case 'Transfer': return TRANSFER_ICON;
  }
}

function getClusterIconForOps(ops: GeocodedOperation[]): L.DivIcon {
  const entregas = ops.filter(o => o.tipoOperacion === 'Entrega').length;
  const devoluciones = ops.filter(o => o.tipoOperacion === 'Devolución').length;
  const transfers = ops.filter(o => o.tipoOperacion === 'Transfer').length;
  // Use the dominant color
  let color: { main: string; light: string } = COLORS.entrega;
  if (devoluciones > entregas && devoluciones >= transfers) color = COLORS.devolucion;
  else if (transfers > entregas && transfers > devoluciones) color = COLORS.transfer;
  return createClusterIcon(color, ops.length);
}

function getColorForType(tipo: TipoOperacion): string {
  switch (tipo) {
    case 'Entrega': return COLORS.entrega.main;
    case 'Devolución': return COLORS.devolucion.main;
    case 'Transfer': return COLORS.transfer.main;
  }
}

// ── Geocoding ──
/**
 * Normalize address for geocoding: append ", Mallorca, Spain" if not already
 * containing geographic context (same pattern as transferRouteEstimateEndpoint).
 */
function normalizeAddressForGeocoding(address: string): string {
  const lower = address.toLowerCase();
  if (
    lower.includes('mallorca') ||
    lower.includes('palma') ||
    lower.includes('baleares') ||
    lower.includes('balears') ||
    lower.includes('spain') ||
    lower.includes('españa')
  ) {
    return address;
  }
  return `${address}, Mallorca, Spain`;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const normalizedAddress = normalizeAddressForGeocoding(address);
    const response = await apiInvoke<{ ok: boolean; result: { lat: number; lng: number } | null }>(
      'geocode',
      { body: { address: normalizedAddress } }
    );
    if (response.data?.ok && response.data.result) {
      return { lat: response.data.result.lat, lng: response.data.result.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Match a location string against known fixed locations.
 * Uses the `lugar` field (short place name) rather than full address.
 * Only matches when the normalized lugar starts with or equals a known key,
 * or when the lugar is clearly just the airport/port reference.
 */
function matchKnownLocation(lugar: string): { lat: number; lng: number; label: string } | null {
  const normalized = lugar.toLowerCase().trim()
    // Remove common suffixes that don't help matching
    .replace(/\s*\(pmi\).*$/i, '')
    .replace(/\s*\(ifpm\).*$/i, '')
    .replace(/\s*07\d{3}.*$/i, '') // remove postal codes like 07611
    .trim();

  // Direct match (exact or starts with known key)
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalized === key || normalized.startsWith(key + ' ') || normalized.startsWith(key + ',')) {
      return coords;
    }
  }

  // Partial containment match — check if any known key (3+ chars) is contained in the string
  // Sort by key length descending so longer/more specific keys match first
  const sortedKeys = Object.entries(KNOWN_LOCATIONS)
    .filter(([key]) => key.length >= 5)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [key, coords] of sortedKeys) {
    if (normalized.includes(key)) {
      return coords;
    }
  }

  // Special case: strings that are clearly the airport
  // e.g. "Aeropuerto de Palma de Mallorca" or "Aeropuerto Palma de Mallorca"
  if (/^aeropuerto\b/.test(normalized) && !normalized.includes('hotel')) {
    return KNOWN_LOCATIONS['aeropuerto'];
  }

  return null;
}

// ── Haversine distance ──
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Cluster operations by proximity ──
function clusterOperations(ops: GeocodedOperation[]): ClusteredGroup[] {
  const groups: ClusteredGroup[] = [];
  const used = new Set<number>();

  for (let i = 0; i < ops.length; i++) {
    if (used.has(i)) continue;
    const cluster: GeocodedOperation[] = [ops[i]];
    used.add(i);

    for (let j = i + 1; j < ops.length; j++) {
      if (used.has(j)) continue;
      const dist = haversineKm(ops[i].lat, ops[i].lng, ops[j].lat, ops[j].lng);
      if (dist <= CLUSTER_RADIUS_KM) {
        cluster.push(ops[j]);
        used.add(j);
      }
    }

    // Use average position for the cluster
    const avgLat = cluster.reduce((s, o) => s + o.lat, 0) / cluster.length;
    const avgLng = cluster.reduce((s, o) => s + o.lng, 0) / cluster.length;

    // Determine label
    const knownMatch = matchKnownLocation(cluster[0].lugar || '');
    const label = knownMatch?.label || cluster[0].lugar || cluster[0].direccion || 'Ubicación';

    groups.push({ lat: avgLat, lng: avgLng, operations: cluster, label });
  }

  return groups;
}

// ── Auto-fit bounds ──
function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const hasFit = useRef(false);
  const prevCount = useRef(0);

  useEffect(() => {
    if (points.length === 0) return;
    // Re-fit when points change
    if (points.length === prevCount.current && hasFit.current) return;
    prevCount.current = points.length;
    hasFit.current = true;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points, map]);

  return null;
}

// ── Format time helper ──
function formatTime(isoStr: string | null): string {
  if (!isoStr) return '—';
  try {
    return format(parseISO(isoStr), 'HH:mm', { locale: es });
  } catch {
    return '—';
  }
}

// ── Main Component ──
export function OperationsMapView({ operations, isLoading, organizationId, fullPage, dateControls, onMarkCompleted }: OperationsMapViewProps) {
  const [geocodedOps, setGeocodedOps] = useState<GeocodedOperation[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState({ done: 0, total: 0 });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [unresolvedOps, setUnresolvedOps] = useState<MapOperation[]>([]);
  const [showUnresolved, setShowUnresolved] = useState(false);
  const [manualEditOp, setManualEditOp] = useState<MapOperation | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [filterEntregas, setFilterEntregas] = useState(true);
  const [filterDevoluciones, setFilterDevoluciones] = useState(true);
  const [filterTransfers, setFilterTransfers] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [filterDriver, setFilterDriver] = useState<string | null>(null);
  const geocodeCacheRef = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());
  const dbCacheLoadedRef = useRef(false);

  // Filter out completed operations (they are already done, not relevant on the map)
  const activeOperations = useMemo(() => {
    if (!hideCompleted) return operations;
    return operations.filter(op => !op.isCompleted);
  }, [operations, hideCompleted]);

  // Load DB cache on mount (batch lookup)
  useEffect(() => {
    if (!organizationId || activeOperations.length === 0) return;
    if (dbCacheLoadedRef.current) return;

    async function loadDbCache() {
      // Collect all unique address keys that need geocoding
      const addressKeys: string[] = [];
      for (const op of activeOperations) {
        const fullAddress = op.direccion || op.lugar || '';
        const cacheKey = fullAddress.toLowerCase().trim();
        if (cacheKey) addressKeys.push(cacheKey);
      }
      if (addressKeys.length === 0) return;

      const uniqueKeys = Array.from(new Set(addressKeys));
      try {
        const response = await apiInvoke<{ ok: boolean; results: Record<string, { lat: number; lng: number }> }>(
          'geocode-cache/lookup',
          { body: { organization_id: organizationId, address_keys: uniqueKeys } }
        );
        if (response.data?.ok && response.data.results) {
          const cache = geocodeCacheRef.current;
          for (const [key, coords] of Object.entries(response.data.results)) {
            cache.set(key, coords);
          }
          dbCacheLoadedRef.current = true;
        }
      } catch {
        // Silently fail — will fall back to API geocoding
      }
    }

    loadDbCache();
  }, [organizationId, activeOperations]);

  // Geocode all active operations
  useEffect(() => {
    if (activeOperations.length === 0) {
      setGeocodedOps([]);
      setUnresolvedOps([]);
      return;
    }

    let cancelled = false;

    async function geocodeAll() {
      setIsGeocoding(true);
      const results: GeocodedOperation[] = [];
      const unresolved: MapOperation[] = [];
      const newlyCached: Array<{ address_key: string; lat: number; lng: number }> = [];
      const total = activeOperations.length;
      setGeocodingProgress({ done: 0, total });

      for (let i = 0; i < activeOperations.length; i++) {
        if (cancelled) return;
        const op = activeOperations[i];
        // Use lugar (short place name) for known-location matching
        const lugarKey = (op.lugar || '').toLowerCase().trim();
        // Use the best available address for geocoding (prefer full address)
        const fullAddress = op.direccion || op.lugar || '';
        const cacheKey = fullAddress.toLowerCase().trim();

        if (!lugarKey && !cacheKey) {
          unresolved.push(op);
          setGeocodingProgress({ done: i + 1, total });
          continue;
        }

        // Check known locations using the short place name (lugar)
        if (lugarKey) {
          const known = matchKnownLocation(lugarKey);
          if (known) {
            results.push({ ...op, lat: known.lat, lng: known.lng });
            setGeocodingProgress({ done: i + 1, total });
            continue;
          }
        }

        // Also check known locations against the full address (direccion)
        if (cacheKey && cacheKey !== lugarKey) {
          const knownFromAddress = matchKnownLocation(cacheKey);
          if (knownFromAddress) {
            results.push({ ...op, lat: knownFromAddress.lat, lng: knownFromAddress.lng });
            setGeocodingProgress({ done: i + 1, total });
            continue;
          }
        }

        if (!cacheKey) {
          unresolved.push(op);
          setGeocodingProgress({ done: i + 1, total });
          continue;
        }

        // Check in-memory cache (includes DB cache loaded earlier)
        const cache = geocodeCacheRef.current;
        if (cache.has(cacheKey)) {
          const cached = cache.get(cacheKey);
          if (cached) {
            results.push({ ...op, lat: cached.lat, lng: cached.lng });
          } else {
            unresolved.push(op);
          }
          setGeocodingProgress({ done: i + 1, total });
          continue;
        }

        // Geocode via API using the full address
        const coords = await geocodeAddress(fullAddress);
        cache.set(cacheKey, coords);
        if (coords) {
          results.push({ ...op, lat: coords.lat, lng: coords.lng });
          newlyCached.push({ address_key: cacheKey, lat: coords.lat, lng: coords.lng });
        } else {
          unresolved.push(op);
        }
        setGeocodingProgress({ done: i + 1, total });

        // Small delay to avoid rate limiting
        if (i < operations.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      if (!cancelled) {
        setGeocodedOps(results);
        setUnresolvedOps(unresolved);
        setIsGeocoding(false);

        // Save newly geocoded addresses to DB cache
        if (newlyCached.length > 0 && organizationId) {
          apiInvoke('geocode-cache/save', {
            body: { organization_id: organizationId, entries: newlyCached }
          }).catch(() => { /* silent */ });
        }
      }
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [activeOperations, organizationId]);

  // Handle manual coordinate save
  const handleManualSave = async () => {
    if (!manualEditOp || !organizationId) return;
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) return;

    setSavingManual(true);
    const addressKey = (manualEditOp.direccion || manualEditOp.lugar || '').toLowerCase().trim();
    try {
      await apiInvoke('geocode-cache/manual-set', {
        body: { organization_id: organizationId, address_key: addressKey, lat, lng }
      });
      // Update local cache and re-geocode
      geocodeCacheRef.current.set(addressKey, { lat, lng });
      setManualEditOp(null);
      setManualLat('');
      setManualLng('');
      // Trigger re-geocode by updating unresolved list
      setUnresolvedOps(prev => prev.filter(o => o.id !== manualEditOp.id));
      setGeocodedOps(prev => [...prev, { ...manualEditOp, lat, lng }]);
    } catch {
      // silent
    } finally {
      setSavingManual(false);
    }
  };

  // Filter geocoded operations by type
  // Get unique drivers from all operations for the filter dropdown
  const availableDrivers = useMemo(() => {
    const drivers = new Map<string, string>();
    operations.forEach(op => {
      if (op.assignedRentalName) {
        drivers.set(op.assignedRentalName, op.assignedRentalName);
      }
    });
    return Array.from(drivers.values()).sort();
  }, [operations]);

  const filteredGeocodedOps = useMemo(() => {
    return geocodedOps.filter(op => {
      if (op.tipoOperacion === 'Entrega' && !filterEntregas) return false;
      if (op.tipoOperacion === 'Devoluci\u00f3n' && !filterDevoluciones) return false;
      if (op.tipoOperacion === 'Transfer' && !filterTransfers) return false;
      if (filterDriver && op.assignedRentalName !== filterDriver) return false;
      return true;
    });
  }, [geocodedOps, filterEntregas, filterDevoluciones, filterTransfers, filterDriver]);

  // Cluster the filtered geocoded operations
  const clusters = useMemo(() => clusterOperations(filteredGeocodedOps), [filteredGeocodedOps]);

  // Stats (based on active operations only)
  const stats = useMemo(() => {
    const entregas = activeOperations.filter(o => o.tipoOperacion === 'Entrega').length;
    const devoluciones = activeOperations.filter(o => o.tipoOperacion === 'Devolución').length;
    const transfers = activeOperations.filter(o => o.tipoOperacion === 'Transfer').length;
    const completedCount = operations.filter(o => o.isCompleted).length;
    return { entregas, devoluciones, transfers, total: activeOperations.length, completedCount };
  }, [activeOperations, operations]);

  const mapHeight = fullPage ? 'h-full' : 'h-[600px]';
  const containerClass = fullPage ? 'flex flex-col h-full' : 'flex flex-col gap-4';

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${mapHeight} bg-muted/30 ${fullPage ? '' : 'rounded-xl border'}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando operaciones...</p>
        </div>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className={`flex items-center justify-center ${mapHeight} bg-muted/30 ${fullPage ? '' : 'rounded-xl border'}`}>
        {dateControls && (
          <div className="absolute top-4 left-4 z-[1000]">
            {dateControls}
          </div>
        )}
        <div className="flex flex-col items-center gap-3">
          <MapPin className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay operaciones para mostrar en el mapa</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {fullPage ? (
        /* ── Full-page mode: map fills everything, controls overlaid ── */
        <div className="relative flex-1 min-h-0">
          <MapContainer
            center={MALLORCA_CENTER}
            zoom={MALLORCA_ZOOM}
            className="h-full w-full absolute inset-0"
            zoomControl={false}
          >
            {satelliteMode ? (
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            ) : (
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
            )}

            {filteredGeocodedOps.length > 0 && (
              <FitBounds points={filteredGeocodedOps.map(o => ({ lat: o.lat, lng: o.lng }))} />
            )}

            {clusters.map((cluster, idx) => {
              const isSingle = cluster.operations.length === 1;
              const op = cluster.operations[0];
              const icon = isSingle
                ? getIconForType(op.tipoOperacion)
                : getClusterIconForOps(cluster.operations);

              return (
                <Marker
                  key={`cluster-${idx}`}
                  position={[cluster.lat, cluster.lng]}
                  icon={icon}
                >
                  <Popup maxWidth={320} minWidth={240}>
                    <div className="p-1">
                      {isSingle ? (
                        <SingleOperationPopup op={op} onMarkCompleted={onMarkCompleted} />
                      ) : (
                        <ClusterPopup cluster={cluster} />
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map controls - top right */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5">
            {/* Satellite toggle */}
            <button
              onClick={() => setSatelliteMode(!satelliteMode)}
              className={cn(
                'w-8 h-8 rounded shadow border flex items-center justify-center transition-colors',
                satelliteMode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
              title={satelliteMode ? 'Vista mapa' : 'Vista satélite'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>
            </button>
          </div>

          {/* Date controls - top left */}
          {dateControls && (
            <div className="absolute top-4 left-4 z-[1000]">
              {dateControls}
            </div>
          )}

          {/* Legend + filters - top center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-lg">
              {/* Entrega filter */}
              <button
                onClick={() => setFilterEntregas(!filterEntregas)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  filterEntregas
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-50 text-gray-400 border border-gray-100 line-through'
                )}
                title={filterEntregas ? 'Ocultar entregas' : 'Mostrar entregas'}
              >
                <div className={cn('w-3 h-3 rounded-full transition-colors', filterEntregas ? 'bg-emerald-500' : 'bg-gray-300')} />
                <span>Entregas</span>
                <span className="font-bold">{stats.entregas}</span>
              </button>

              {/* Devolucion filter */}
              <button
                onClick={() => setFilterDevoluciones(!filterDevoluciones)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  filterDevoluciones
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-400 border border-gray-100 line-through'
                )}
                title={filterDevoluciones ? 'Ocultar devoluciones' : 'Mostrar devoluciones'}
              >
                <div className={cn('w-3 h-3 rounded-full transition-colors', filterDevoluciones ? 'bg-blue-500' : 'bg-gray-300')} />
                <span>Devoluciones</span>
                <span className="font-bold">{stats.devoluciones}</span>
              </button>

              {/* Transfer filter */}
              {stats.transfers > 0 && (
                <button
                  onClick={() => setFilterTransfers(!filterTransfers)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                    filterTransfers
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-gray-50 text-gray-400 border border-gray-100 line-through'
                  )}
                  title={filterTransfers ? 'Ocultar transfers' : 'Mostrar transfers'}
                >
                  <div className={cn('w-3 h-3 rounded-full transition-colors', filterTransfers ? 'bg-amber-500' : 'bg-gray-300')} />
                  <span>Transfers</span>
                  <span className="font-bold">{stats.transfers}</span>
                </button>
              )}

              {/* Separator */}
              <div className="w-px h-5 bg-gray-200 mx-1" />

              {/* Hide completed toggle */}
              <button
                onClick={() => setHideCompleted(!hideCompleted)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  hideCompleted
                    ? 'bg-gray-50 text-gray-600 border border-gray-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                )}
                title={hideCompleted ? 'Mostrar completadas' : 'Ocultar completadas'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>{stats.completedCount} hechas</span>
              </button>

              {/* Driver filter */}
              {availableDrivers.length > 0 && (
                <>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <select
                    value={filterDriver || ''}
                    onChange={(e) => setFilterDriver(e.target.value || null)}
                    className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white/90 text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[120px]"
                    title="Filtrar por conductor"
                  >
                    <option value="">Todos</option>
                    {availableDrivers.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </>
              )}

              {/* Geocoded counter */}
              <div className="px-2 py-1 text-xs text-gray-500 font-mono">
                {geocodedOps.length}/{activeOperations.length}
              </div>
            </div>
          </div>

          {/* Geocoding progress - bottom */}
          {isGeocoding && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000]">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg border shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Geolocalizando... {geocodingProgress.done}/{geocodingProgress.total}
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${geocodingProgress.total > 0 ? (geocodingProgress.done / geocodingProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Unresolved addresses - bottom left */}
          {!isGeocoding && unresolvedOps.length > 0 && (
            <div className="absolute bottom-4 left-4 z-[1000] max-w-sm">
              <div className="bg-white/95 backdrop-blur-sm border border-amber-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-amber-800">
                      {unresolvedOps.length} sin resolver
                    </span>
                  </div>
                  <button
                    onClick={() => setShowUnresolved(!showUnresolved)}
                    className="text-xs text-amber-700 hover:text-amber-900 font-medium underline"
                  >
                    {showUnresolved ? 'Ocultar' : 'Ver'}
                  </button>
                </div>

                {showUnresolved && (
                  <div className="mt-2 space-y-1.5 max-h-[180px] overflow-y-auto">
                    {unresolvedOps.map((op) => (
                      <div key={op.id} className="flex items-center justify-between gap-2 py-1 px-1.5 bg-amber-50 rounded border border-amber-100">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-800 truncate block">
                            {op.clienteNombre} {op.clienteApellido}
                          </span>
                          <p className="text-xs text-gray-500 truncate">
                            {op.direccion || op.lugar || 'Sin dirección'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setManualEditOp(op);
                            setManualLat('');
                            setManualLng('');
                          }}
                          className="shrink-0 text-xs px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium"
                        >
                          Corregir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual correction panel - bottom right */}
          {manualEditOp && (
            <div className="absolute bottom-4 right-4 z-[1000] w-80">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Corregir ubicación</h4>
                  <button onClick={() => setManualEditOp(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                </div>
                <p className="text-xs text-gray-600 mb-3 truncate">
                  <strong>{manualEditOp.clienteNombre} {manualEditOp.clienteApellido}</strong> — {manualEditOp.direccion || manualEditOp.lugar || 'Sin dirección'}
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Lat</label>
                    <input
                      type="number"
                      step="any"
                      value={manualLat}
                      onChange={e => setManualLat(e.target.value)}
                      placeholder="39.5696"
                      className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Lng</label>
                    <input
                      type="number"
                      step="any"
                      value={manualLng}
                      onChange={e => setManualLng(e.target.value)}
                      placeholder="2.6502"
                      className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={handleManualSave}
                    disabled={savingManual || !manualLat || !manualLng}
                    className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingManual ? '...' : 'OK'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Google Maps → clic derecho → Coordenadas
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Normal mode: existing layout with fixed height map ── */
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-sm">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-800">{stats.entregas} Entregas</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="font-medium text-blue-800">{stats.devoluciones} Devoluciones</span>
            </div>
            {stats.transfers > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-800">{stats.transfers} Transfers</span>
              </div>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              {geocodedOps.length}/{operations.length} ubicaciones resueltas
            </div>
          </div>

          {/* Geocoding progress */}
          {isGeocoding && (
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Geolocalizando direcciones... {geocodingProgress.done}/{geocodingProgress.total}
              </span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${geocodingProgress.total > 0 ? (geocodingProgress.done / geocodingProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Unresolved addresses indicator */}
          {!isGeocoding && unresolvedOps.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">
                    {unresolvedOps.length} direcci{unresolvedOps.length === 1 ? 'ón' : 'ones'} no resuelta{unresolvedOps.length === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  onClick={() => setShowUnresolved(!showUnresolved)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  {showUnresolved ? 'Ocultar' : 'Ver detalles'}
                </button>
              </div>

              {showUnresolved && (
                <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto">
                  {unresolvedOps.map((op) => (
                    <div key={op.id} className="flex items-center justify-between gap-2 py-1.5 px-2 bg-white rounded border border-amber-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-block w-2 h-2 rounded-full shrink-0',
                            op.tipoOperacion === 'Entrega' ? 'bg-emerald-500' :
                            op.tipoOperacion === 'Devolución' ? 'bg-blue-500' : 'bg-amber-500'
                          )} />
                          <span className="text-xs font-medium text-gray-800 truncate">
                            {op.clienteNombre} {op.clienteApellido}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5 ml-4">
                          {op.direccion || op.lugar || 'Sin dirección'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setManualEditOp(op);
                          setManualLat('');
                          setManualLng('');
                        }}
                        className="shrink-0 text-xs px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium transition-colors"
                      >
                        Corregir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual coordinate correction dialog */}
          {manualEditOp && (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Corregir ubicación manualmente</h4>
                <button onClick={() => setManualEditOp(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                <strong>{manualEditOp.clienteNombre} {manualEditOp.clienteApellido}</strong> — {manualEditOp.direccion || manualEditOp.lugar || 'Sin dirección'}
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                    placeholder="39.5696"
                    className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={e => setManualLng(e.target.value)}
                    placeholder="2.6502"
                    className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleManualSave}
                  disabled={savingManual || !manualLat || !manualLng}
                  className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingManual ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Puedes obtener las coordenadas desde Google Maps (clic derecho → Coordenadas)
              </p>
            </div>
          )}

          {/* Map */}
          <div className="relative h-[600px] rounded-xl overflow-hidden border shadow-sm">
            <MapContainer
              center={MALLORCA_CENTER}
              zoom={MALLORCA_ZOOM}
              className="h-full w-full"
              zoomControl={true}
            >
              {satelliteMode ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
              )}

              {filteredGeocodedOps.length > 0 && (
                <FitBounds points={filteredGeocodedOps.map(o => ({ lat: o.lat, lng: o.lng }))} />
              )}

              {clusters.map((cluster, idx) => {
                const isSingle = cluster.operations.length === 1;
                const op = cluster.operations[0];
                const icon = isSingle
                  ? getIconForType(op.tipoOperacion)
                  : getClusterIconForOps(cluster.operations);

                return (
                  <Marker
                    key={`cluster-${idx}`}
                    position={[cluster.lat, cluster.lng]}
                    icon={icon}
                  >
                    <Popup maxWidth={320} minWidth={240}>
                      <div className="p-1">
                        {isSingle ? (
                          <SingleOperationPopup op={op} onMarkCompleted={onMarkCompleted} />
                        ) : (
                          <ClusterPopup cluster={cluster} />
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Popup for a single operation ──
function SingleOperationPopup({ op, onMarkCompleted }: { op: GeocodedOperation; onMarkCompleted?: (reservationId: string, tipo: 'Entrega' | 'Devoluci\u00f3n' | 'Transfer') => void }) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.direccion || op.lugar || '')}`;
  const color = getColorForType(op.tipoOperacion);

  return (
    <div className="space-y-2.5">
      {/* Header: type badge + reservation number */}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ background: color }}
        >
          {op.tipoOperacion === 'Entrega' && <Truck className="h-3 w-3" />}
          {op.tipoOperacion === 'Devoluci\u00f3n' && <RotateCcw className="h-3 w-3" />}
          {op.tipoOperacion === 'Transfer' && <Navigation className="h-3 w-3" />}
          {op.tipoOperacion}
        </span>
        <span className="text-xs text-gray-500 font-mono">N\u00ba {op.externalReservationId}</span>
      </div>

      {/* Client info */}
      <div className="space-y-1.5">
        <p className="font-semibold text-sm text-gray-900">
          {op.clienteNombre} {op.clienteApellido}
        </p>
        
        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Clock className="h-3 w-3 text-gray-400" />
          <span className="font-medium">{formatTime(op.confirmedDatetime || op.fechaHora)}</span>
        </div>

        {/* Vehicle plate */}
        {op.vehiclePlate && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><rect x="1" y="6" width="22" height="12" rx="2"/><line x1="1" y1="12" x2="23" y2="12"/></svg>
            <span className="font-mono font-medium bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded text-[11px]">{op.vehiclePlate}</span>
          </div>
        )}

        {/* Assigned driver */}
        {op.assignedRentalName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>{op.assignedRentalName}</span>
          </div>
        )}

        {/* Address */}
        {(op.direccion || op.lugar) && (
          <p className="text-xs text-gray-500 line-clamp-2">{op.direccion || op.lugar}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-medium transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Google Maps
        </a>
        {onMarkCompleted && !op.isCompleted && (
          <button
            onClick={() => onMarkCompleted(op.reservationId, op.tipoOperacion as 'Entrega' | 'Devoluci\u00f3n' | 'Transfer')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Completar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Popup for a cluster of operations ──
function ClusterPopup({ cluster }: { cluster: ClusteredGroup }) {
  const entregas = cluster.operations.filter(o => o.tipoOperacion === 'Entrega');
  const devoluciones = cluster.operations.filter(o => o.tipoOperacion === 'Devolución');
  const transfers = cluster.operations.filter(o => o.tipoOperacion === 'Transfer');
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${cluster.lat},${cluster.lng}`;

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-gray-900">{cluster.label}</h4>
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full font-medium">
          {cluster.operations.length} ops
        </span>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        {entregas.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <Truck className="h-3 w-3" /> {entregas.length} entrega{entregas.length > 1 ? 's' : ''}
          </span>
        )}
        {devoluciones.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <RotateCcw className="h-3 w-3" /> {devoluciones.length} devolución{devoluciones.length > 1 ? 'es' : ''}
          </span>
        )}
        {transfers.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Navigation className="h-3 w-3" /> {transfers.length} transfer{transfers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Individual operations list */}
      <div className="space-y-1 border-t pt-2">
        {cluster.operations.map((op, i) => {
          const color = getColorForType(op.tipoOperacion);
          return (
            <div key={i} className="flex items-center gap-2 py-1.5 px-1.5 rounded hover:bg-gray-50">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-800 truncate block">
                  {op.clienteNombre} {op.clienteApellido}
                </span>
                {op.vehiclePlate && (
                  <span className="text-[10px] font-mono text-gray-500">{op.vehiclePlate}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0 font-medium">{formatTime(op.confirmedDatetime || op.fechaHora)}</span>
            </div>
          );
        })}
      </div>

      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-medium transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir en Google Maps
      </a>
    </div>
  );
}
