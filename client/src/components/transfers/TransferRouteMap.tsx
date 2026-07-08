import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Route, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface TransferRouteMapProps {
  pickupLocation: string;
  dropoffLocation: string;
  pickupPlaceId?: string | null;
  dropoffPlaceId?: string | null;
}

// Decode Google Maps encoded polyline
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Custom marker icons
const pickupIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width:12px;height:12px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const dropoffIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Auto-fit bounds component
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, points]);
  return null;
}

async function fetchDirections(params: { origin: string; destination: string; originPlaceId?: string; destinationPlaceId?: string }) {
  const url = new URL('/api/trpc/maps.directions', window.location.origin);
  url.searchParams.set('input', JSON.stringify(params));
  const res = await fetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch directions');
  const json = await res.json();
  return json.result?.data;
}

export function TransferRouteMap({ pickupLocation, dropoffLocation, pickupPlaceId, dropoffPlaceId }: TransferRouteMapProps) {
  const queryParams = useMemo(() => ({
    origin: pickupLocation,
    destination: dropoffLocation,
    originPlaceId: pickupPlaceId || undefined,
    destinationPlaceId: dropoffPlaceId || undefined,
  }), [pickupLocation, dropoffLocation, pickupPlaceId, dropoffPlaceId]);

  const { data, isLoading } = useQuery({
    queryKey: ['transfer-directions', pickupLocation, dropoffLocation, pickupPlaceId, dropoffPlaceId],
    queryFn: () => fetchDirections(queryParams),
    enabled: !!(pickupLocation && dropoffLocation),
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    retry: 1,
  });

  const routePoints = useMemo(() => {
    if (data?.success && data.overviewPolyline) {
      return decodePolyline(data.overviewPolyline);
    }
    return [];
  }, [data]);

  if (!pickupLocation || !dropoffLocation) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Calculando ruta...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data?.success || routePoints.length === 0) {
    return null; // Silently fail - don't show map if route can't be calculated
  }

  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Route info bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border-b text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Route className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground">{data.distance?.text}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground">{data.duration?.text}</span>
          </span>
        </div>
        {/* Map */}
        <div className="h-[200px] w-full">
          <MapContainer
            center={startPoint}
            zoom={12}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
            scrollWheelZoom={false}
            dragging={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline
              positions={routePoints}
              pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
            />
            <Marker position={startPoint} icon={pickupIcon} />
            <Marker position={endPoint} icon={dropoffIcon} />
            <FitBounds points={routePoints} />
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
