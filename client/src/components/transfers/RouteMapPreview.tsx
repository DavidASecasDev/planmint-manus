/**
 * RouteMapPreview — Mini-map showing the route between pickup and dropoff locations.
 * Uses Leaflet + OpenStreetMap tiles + OSRM for routing (same approach as LiveMap).
 * Falls back to the backend /api/geocode endpoint for geocoding addresses.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiInvoke } from '@/lib/apiClient';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──
interface RouteMapPreviewProps {
  pickupLocation: string;
  dropoffLocation: string;
  height?: string;
  className?: string;
}

interface GeocodedPoint {
  lat: number;
  lng: number;
}

interface RouteData {
  positions: [number, number][];
  distanceKm: number;
  durationMinutes: number;
}

// ── Custom marker icons ──
const pickupIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const dropoffIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ── Auto-fit bounds component ──
function FitBounds({ points }: { points: GeocodedPoint[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (points.length < 2 || hasFit.current) return;
    hasFit.current = true;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [points, map]);

  return null;
}

// ── Geocode address using our backend ──
async function geocodeAddress(address: string): Promise<GeocodedPoint | null> {
  try {
    const response = await apiInvoke<{ ok: boolean; result: { lat: number; lng: number } | null }>(
      '/api/geocode',
      { body: { address } }
    );
    if (response.data?.ok && response.data.result) {
      return { lat: response.data.result.lat, lng: response.data.result.lng };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fetch route from OSRM (same as LiveMap) ──
async function fetchRoute(from: GeocodedPoint, to: GeocodedPoint): Promise<RouteData | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const positions: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]] as [number, number]
    );

    return {
      positions,
      distanceKm: +(route.distance / 1000).toFixed(1),
      durationMinutes: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

// ── Main Component ──
export function RouteMapPreview({ pickupLocation, dropoffLocation, height = '200px', className }: RouteMapPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickupPoint, setPickupPoint] = useState<GeocodedPoint | null>(null);
  const [dropoffPoint, setDropoffPoint] = useState<GeocodedPoint | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const abortRef = useRef(false);
  const prevLocationsRef = useRef<string>('');

  const loadRoute = useCallback(async () => {
    // Skip if locations haven't changed
    const locKey = `${pickupLocation}|${dropoffLocation}`;
    if (locKey === prevLocationsRef.current) return;
    prevLocationsRef.current = locKey;

    // Validate inputs
    if (!pickupLocation || !dropoffLocation || pickupLocation.trim().length < 3 || dropoffLocation.trim().length < 3) {
      setLoading(false);
      setError(null);
      setPickupPoint(null);
      setDropoffPoint(null);
      setRoute(null);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);

    // Geocode both addresses
    const [pickup, dropoff] = await Promise.all([
      geocodeAddress(pickupLocation),
      geocodeAddress(dropoffLocation),
    ]);

    if (abortRef.current) return;

    if (!pickup || !dropoff) {
      setLoading(false);
      setError('No se pudieron localizar las direcciones');
      return;
    }

    setPickupPoint(pickup);
    setDropoffPoint(dropoff);

    // Fetch route
    const routeData = await fetchRoute(pickup, dropoff);
    if (abortRef.current) return;

    if (!routeData) {
      setLoading(false);
      setError('No se pudo calcular la ruta');
      return;
    }

    setRoute(routeData);
    setLoading(false);
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    loadRoute();
    return () => {
      abortRef.current = true;
    };
  }, [loadRoute]);

  // Not enough data to show map
  if (!pickupLocation || !dropoffLocation || pickupLocation.trim().length < 3 || dropoffLocation.trim().length < 3) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-lg border bg-muted/30', className)}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando mapa...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-lg border bg-muted/30', className)}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // No data
  if (!pickupPoint || !dropoffPoint) return null;

  const center: [number, number] = [
    (pickupPoint.lat + dropoffPoint.lat) / 2,
    (pickupPoint.lng + dropoffPoint.lng) / 2,
  ];

  return (
    <div className={cn('rounded-lg border overflow-hidden', className)} style={{ height }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={[pickupPoint, dropoffPoint]} />
        <Marker position={[pickupPoint.lat, pickupPoint.lng]} icon={pickupIcon} />
        <Marker position={[dropoffPoint.lat, dropoffPoint.lng]} icon={dropoffIcon} />
        {route && (
          <Polyline
            positions={route.positions}
            pathOptions={{
              color: '#3b82f6',
              weight: 3,
              opacity: 0.8,
            }}
          />
        )}
      </MapContainer>
      {/* Route info overlay */}
      {route && (
        <div className="absolute bottom-1 left-1 bg-background/90 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground border shadow-sm">
          {route.distanceKm} km · {route.durationMinutes} min
        </div>
      )}
    </div>
  );
}
