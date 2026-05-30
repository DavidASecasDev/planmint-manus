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
}

interface OperationsMapViewProps {
  operations: MapOperation[];
  isLoading?: boolean;
  organizationId?: string;
  fullPage?: boolean;
  dateControls?: React.ReactNode;
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
  aeropuerto: { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },
  'aeropuerto de palma': { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },
  'aeropuerto palma': { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },
  pmi: { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },
  'parking g': { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },
  'clubs to hire': { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },
  'transport meeting point': { lat: 39.5532, lng: 2.7290, label: 'Aeropuerto de Palma' },

  // ── Terminal de Cruceros / Puerto ──
  'terminal de cruceros': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'terminal de cruceros de palma': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'estacion maritima': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'estacion maritima palma': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'puerto de palma': { lat: 39.5600, lng: 2.6350, label: 'Terminal de Cruceros' },
  'puerto portals': { lat: 39.5250, lng: 2.5700, label: 'Puerto Portals' },

  // ── Oficina Azul Cars (Carrer Canal de Sant Jordi 29, local 3, 07199 Palma) ──
  'oficina azul': { lat: 39.5392, lng: 2.7418, label: 'Oficina Azul Cars - Son Oms' },
  'oficina azul cars': { lat: 39.5392, lng: 2.7418, label: 'Oficina Azul Cars - Son Oms' },
  'oficina azul cars - polígono son oms': { lat: 39.5392, lng: 2.7418, label: 'Oficina Azul Cars - Son Oms' },
  base: { lat: 39.5392, lng: 2.7418, label: 'Oficina Azul Cars - Son Oms' },

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
  'alc\u00fadia': { lat: 39.8530, lng: 3.1210, label: 'Alc\u00fadia' },
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

// ── Marker icons ──
function createMarkerIcon(color: string, count?: number): L.DivIcon {
  const size = count && count > 1 ? 36 : 28;
  const badge = count && count > 1
    ? `<span style="position:absolute;top:-6px;right:-6px;background:#1f2937;color:white;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${count}</span>`
    : '';
  return L.divIcon({
    className: 'custom-op-marker',
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
      <div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      ${badge}
    </div>`,
    iconSize: [size + 12, size + 12],
    iconAnchor: [(size + 12) / 2, (size + 12) / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

const ENTREGA_ICON = createMarkerIcon('#10b981'); // green
const DEVOLUCION_ICON = createMarkerIcon('#3b82f6'); // blue
const TRANSFER_ICON = createMarkerIcon('#f59e0b'); // amber

function getIconForType(tipo: TipoOperacion): L.DivIcon {
  switch (tipo) {
    case 'Entrega': return ENTREGA_ICON;
    case 'Devolución': return DEVOLUCION_ICON;
    case 'Transfer': return TRANSFER_ICON;
  }
}

function getColorForType(tipo: TipoOperacion): string {
  switch (tipo) {
    case 'Entrega': return '#10b981';
    case 'Devolución': return '#3b82f6';
    case 'Transfer': return '#f59e0b';
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
export function OperationsMapView({ operations, isLoading, organizationId, fullPage, dateControls }: OperationsMapViewProps) {
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
  const geocodeCacheRef = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());
  const dbCacheLoadedRef = useRef(false);

  // Load DB cache on mount (batch lookup)
  useEffect(() => {
    if (!organizationId || operations.length === 0) return;
    if (dbCacheLoadedRef.current) return;

    async function loadDbCache() {
      // Collect all unique address keys that need geocoding
      const addressKeys: string[] = [];
      for (const op of operations) {
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
  }, [organizationId, operations]);

  // Geocode all operations
  useEffect(() => {
    if (operations.length === 0) {
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
      const total = operations.length;
      setGeocodingProgress({ done: 0, total });

      for (let i = 0; i < operations.length; i++) {
        if (cancelled) return;
        const op = operations[i];
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
  }, [operations, organizationId]);

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
  const filteredGeocodedOps = useMemo(() => {
    return geocodedOps.filter(op => {
      if (op.tipoOperacion === 'Entrega' && !filterEntregas) return false;
      if (op.tipoOperacion === 'Devolución' && !filterDevoluciones) return false;
      if (op.tipoOperacion === 'Transfer' && !filterTransfers) return false;
      return true;
    });
  }, [geocodedOps, filterEntregas, filterDevoluciones, filterTransfers]);

  // Cluster the filtered geocoded operations
  const clusters = useMemo(() => clusterOperations(filteredGeocodedOps), [filteredGeocodedOps]);

  // Stats
  const stats = useMemo(() => {
    const entregas = operations.filter(o => o.tipoOperacion === 'Entrega').length;
    const devoluciones = operations.filter(o => o.tipoOperacion === 'Devolución').length;
    const transfers = operations.filter(o => o.tipoOperacion === 'Transfer').length;
    return { entregas, devoluciones, transfers, total: operations.length };
  }, [operations]);

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
                : createMarkerIcon(
                    cluster.operations.some(o => o.tipoOperacion === 'Entrega') ? '#10b981' : '#3b82f6',
                    cluster.operations.length
                  );

              return (
                <Marker
                  key={`cluster-${idx}`}
                  position={[cluster.lat, cluster.lng]}
                  icon={icon}
                >
                  <Popup maxWidth={320} minWidth={240}>
                    <div className="p-1">
                      {isSingle ? (
                        <SingleOperationPopup op={op} />
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

          {/* Stats bar + filters - top center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
            <button
              onClick={() => setFilterEntregas(!filterEntregas)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-sm border rounded-full text-xs shadow-sm transition-all cursor-pointer',
                filterEntregas
                  ? 'bg-white/90 border-emerald-300'
                  : 'bg-white/50 border-gray-200 opacity-50'
              )}
              title={filterEntregas ? 'Ocultar entregas' : 'Mostrar entregas'}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-800">{stats.entregas}</span>
            </button>
            <button
              onClick={() => setFilterDevoluciones(!filterDevoluciones)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-sm border rounded-full text-xs shadow-sm transition-all cursor-pointer',
                filterDevoluciones
                  ? 'bg-white/90 border-blue-300'
                  : 'bg-white/50 border-gray-200 opacity-50'
              )}
              title={filterDevoluciones ? 'Ocultar devoluciones' : 'Mostrar devoluciones'}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="font-medium text-blue-800">{stats.devoluciones}</span>
            </button>
            {stats.transfers > 0 && (
              <button
                onClick={() => setFilterTransfers(!filterTransfers)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-sm border rounded-full text-xs shadow-sm transition-all cursor-pointer',
                  filterTransfers
                    ? 'bg-white/90 border-amber-300'
                    : 'bg-white/50 border-gray-200 opacity-50'
                )}
                title={filterTransfers ? 'Ocultar transfers' : 'Mostrar transfers'}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-800">{stats.transfers}</span>
              </button>
            )}
            <div className="px-2.5 py-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full text-xs shadow-sm text-muted-foreground">
              {geocodedOps.length}/{operations.length}
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
                  : createMarkerIcon(
                      cluster.operations.some(o => o.tipoOperacion === 'Entrega') ? '#10b981' : '#3b82f6',
                      cluster.operations.length
                    );

                return (
                  <Marker
                    key={`cluster-${idx}`}
                    position={[cluster.lat, cluster.lng]}
                    icon={icon}
                  >
                    <Popup maxWidth={320} minWidth={240}>
                      <div className="p-1">
                        {isSingle ? (
                          <SingleOperationPopup op={op} />
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
function SingleOperationPopup({ op }: { op: GeocodedOperation }) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.direccion || op.lugar || '')}`;
  const color = getColorForType(op.tipoOperacion);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ background: color }}
        >
          {op.tipoOperacion === 'Entrega' && <Truck className="h-3 w-3" />}
          {op.tipoOperacion === 'Devolución' && <RotateCcw className="h-3 w-3" />}
          {op.tipoOperacion === 'Transfer' && <Navigation className="h-3 w-3" />}
          {op.tipoOperacion}
        </span>
        <span className="text-xs text-gray-500 font-mono">Nº {op.externalReservationId}</span>
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-sm text-gray-900">
          {op.clienteNombre} {op.clienteApellido}
        </p>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Clock className="h-3 w-3" />
          <span>{formatTime(op.confirmedDatetime || op.fechaHora)}</span>
        </div>
        {(op.direccion || op.lugar) && (
          <p className="text-xs text-gray-500 line-clamp-2">{op.direccion || op.lugar}</p>
        )}
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
      <div className="space-y-1.5 border-t pt-2">
        {cluster.operations.map((op, i) => {
          const color = getColorForType(op.tipoOperacion);
          return (
            <div key={i} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-gray-50">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-800 truncate block">
                  {op.clienteNombre} {op.clienteApellido}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono shrink-0">Nº {op.externalReservationId}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatTime(op.confirmedDatetime || op.fechaHora)}</span>
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
