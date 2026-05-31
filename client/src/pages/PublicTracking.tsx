/**
 * PublicTracking — Public page for clients to see driver's real-time location.
 * Accessible via /track/:token (no auth required).
 *
 * Features:
 * - Real-time map with driver's GPS position (polls every 5s)
 * - Dynamic ETA via Google Maps Directions API (polls every 30s)
 * - Contextual messages based on operation type (entrega/devolucion)
 * - Arrival state with different messages per operation type
 * - Azul Cars branded design
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, MapPin, Clock, CheckCircle2, Navigation, Loader2, Route } from 'lucide-react';

// ── Brand constants ──
const brand = {
  navy: '#001321',
  gold: '#C9A96E',
  goldLight: '#D4B87A',
  warmBg: '#F5F3EF',
  white: '#FFFFFF',
};

// ── Types ──
interface TrackingData {
  ok: boolean;
  status: 'en_camino' | 'arrived' | 'cancelled';
  operation_type: 'entrega' | 'devolucion';
  driver_name: string;
  destination_address: string;
  estimated_minutes: number | null;
  en_camino_at: string;
  llego_at: string | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  sharing_location: boolean;
  client_name: string;
  vehicle_info: string;
}

interface EtaData {
  ok: boolean;
  status: 'ok' | 'arrived' | 'no_data' | 'no_route';
  eta_minutes: number | null;
  distance_km: number | null;
  distance_text: string | null;
  duration_text: string | null;
  polyline: string | null;
}

// ── Decode Google encoded polyline ──
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
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ── Custom car marker ──
function createCarMarker() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
    <defs>
      <filter id="car-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="${brand.navy}" flood-opacity="0.35"/>
      </filter>
    </defs>
    <circle cx="22" cy="22" r="18" fill="${brand.navy}" stroke="${brand.gold}" stroke-width="2.5" filter="url(#car-glow)"/>
    <g transform="translate(12,12)" fill="${brand.gold}">
      <path d="M16 6l-1.4-4.2C14.3 0.7 13.3 0 12.2 0H7.8C6.7 0 5.7 0.7 5.4 1.8L4 6C2.8 6.4 2 7.4 2 8.6v4.4c0 0.6 0.4 1 1 1h0.5c0.3 0 0.5-0.2 0.5-0.5V13h12v0.5c0 0.3 0.2 0.5 0.5 0.5H17c0.6 0 1-0.4 1-1V8.6c0-1.2-0.8-2.2-2-2.6zM6.2 2.4C6.3 2 6.7 1.6 7.2 1.6h5.6c0.5 0 0.9 0.4 1 0.8L15 6H5l1.2-3.6zM5 10.5c-0.7 0-1.2-0.5-1.2-1.2S4.3 8.1 5 8.1s1.2 0.5 1.2 1.2S5.7 10.5 5 10.5zm10 0c-0.7 0-1.2-0.5-1.2-1.2S14.3 8.1 15 8.1s1.2 0.5 1.2 1.2-0.5 1.2-1.2 1.2z"/>
    </g>
    <circle cx="22" cy="22" r="18" fill="none" stroke="${brand.gold}" stroke-width="1.5" opacity="0.5">
      <animate attributeName="r" from="18" to="28" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite"/>
    </circle>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'tracking-car-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

// ── Destination marker ──
function createDestinationMarker() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
    <defs>
      <filter id="pin-shadow" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${brand.gold}" filter="url(#pin-shadow)"/>
    <circle cx="14" cy="13" r="5.5" fill="${brand.white}" opacity="0.95"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'tracking-dest-marker',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
  });
}

const carIcon = createCarMarker();
const destIcon = createDestinationMarker();

// ── Map auto-fit component ──
function MapAutoFit({ carLat, carLng, destLat, destLng }: {
  carLat: number | null; carLng: number | null;
  destLat: number | null; destLng: number | null;
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;
    const points: [number, number][] = [];
    // Defensive: only use coordinates that are finite valid numbers
    if (carLat != null && carLng != null && isFinite(carLat) && isFinite(carLng)) {
      points.push([carLat, carLng]);
    }
    if (destLat != null && destLng != null && isFinite(destLat) && isFinite(destLng)) {
      points.push([destLat, destLng]);
    }
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 14 });
      fittedRef.current = true;
    } else if (points.length === 1) {
      map.setView(points[0], 14);
      fittedRef.current = true;
    }
  }, [map, carLat, carLng, destLat, destLng]);

  return null;
}

// ── Time helpers ──
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin === 1) return 'Hace 1 minuto';
  if (diffMin < 60) return `Hace ${diffMin} minutos`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs === 1) return 'Hace 1 hora';
  return `Hace ${diffHrs} horas`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── Geocode destination address (simple approach using Nominatim) ──
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const results = await resp.json();
    if (results.length > 0) {
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lng) };
    }
  } catch { /* ignore */ }
  return null;
}

