/**
 * VehicleDetailPanel — Rich vehicle info panel that slides in from the right
 * when a vehicle marker is clicked on the GPS Flota map.
 *
 * Shows: photo, plate, model, real-time data (speed, address, time),
 * and action buttons (view route, follow, vehicle file).
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { apiInvoke } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import {
  X, Car, Navigation, Clock, Gauge, MapPin, Route,
  Play, Pause, RotateCcw, ExternalLink, Crosshair,
  TrendingUp, Timer, Fuel, Zap, ChevronDown, ChevronUp,
  CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──
interface VehicleData {
  id: string;
  matricula: string;
  modelo: string | null;
  marca: string | null;
  color: string | null;
  combustible: string | null;
  photo_url: string | null;
  traccar_device_id: string;
  position?: {
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    address: string;
    deviceTime: string;
    valid: boolean;
    altitude: number;
  };
  device?: {
    status: string;
    lastUpdate: string | null;
  };
}

interface RoutePosition {
  lat: number;
  lng: number;
  speed: number;
  course: number;
  address: string | null;
  time: string;
  altitude: number;
}

interface RouteSummary {
  totalPoints: number;
  totalDistanceKm: number;
  maxSpeedKmh: number;
  movingTimeMinutes: number;
  startTime: string | null;
  endTime: string | null;
}

interface VehicleDetailPanelProps {
  vehicle: VehicleData | null;
  onClose: () => void;
  onFollowVehicle?: (vehicleId: string) => void;
  onRouteLoaded?: (positions: RoutePosition[]) => void;
  onRoutePlaybackUpdate?: (index: number) => void;
  onRouteClear?: () => void;
}

// ── Playback speeds ──
const SPEEDS = [1, 2, 5, 10];

export function VehicleDetailPanel({
  vehicle,
  onClose,
  onFollowVehicle,
  onRouteLoaded,
  onRoutePlaybackUpdate,
  onRouteClear,
}: VehicleDetailPanelProps) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  // Route state
  const [routePositions, setRoutePositions] = useState<RoutePosition[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Playback state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when vehicle changes
  useEffect(() => {
    setRoutePositions([]);
    setRouteSummary(null);
    setShowRoute(false);
    setShowDetails(false);
    setCurrentIndex(0);
    setPlaying(false);
    onRouteClear?.();
  }, [vehicle?.id]);

  // Fetch route history for a specific date (or today)
  const fetchRouteForDate = useCallback(async (dateStr?: string) => {
    if (!vehicle || !orgId) return;
    setRouteLoading(true);
    try {
      let from: string;
      let to: string;
      if (dateStr) {
        // Specific date: full day
        const d = new Date(dateStr + 'T00:00:00');
        from = d.toISOString();
        const dEnd = new Date(dateStr + 'T23:59:59');
        to = dEnd.toISOString();
      } else {
        // Today
        const now = new Date();
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        to = now.toISOString();
      }

      const { data } = await apiInvoke<{
        ok: boolean;
        positions: RoutePosition[];
        summary: RouteSummary;
        error?: string;
      }>('traccar/route-history', {
        body: {
          organization_id: orgId,
          device_id: vehicle.traccar_device_id,
          from,
          to,
        },
      });

      if (data?.ok && data.positions) {
        setRoutePositions(data.positions);
        setRouteSummary(data.summary);
        setShowRoute(true);
        setCurrentIndex(data.positions.length - 1);
        onRouteLoaded?.(data.positions);
      } else {
        setRoutePositions([]);
        setRouteSummary(null);
        setShowRoute(true);
      }
    } catch (err) {
      console.error('[VehicleDetailPanel] Error fetching route:', err);
    } finally {
      setRouteLoading(false);
    }
  }, [vehicle, orgId, onRouteLoaded]);

  const fetchTodayRoute = useCallback(() => fetchRouteForDate(), [fetchRouteForDate]);

  // Playback timer
  useEffect(() => {
    if (playing && routePositions.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= routePositions.length - 1) {
            setPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onRoutePlaybackUpdate?.(next);
          return next;
        });
      }, 600 / speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, routePositions.length, onRoutePlaybackUpdate]);

  const togglePlay = useCallback(() => {
    if (currentIndex >= routePositions.length - 1) {
      setCurrentIndex(0);
      onRoutePlaybackUpdate?.(0);
      setPlaying(true);
    } else {
      setPlaying(p => !p);
    }
  }, [currentIndex, routePositions.length, onRoutePlaybackUpdate]);

  const resetPlayback = useCallback(() => {
    setPlaying(false);
    setCurrentIndex(0);
    onRoutePlaybackUpdate?.(0);
  }, [onRoutePlaybackUpdate]);

  const cycleSpeed = useCallback(() => {
    setSpeed(s => {
      const idx = SPEEDS.indexOf(s);
      return SPEEDS[(idx + 1) % SPEEDS.length];
    });
  }, []);

  const clearRoute = useCallback(() => {
    setShowRoute(false);
    setRoutePositions([]);
    setRouteSummary(null);
    setPlaying(false);
    setCurrentIndex(0);
    setSelectedDate('');
    onRouteClear?.();
  }, [onRouteClear]);

  // Progress
  const progressPercent = routePositions.length > 1
    ? Math.round((currentIndex / (routePositions.length - 1)) * 100)
    : 0;

  if (!vehicle) return null;

  const isOnline = vehicle.device?.status === 'online';
  const speedKmh = vehicle.position?.speed ? Math.round(vehicle.position.speed * 1.852) : 0;
  const courseDir = vehicle.position?.course
    ? ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(vehicle.position.course / 45) % 8]
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute top-0 right-0 h-full w-[360px] bg-white/98 backdrop-blur-xl border-l border-border/50 shadow-2xl z-[1001] flex flex-col overflow-hidden"
      >
        {/* ── Header with photo ── */}
        <div className="relative shrink-0">
          {/* Vehicle photo or gradient background */}
          <div className="h-40 relative overflow-hidden">
            {vehicle.photo_url ? (
              <img
                src={vehicle.photo_url}
                alt={vehicle.matricula}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <Car className="h-16 w-16 text-white/20" />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white rounded-full p-1.5 hover:bg-black/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Vehicle identity overlay */}
            <div className="absolute bottom-3 left-4 right-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-white font-mono font-bold text-lg tracking-wider">
                  {vehicle.matricula}
                </h2>
                <Badge
                  className={cn(
                    "text-[10px] font-semibold border-0",
                    isOnline
                      ? "bg-green-500/90 text-white"
                      : "bg-gray-500/80 text-white"
                  )}
                >
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Badge>
              </div>
              <p className="text-white/80 text-sm">
                {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || 'Vehículo'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Real-time data ── */}
        <div className="p-4 border-b border-border/30 shrink-0">
          {/* Speed + Direction */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <Gauge className="h-4 w-4 mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-bold tabular-nums">{speedKmh}</p>
              <p className="text-[10px] text-muted-foreground">km/h</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <Navigation className="h-4 w-4 mx-auto mb-1 text-amber-500" style={{ transform: `rotate(${vehicle.position?.course || 0}deg)` }} />
              <p className="text-lg font-bold">{courseDir || '—'}</p>
              <p className="text-[10px] text-muted-foreground">Dirección</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
              <p className="text-lg font-bold tabular-nums">{vehicle.position?.altitude ? Math.round(vehicle.position.altitude) : '—'}</p>
              <p className="text-[10px] text-muted-foreground">m alt.</p>
            </div>
          </div>

          {/* Address */}
          {vehicle.position?.address && (
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {vehicle.position.address}
              </p>
            </div>
          )}

          {/* Last update time */}
          {vehicle.position?.deviceTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Última señal: {new Date(vehicle.position.deviceTime).toLocaleString('es-ES', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </p>
            </div>
          )}

          {/* Expandable details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetails ? 'Menos detalles' : 'Más detalles'}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/30">
                  {vehicle.color && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: vehicle.color.toLowerCase() }} />
                      <span className="text-muted-foreground">{vehicle.color}</span>
                    </div>
                  )}
                  {vehicle.combustible && (
                    <div className="flex items-center gap-2 text-xs">
                      <Fuel className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{vehicle.combustible}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Action buttons ── */}
        <div className="p-4 border-b border-border/30 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={showRoute && !selectedDate ? 'default' : 'outline'}
              className="h-9 text-xs gap-1.5"
              onClick={() => {
                if (showRoute && !selectedDate) {
                  clearRoute();
                  setSelectedDate('');
                } else {
                  setSelectedDate('');
                  fetchTodayRoute();
                }
              }}
              disabled={routeLoading}
            >
              <Route className="h-3.5 w-3.5" />
              {routeLoading && !selectedDate ? 'Cargando...' : showRoute && !selectedDate ? 'Ocultar ruta' : 'Ruta de hoy'}
            </Button>
            <Button
              size="sm"
              variant={showDatePicker ? 'default' : 'outline'}
              className="h-9 text-xs gap-1.5"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Historial
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5"
              onClick={() => onFollowVehicle?.(vehicle.id)}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Seguir
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5"
              onClick={() => window.open(`/fleet/${vehicle.id}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver ficha
            </Button>
          </div>

          {/* Date picker for route history */}
          <AnimatePresence>
            {showDatePicker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border/30">
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Seleccionar fecha para ver ruta
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex-1 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button
                      size="sm"
                      className="h-9 px-3"
                      disabled={!selectedDate || routeLoading}
                      onClick={() => {
                        fetchRouteForDate(selectedDate);
                        setShowDatePicker(false);
                      }}
                    >
                      {routeLoading ? 'Cargando...' : 'Ver ruta'}
                    </Button>
                  </div>
                  {/* Quick date buttons */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[0, 1, 2, 3, 4, 5, 6].map((daysAgo) => {
                      const d = new Date();
                      d.setDate(d.getDate() - daysAgo);
                      const dateStr = d.toISOString().split('T')[0];
                      const label = daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? 'Ayer' : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                      return (
                        <button
                          key={daysAgo}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            fetchRouteForDate(dateStr);
                            setShowDatePicker(false);
                          }}
                          className={cn(
                            'px-2 py-1 text-xs rounded-md border transition-colors',
                            selectedDate === dateStr
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:bg-accent'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Route summary + playback ── */}
        {showRoute && routePositions.length > 0 && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* Date label for historical routes */}
            {selectedDate && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  Ruta del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => { clearRoute(); setSelectedDate(''); }}
                  className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {/* Summary stats */}
            {routeSummary && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <p className="text-sm font-bold text-blue-700 tabular-nums">
                    {routeSummary.totalDistanceKm} km
                  </p>
                  <p className="text-[10px] text-blue-600">Distancia total</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <p className="text-sm font-bold text-amber-700 tabular-nums">
                    {routeSummary.maxSpeedKmh} km/h
                  </p>
                  <p className="text-[10px] text-amber-600">Vel. máxima</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                  <p className="text-sm font-bold text-green-700 tabular-nums">
                    {routeSummary.movingTimeMinutes} min
                  </p>
                  <p className="text-[10px] text-green-600">En movimiento</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                  <p className="text-sm font-bold text-purple-700 tabular-nums">
                    {routeSummary.totalPoints}
                  </p>
                  <p className="text-[10px] text-purple-600">Puntos GPS</p>
                </div>
              </div>
            )}

            {/* Time range */}
            {routeSummary?.startTime && routeSummary?.endTime && (
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 px-1">
                <span>{new Date(routeSummary.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="flex-1 h-px bg-border mx-3" />
                <span>{new Date(routeSummary.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}

            {/* Playback controls */}
            <div className="bg-muted/30 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Reproducir recorrido</span>
                <span className="tabular-nums">{progressPercent}%</span>
              </div>

              <Slider
                value={[currentIndex]}
                onValueChange={([val]) => {
                  setPlaying(false);
                  setCurrentIndex(val);
                  onRoutePlaybackUpdate?.(val);
                }}
                min={0}
                max={routePositions.length - 1}
                step={1}
                className="w-full"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={togglePlay}
                  >
                    {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={resetPlayback}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] font-mono tabular-nums"
                    onClick={cycleSpeed}
                  >
                    {speed}x
                  </Button>
                </div>

                {routePositions[currentIndex] && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(routePositions[currentIndex].time).toLocaleTimeString('es-ES', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                )}
              </div>

              {/* Current position info during playback */}
              {routePositions[currentIndex] && (
                <div className="pt-2 border-t border-border/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Velocidad:</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(routePositions[currentIndex].speed * 1.852)} km/h
                    </span>
                  </div>
                  {routePositions[currentIndex].address && (
                    <div className="flex items-start gap-1 text-[11px]">
                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground leading-tight">
                        {routePositions[currentIndex].address}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Route empty state */}
        {showRoute && routePositions.length === 0 && !routeLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Route className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Sin datos de ruta</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {selectedDate
                ? `No hay posiciones registradas para el ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`
                : 'No hay posiciones registradas para hoy'
              }
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
