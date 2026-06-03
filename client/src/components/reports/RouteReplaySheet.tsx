/**
 * RouteReplaySheet — Replays the recorded GPS positions of a completed trip on a map.
 * Uses a Slider to scrub through the timeline and animates a car marker along the path.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { apiInvoke } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import {
  Play, Pause, RotateCcw, MapPin, Clock, User, Navigation, Truck, Radio,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──
interface Position {
  lat: number;
  lng: number;
  accuracy: number | null;
  time: string;
}

interface RouteReplaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: {
    id: string;
    reservation_id: string;
    operation_type: string;
    destination_address: string | null;
    started_by: string | null;
    arrived_by: string | null;
    en_camino_at: string;
    llego_at: string | null;
    estimated_minutes: number | null;
    real_minutes: number | null;
  } | null;
}

// ── Azul Cars base ──
const AZUL_CARS_BASE = { lat: 39.5391, lng: 2.7419 }; // Carrer del Canal de Sant Jordi, 29

// ── Custom icons ──
const createCarIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="36" height="36">
    <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.35))"/>
    <g transform="translate(8,8)" fill="white">
      <path d="M13.5 5.5l-1.2-3.6C12 1.1 11.2 0.5 10.3 0.5H5.7C4.8 0.5 4 1.1 3.7 1.9L2.5 5.5C1.6 5.8 1 6.6 1 7.5v4c0 0.6 0.4 1 1 1h0.5c0.3 0 0.5-0.2 0.5-0.5v-0.5h10v0.5c0 0.3 0.2 0.5 0.5 0.5H14c0.6 0 1-0.4 1-1v-4c0-0.9-0.6-1.7-1.5-2zM4.5 2.5c0.1-0.3 0.4-0.5 0.7-0.5h5.6c0.3 0 0.6 0.2 0.7 0.5l1 3h-9l1-3zM4 9.5c-0.6 0-1-0.4-1-1s0.4-1 1-1 1 0.4 1 1-0.4 1-1 1zm8 0c-0.6 0-1-0.4-1-1s0.4-1 1-1 1 0.4 1 1-0.4 1-1 1z"/>
    </g>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'replay-car-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

const createPinIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="${color}" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.3))"/>
    <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'replay-pin-marker',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

const entregaCarIcon = createCarIcon('#2563eb');
const devolucionCarIcon = createCarIcon('#d97706');
const startPinIcon = createPinIcon('#059669');
const endPinIcon = createPinIcon('#dc2626');

// ── Map auto-fit ──
function FitToPositions({ positions }: { positions: Position[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng]));
    bounds.extend([AZUL_CARS_BASE.lat, AZUL_CARS_BASE.lng]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [positions, map]);
  return null;
}

// ── Playback speeds ──
const SPEEDS = [1, 2, 5, 10];

export function RouteReplaySheet({ open, onOpenChange, trip }: RouteReplaySheetProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch location history when trip changes
  useEffect(() => {
    if (!open || !trip) {
      setPositions([]);
      setCurrentIndex(0);
      setPlaying(false);
      return;
    }

    let cancelled = false;
    async function fetchHistory() {
      setLoading(true);
      try {
        const resp = await apiInvoke<{ ok: boolean; positions: Position[] }>(
          'en-camino-tracking/location-history',
          {
            body: {
              reservation_id: trip!.reservation_id,
              operation_type: trip!.operation_type,
            },
          }
        );
        if (!cancelled && resp.data?.ok && resp.data.positions) {
          setPositions(resp.data.positions);
          setCurrentIndex(0);
        }
      } catch (err) {
        console.error('[route-replay] Error fetching history:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [open, trip]);

  // Playback timer
  useEffect(() => {
    if (playing && positions.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= positions.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800 / speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, positions.length]);

  const togglePlay = useCallback(() => {
    if (currentIndex >= positions.length - 1) {
      setCurrentIndex(0);
      setPlaying(true);
    } else {
      setPlaying(p => !p);
    }
  }, [currentIndex, positions.length]);

  const reset = useCallback(() => {
    setPlaying(false);
    setCurrentIndex(0);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed(s => {
      const idx = SPEEDS.indexOf(s);
      return SPEEDS[(idx + 1) % SPEEDS.length];
    });
  }, []);

  // Path up to current position
  const visiblePath = useMemo(() => {
    return positions.slice(0, currentIndex + 1).map(p => [p.lat, p.lng] as [number, number]);
  }, [positions, currentIndex]);

  // Full path (dimmed)
  const fullPath = useMemo(() => {
    return positions.map(p => [p.lat, p.lng] as [number, number]);
  }, [positions]);

  const currentPos = positions[currentIndex];
  const isEntrega = trip?.operation_type === 'entrega';
  const carIcon = isEntrega ? entregaCarIcon : devolucionCarIcon;

  // Calculate progress percentage
  const progressPercent = positions.length > 1
    ? Math.round((currentIndex / (positions.length - 1)) * 100)
    : 0;

  // Calculate elapsed time in replay
  const elapsedTime = useMemo(() => {
    if (!currentPos || !positions[0]) return null;
    const start = new Date(positions[0].time).getTime();
    const current = new Date(currentPos.time).getTime();
    const diffMs = current - start;
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [currentPos, positions]);

  const totalTime = useMemo(() => {
    if (positions.length < 2) return null;
    const start = new Date(positions[0].time).getTime();
    const end = new Date(positions[positions.length - 1].time).getTime();
    const diffMs = end - start;
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [positions]);

  if (!trip) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center",
                isEntrega ? "bg-blue-100 dark:bg-blue-950" : "bg-amber-100 dark:bg-amber-950"
              )}>
                {isEntrega ? (
                  <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <SheetTitle className="text-base">
                  Recorrido — {isEntrega ? 'Entrega' : 'Devolución'}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trip.destination_address || 'Sin dirección'}
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Trip info bar */}
        <div className="px-5 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-4 text-xs">
            {trip.started_by && (
              <span className="flex items-center gap-1.5">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{trip.started_by}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{format(new Date(trip.en_camino_at), "HH:mm 'del' d MMM", { locale: es })}</span>
            </span>
            {trip.real_minutes != null && (
              <Badge variant="outline" className="text-[10px]">
                {trip.real_minutes} min real
              </Badge>
            )}
            {trip.estimated_minutes != null && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {trip.estimated_minutes} min estimado
              </Badge>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-[300px]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-muted-foreground/20 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-muted-foreground">Cargando recorrido...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Navigation className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Sin datos de recorrido</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Este trayecto no tiene historial de ubicaciones registrado. El conductor no compartió su ubicación durante la operación.
              </p>
            </div>
          ) : (
            <MapContainer
              center={[currentPos?.lat ?? AZUL_CARS_BASE.lat, currentPos?.lng ?? AZUL_CARS_BASE.lng]}
              zoom={13}
              className="h-full w-full"
              style={{ minHeight: '300px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />

              {/* Full path (dimmed) */}
              {fullPath.length > 1 && (
                <Polyline
                  positions={fullPath}
                  pathOptions={{
                    color: '#94a3b8',
                    weight: 3,
                    opacity: 0.3,
                    dashArray: '6, 4',
                  }}
                />
              )}

              {/* Traveled path (colored) */}
              {visiblePath.length > 1 && (
                <Polyline
                  positions={visiblePath}
                  pathOptions={{
                    color: isEntrega ? '#2563eb' : '#d97706',
                    weight: 4,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Start pin */}
              {positions.length > 0 && (
                <Marker position={[positions[0].lat, positions[0].lng]} icon={startPinIcon}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-600">Inicio</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(positions[0].time), 'HH:mm:ss')}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* End pin */}
              {positions.length > 1 && (
                <Marker
                  position={[positions[positions.length - 1].lat, positions[positions.length - 1].lng]}
                  icon={endPinIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-red-600">Llegada</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(positions[positions.length - 1].time), 'HH:mm:ss')}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Current position car marker */}
              {currentPos && (
                <Marker position={[currentPos.lat, currentPos.lng]} icon={carIcon}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold flex items-center gap-1">
                        <Radio className="h-3 w-3" />
                        Posición actual
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(currentPos.time), 'HH:mm:ss')}
                      </p>
                      {currentPos.accuracy && (
                        <p className="text-xs text-gray-400">
                          Precisión: ±{Math.round(currentPos.accuracy)}m
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}

              <FitToPositions positions={positions} />
            </MapContainer>
          )}
        </div>

        {/* Playback controls */}
        {positions.length > 0 && (
          <div className="px-5 py-4 border-t border-border bg-card shrink-0 space-y-3">
            {/* Timeline slider */}
            <div className="space-y-1.5">
              <Slider
                value={[currentIndex]}
                onValueChange={([val]) => {
                  setPlaying(false);
                  setCurrentIndex(val);
                }}
                min={0}
                max={positions.length - 1}
                step={1}
                className="w-full"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{elapsedTime || '0:00'}</span>
                <span className="font-medium text-foreground">{progressPercent}%</span>
                <span>{totalTime || '0:00'}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlay}
                  className="h-8 w-8 p-0"
                >
                  {playing ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-8 w-8 p-0"
                  title="Reiniciar"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cycleSpeed}
                  className="h-8 px-2 text-xs font-mono tabular-nums"
                  title="Velocidad de reproducción"
                >
                  {speed}x
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {positions.length} puntos
                </span>
                {currentPos && (
                  <span className="tabular-nums">
                    {format(new Date(currentPos.time), 'HH:mm:ss')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