// ── ETA arrival time formatter ──
function formatEtaArrival(etaMinutes: number): string {
  const arrival = new Date(Date.now() + etaMinutes * 60000);
  return arrival.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── Main component ──
export default function PublicTracking() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [eta, setEta] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const geocodedRef = useRef(false);

  const fetchTracking = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`/api/track/${token}`);
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        setError(json.status === 'not_found' ? 'not_found' : json.error || 'Error');
        return;
      }
      setData(json);
      setError(null);

      // Geocode destination once
      if (!geocodedRef.current && json.destination_address) {
        geocodedRef.current = true;
        const coords = await geocodeAddress(json.destination_address);
        if (coords) setDestCoords(coords);
      }
    } catch {
      setError('network');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchEta = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`/api/track/${token}/eta`);
      const json = await resp.json();
      if (resp.ok && json.ok) {
        setEta(json);
      }
    } catch { /* ignore ETA errors — non-critical */ }
  }, [token]);

  // Initial fetch + polling every 5s for location
  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  // ETA polling every 30s (less frequent to avoid API rate limits)
  useEffect(() => {
    fetchEta();
    const interval = setInterval(fetchEta, 30000);
    return () => clearInterval(interval);
  }, [fetchEta]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: brand.warmBg }}>
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" style={{ color: brand.gold }} />
          <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>
            Cargando seguimiento...
          </p>
        </div>
      </div>
    );
  }

  // ── Error / Not found ──
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: brand.warmBg }}>
        <div className="text-center max-w-sm mx-4">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: brand.navy }}>
            <MapPin className="h-8 w-8" style={{ color: brand.gold }} />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: brand.navy, fontFamily: 'Montserrat, sans-serif' }}>
            {error === 'not_found' ? 'Enlace no encontrado' : 'Error de conexión'}
          </h1>
          <p className="text-sm" style={{ color: '#6B7280', fontFamily: 'Barlow, sans-serif' }}>
            {error === 'not_found'
              ? 'Este enlace de seguimiento no existe o ha expirado.'
              : 'No se pudo conectar con el servidor. Inténtalo de nuevo.'}
          </p>
        </div>
      </div>
    );
  }

  const isEntrega = data.operation_type === 'entrega';
  const isArrived = data.status === 'arrived';
  // Defensive: ensure coordinates are valid numbers (not null, NaN, or Infinity)
  const parsedLat = data.current_lat != null ? Number(data.current_lat) : NaN;
  const parsedLng = data.current_lng != null ? Number(data.current_lng) : NaN;
  const hasLocation = isFinite(parsedLat) && isFinite(parsedLng) && parsedLat !== 0 && parsedLng !== 0;

  // Elapsed time
  const elapsedMin = Math.floor((Date.now() - new Date(data.en_camino_at).getTime()) / 60000);

  // ETA data
  const hasEta = eta?.status === 'ok' && eta.eta_minutes != null;

  // ── Arrived state ──
  if (isArrived) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: brand.warmBg }}>
        {/* Header */}
        <header className="px-4 py-3 flex items-center justify-center" style={{ background: brand.navy }}>
          <span className="text-lg font-bold tracking-wide" style={{ color: brand.white, fontFamily: 'Montserrat, sans-serif' }}>
            AZUL<span style={{ color: brand.gold }}>.</span>
          </span>
          <span className="text-[10px] font-semibold tracking-[2px] uppercase ml-2 opacity-60" style={{ color: brand.gold, fontFamily: 'Montserrat, sans-serif' }}>
            CARS
          </span>
        </header>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            {/* Success animation */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#10B981' }} />
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ background: '#10B981' }}>
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-3" style={{ color: brand.navy, fontFamily: 'Montserrat, sans-serif' }}>
              {isEntrega
                ? '¡Tu vehículo te está esperando!'
                : '¡El conductor ha llegado!'}
            </h1>
            <p className="text-base mb-6" style={{ color: '#4B5563', fontFamily: 'Barlow, sans-serif' }}>
              {isEntrega
                ? 'El conductor ha llegado a su destino. Tu vehículo te está esperando.'
                : 'El conductor ha llegado a tu ubicación para recoger el vehículo.'}
            </p>

            {/* Details card */}
            <div className="rounded-xl p-5 text-left" style={{ background: brand.white, boxShadow: '0 2px 12px rgba(0,19,33,0.08)' }}>
              {data.driver_name && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: brand.navy }}>
                    <Car className="h-4 w-4" style={{ color: brand.gold }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>Conductor</p>
                    <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>{data.driver_name}</p>
                  </div>
                </div>
              )}
              {data.vehicle_info && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${brand.gold}20` }}>
                    <Car className="h-4 w-4" style={{ color: brand.gold }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>Vehículo</p>
                    <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>{data.vehicle_info}</p>
                  </div>
                </div>
              )}
              {data.destination_address && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${brand.gold}20` }}>
                    <MapPin className="h-4 w-4" style={{ color: brand.gold }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>Destino</p>
                    <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>{data.destination_address}</p>
                  </div>
                </div>
              )}
              {data.llego_at && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
                  <p className="text-xs text-center" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>
                    Llegó a las {formatTime(data.llego_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-4 text-center">
          <p className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>
            Servicio proporcionado por <span className="font-semibold" style={{ color: brand.navy }}>Azul Cars</span>
          </p>
        </footer>
      </div>
    );
  }

  // ── En camino state (main view with map) ──
  const mapCenter: [number, number] = hasLocation
    ? [parsedLat, parsedLng]
    : destCoords
      ? [destCoords.lat, destCoords.lng]
      : [39.5696, 2.6502]; // Default: Mallorca

  return (
    <div className="min-h-screen flex flex-col" style={{ background: brand.warmBg }}>
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between" style={{ background: brand.navy }}>
        <div className="flex items-center">
          <span className="text-lg font-bold tracking-wide" style={{ color: brand.white, fontFamily: 'Montserrat, sans-serif' }}>
            AZUL<span style={{ color: brand.gold }}>.</span>
          </span>
          <span className="text-[10px] font-semibold tracking-[2px] uppercase ml-2 opacity-60" style={{ color: brand.gold, fontFamily: 'Montserrat, sans-serif' }}>
            CARS
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>
            En directo
          </span>
        </div>
      </header>

      {/* Status banner with ETA */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: brand.white, borderBottom: '1px solid #E5E7EB' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: brand.navy }}>
          <Navigation className="h-5 w-5" style={{ color: brand.gold }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: brand.navy, fontFamily: 'Montserrat, sans-serif' }}>
            {isEntrega ? 'Tu vehículo está en camino' : 'El conductor va a recoger tu vehículo'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: 'Barlow, sans-serif' }}>
            {data.driver_name && `${data.driver_name} · `}
            {hasEta
              ? `Llega aprox. a las ${formatEtaArrival(eta!.eta_minutes!)}`
              : data.estimated_minutes
                ? `Estimado: ${data.estimated_minutes} min`
                : `En camino desde las ${formatTime(data.en_camino_at)}`}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {hasEta ? (
            <>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" style={{ color: brand.gold }} />
                <span className="text-sm font-bold tabular-nums" style={{ color: brand.navy, fontFamily: 'Montserrat, sans-serif' }}>
                  {eta!.eta_minutes} min
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>restantes</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" style={{ color: brand.gold }} />
                <span className="text-sm font-bold tabular-nums" style={{ color: brand.navy, fontFamily: 'Montserrat, sans-serif' }}>
                  {elapsedMin} min
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>transcurridos</p>
            </>
          )}
        </div>
      </div>

      {/* ETA detail strip — only when ETA is available */}
      {hasEta && (
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: `${brand.navy}08`, borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5" style={{ color: brand.gold }} />
              <span className="text-xs font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>
                {eta!.distance_text}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" style={{ color: '#6B7280' }} />
              <span className="text-xs" style={{ color: '#6B7280', fontFamily: 'Barlow, sans-serif' }}>
                {eta!.duration_text}
              </span>
            </div>
          </div>
          <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>
            {elapsedMin} min en ruta
          </span>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: '50vh' }}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {/* Driver car marker */}
          {hasLocation && (
            <Marker position={[parsedLat, parsedLng]} icon={carIcon} />
          )}

          {/* Destination marker */}
          {destCoords && (
            <Marker position={[destCoords.lat, destCoords.lng]} icon={destIcon} />
          )}

          {/* Route polyline */}
          {eta?.polyline && (
            <Polyline
              positions={decodePolyline(eta.polyline)}
              pathOptions={{
                color: brand.gold,
                weight: 4,
                opacity: 0.8,
                dashArray: undefined,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          <MapAutoFit
            carLat={hasLocation ? parsedLat : null}
            carLng={hasLocation ? parsedLng : null}
            destLat={destCoords?.lat ?? null}
            destLng={destCoords?.lng ?? null}
          />
        </MapContainer>

        {/* GPS status overlay */}
        {!hasLocation && (
          <div className="absolute bottom-4 left-4 right-4 z-[1000]">
            <div className="rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(0,19,33,0.85)', backdropFilter: 'blur(8px)' }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: brand.gold }} />
              <p className="text-xs" style={{ color: '#D1D5DB', fontFamily: 'Barlow, sans-serif' }}>
                Esperando señal GPS del conductor...
              </p>
            </div>
          </div>
        )}

        {/* ETA badge overlay — prominent on the map */}
        {hasLocation && hasEta && (
          <div className="absolute top-3 left-3 z-[1000]">
            <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{
              background: brand.navy,
              boxShadow: '0 2px 12px rgba(0,19,33,0.3)',
            }}>
              <Navigation className="h-4 w-4" style={{ color: brand.gold }} />
              <div>
                <p className="text-sm font-bold" style={{ color: brand.white, fontFamily: 'Montserrat, sans-serif' }}>
                  {eta!.eta_minutes} min
                </p>
                <p className="text-[9px] -mt-0.5" style={{ color: brand.gold, fontFamily: 'Barlow, sans-serif' }}>
                  {eta!.distance_text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Last update overlay */}
        {hasLocation && data.location_updated_at && (
          <div className="absolute top-3 right-3 z-[1000]">
            <div className="rounded-full px-3 py-1.5 text-[10px] font-medium" style={{ background: 'rgba(255,255,255,0.9)', color: '#6B7280', fontFamily: 'Barlow, sans-serif', backdropFilter: 'blur(4px)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              {formatRelativeTime(new Date(data.location_updated_at))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom info card */}
      <div className="px-4 py-4" style={{ background: brand.white, borderTop: '1px solid #E5E7EB' }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${brand.gold}20` }}>
            <MapPin className="h-4 w-4" style={{ color: brand.gold }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>
              {isEntrega ? 'Destino de entrega' : 'Punto de recogida'}
            </p>
            <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>
              {data.destination_address || 'Dirección no especificada'}
            </p>
          </div>
        </div>

        {data.vehicle_info && (
          <div className="flex items-start gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${brand.navy}10` }}>
              <Car className="h-4 w-4" style={{ color: brand.navy }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>
                Vehículo
              </p>
              <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>
                {data.vehicle_info}
              </p>
            </div>
          </div>
        )}

        {/* ETA arrival time estimate */}
        {hasEta && (
          <div className="flex items-start gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#10B98120' }}>
              <Clock className="h-4 w-4" style={{ color: '#10B981' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: '#9CA3AF', fontFamily: 'Montserrat, sans-serif' }}>
                Hora estimada de llegada
              </p>
              <p className="text-sm font-medium" style={{ color: brand.navy, fontFamily: 'Barlow, sans-serif' }}>
                {formatEtaArrival(eta!.eta_minutes!)} · {eta!.duration_text} ({eta!.distance_text})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-3 text-center" style={{ background: brand.warmBg }}>
        <p className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: 'Barlow, sans-serif' }}>
          Seguimiento en tiempo real · <span className="font-semibold" style={{ color: brand.navy }}>Azul Cars</span>
        </p>
      </footer>
    </div>
  );
}
