/**
 * Parking Map — Clean schematic SVG matching the real Azul Cars campa layout.
 * Carefully measured from the aerial photo to match exact proportions.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Car, ParkingSquare, MapPin, RefreshCw,
  History, Search, X, AlertTriangle, CircleDot,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ParkingZone {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  spots: ParkingSpot[];
}

interface ParkingSpot {
  id: string;
  zone_id: string;
  spot_number: number;
  label: string | null;
  status: 'free' | 'occupied' | 'reserved' | 'blocked';
  vehicle_id: string | null;
  vehicle_matricula: string | null;
  occupied_at: string | null;
  occupied_by: string | null;
  grid_row: number | null;
  grid_col: number | null;
}

interface ParkingOverview {
  zones: ParkingZone[];
  summary: {
    total: number;
    occupied: number;
    free: number;
    blocked: number;
  };
}

interface ParkingHistoryItem {
  id: string;
  spot_number: number;
  vehicle_matricula: string | null;
  action: string;
  performed_by: string | null;
  performed_at: string;
}

// ─── SVG Layout Constants ───────────────────────────────────────────────────
// Using a 1150 x 900 viewBox to match the landscape proportions of the real campa
const VW = 1150;
const VH = 900;

// Individual spot dimensions (proportional to the image)
const SW = 34; // width
const SH = 28; // height
const G = 4;   // gap between spots in same group

/**
 * Coordinates carefully measured from the real aerial photo.
 * 
 * Layout reference (from the image):
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  [Sucios zone]  │  [Nave/Roof with X]                              │
 * │  [structure]    │                                                   │
 * │                 │                                          Planet   │
 * │96  70 71  44 45 │    1  2  3  4  5  6  7  8  9  10  11            │
 * │97  72 73  46 47 │                                                   │
 * │98  74 75  48 49 │         [Oficina Azul Cars]                      │
 * │99  76 77  50 51 │                                                   │
 * │100 78 79  52 53 │    12 13 14 15 16 17 18 19                       │
 * │101 80 81  54 55 │    20 21 22 23 24 25 26 27                       │
 * │102 82 83  56 57 │                                                   │
 * │103 84 85  58 59 │    28 29 30 31 32 33 34 35                       │
 * │104 86 87  60 61 │    36 37 38 39 40 41 42 43                       │
 * │105 88 89  62 63 │                                                   │
 * │106 90 91  64 65 │                                                   │
 * │107 92 93  66 67 │         [SALIDA]                                 │
 * │108 94 95  68 69 │                                                   │
 * │109              │                                                   │
 * │110              │                                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 */
function buildSpotCoords(): Map<number, { x: number; y: number; w: number; h: number }> {
  const coords = new Map<number, { x: number; y: number; w: number; h: number }>();

  // ─── Plazas 96-110: Single column, far left ───────────────────────
  // Starts at about x=30, y=285, 15 spots vertically
  const x96 = 30;
  const y96Start = 285;
  const vStep = SH + G; // vertical step between spots
  for (let i = 0; i < 15; i++) {
    coords.set(96 + i, { x: x96, y: y96Start + i * vStep, w: SW, h: SH });
  }

  // ─── Plazas 70-95: Two columns, left area ─────────────────────────
  // Pairs: 70,71 / 72,73 / ... / 94,95 = 13 rows
  // Starts at about x=130, y=285
  const x70col1 = 130;
  const x70col2 = x70col1 + SW + G;
  const y70Start = 285;
  for (let i = 0; i < 13; i++) {
    const y = y70Start + i * vStep;
    coords.set(70 + i * 2, { x: x70col1, y, w: SW, h: SH });
    coords.set(71 + i * 2, { x: x70col2, y, w: SW, h: SH });
  }

  // ─── Plazas 44-69: Two columns, center-left ───────────────────────
  // Pairs: 44,45 / 46,47 / ... / 68,69 = 13 rows
  // Starts at about x=310, y=285
  const x44col1 = 310;
  const x44col2 = x44col1 + SW + G;
  const y44Start = 285;
  for (let i = 0; i < 13; i++) {
    const y = y44Start + i * vStep;
    coords.set(44 + i * 2, { x: x44col1, y, w: SW, h: SH });
    coords.set(45 + i * 2, { x: x44col2, y, w: SW, h: SH });
  }

  // ─── Plazas 1-11: Horizontal row, top-right area ──────────────────
  // Starts at about x=570, y=285
  const x1Start = 570;
  const y1 = 285;
  const hStep = SW + G; // horizontal step
  for (let i = 0; i < 11; i++) {
    coords.set(1 + i, { x: x1Start + i * hStep, y: y1, w: SW, h: SH });
  }

  // ─── Plazas 12-19: Horizontal row, center-right ───────────────────
  // Starts at about x=530, y=480
  const x12Start = 530;
  const y12 = 480;
  for (let i = 0; i < 8; i++) {
    coords.set(12 + i, { x: x12Start + i * hStep, y: y12, w: SW, h: SH });
  }

  // ─── Plazas 20-27: Horizontal row, below 12-19 ────────────────────
  const y20 = y12 + vStep;
  for (let i = 0; i < 8; i++) {
    coords.set(20 + i, { x: x12Start + i * hStep, y: y20, w: SW, h: SH });
  }

  // ─── Plazas 28-35: Horizontal row, lower center-right ─────────────
  // Starts at about x=530, y=600
  const y28 = 600;
  for (let i = 0; i < 8; i++) {
    coords.set(28 + i, { x: x12Start + i * hStep, y: y28, w: SW, h: SH });
  }

  // ─── Plazas 36-43: Horizontal row, below 28-35 ────────────────────
  const y36 = y28 + vStep;
  for (let i = 0; i < 8; i++) {
    coords.set(36 + i, { x: x12Start + i * hStep, y: y36, w: SW, h: SH });
  }

  return coords;
}

const SPOT_COORDS = buildSpotCoords();

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Parking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSpotNum, setHighlightedSpotNum] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['parking-overview'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingOverview; error?: string }>('parking/overview', { body: {} });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
      return result.data.data;
    },
    refetchInterval: 15000,
  });

  const { data: history } = useQuery({
    queryKey: ['parking-history'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingHistoryItem[] }>('parking/history', { body: { limit: 30 } });
      if (result.error || !result.data?.ok) return [];
      return result.data.data;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const result = await apiInvoke<{ ok: boolean; message?: string; error?: string }>('parking/seed-layout', { body: {} });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
      return result.data;
    },
    onSuccess: (data) => {
      toast({ title: 'Parking configurado', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['parking-overview'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (spotId: string) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('parking/release', { body: { spot_id: spotId } });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
    },
    onSuccess: () => {
      toast({ title: 'Plaza liberada' });
      queryClient.invalidateQueries({ queryKey: ['parking-overview'] });
      queryClient.invalidateQueries({ queryKey: ['parking-history'] });
      setSelectedSpot(null);
      setShowReleaseConfirm(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const allSpots = useMemo(() => {
    if (!overview) return [];
    return overview.zones.flatMap(z => z.spots);
  }, [overview]);

  const spotByNumber = useMemo(() => {
    const map = new Map<number, ParkingSpot>();
    allSpots.forEach(s => map.set(s.spot_number, s));
    return map;
  }, [allSpots]);

  const searchResult = useMemo(() => {
    if (!searchQuery.trim() || !overview) return null;
    const q = searchQuery.trim().toLowerCase();
    for (const zone of overview.zones) {
      for (const spot of zone.spots) {
        if (spot.status === 'occupied' && spot.vehicle_matricula &&
            spot.vehicle_matricula.toLowerCase().includes(q)) {
          return { spot, zoneName: zone.name };
        }
      }
    }
    return null;
  }, [searchQuery, overview]);

  useEffect(() => {
    if (searchResult) {
      setHighlightedSpotNum(searchResult.spot.spot_number);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedSpotNum(null), 6000);
    } else {
      setHighlightedSpotNum(null);
    }
  }, [searchResult]);

  const handleSpotClick = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    if (spot.status === 'occupied') {
      setShowReleaseConfirm(true);
    } else if (spot.status === 'free') {
      setShowAssignDialog(true);
    }
  };

  if (!isLoading && overview && overview.zones.length === 0) {
    return (
      <AppLayout title="Parking">
        <PageHeader title="Parking" icon={ParkingSquare} />
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <ParkingSquare className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Configurar Parking</h2>
            <p className="text-muted-foreground max-w-md">
              Configura el plano de tu campa con las zonas y plazas numeradas.
            </p>
          </div>
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} size="lg">
            {seedMutation.isPending ? 'Configurando...' : 'Configurar Layout'}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Parking">
      <PageHeader
        title="Parking"
        icon={ParkingSquare}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar matrícula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-9 w-[160px] rounded-lg border border-border bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                  searchQuery && searchResult && "ring-2 ring-emerald-500/50 border-emerald-400",
                  searchQuery && !searchResult && "ring-2 ring-red-500/30 border-red-300"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setHighlightedSpotNum(null); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowHistoryDialog(true)}>
              <History className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {searchQuery.trim() && (
        <div className={cn(
          "mb-3 px-4 py-2 rounded-lg border text-sm flex items-center gap-3",
          searchResult
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        )}>
          {searchResult ? (
            <>
              <Car className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <span className="font-mono font-bold">{searchResult.spot.vehicle_matricula}</span>
                {' → '}
                <span className="font-semibold">Plaza {searchResult.spot.spot_number}</span>
                {' — '}{searchResult.zoneName}
              </span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300">No se encontró "{searchQuery}"</span>
            </>
          )}
        </div>
      )}

      {overview && (
        <div className="flex items-center gap-4 mb-3 text-sm">
          <span className="flex items-center gap-1.5">
            <ParkingSquare className="h-4 w-4 text-muted-foreground" />
            <strong>{overview.summary.total}</strong> plazas
          </span>
          <span className="flex items-center gap-1.5">
            <CircleDot className="h-4 w-4 text-emerald-500" />
            <strong className="text-emerald-600">{overview.summary.free}</strong> libres
          </span>
          <span className="flex items-center gap-1.5">
            <Car className="h-4 w-4 text-blue-500" />
            <strong className="text-blue-600">{overview.summary.occupied}</strong> ocupadas
          </span>
          {overview.summary.blocked > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <strong className="text-amber-600">{overview.summary.blocked}</strong> bloqueadas
            </span>
          )}
        </div>
      )}

      {isLoading && <Skeleton className="h-[500px] rounded-xl" />}

      {/* ─── SVG PARKING MAP ──────────────────────────────────────────── */}
      {!isLoading && overview && (
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="w-full h-auto"
            style={{ minHeight: '400px', maxHeight: '70vh' }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* ─── Blue background (the campa surface) ────────────────── */}
            <rect x="0" y="0" width={VW} height={VH} fill="#4a90d9" />

            {/* ─── Nave / Roof (top portion, ~30% height) ─────────────── */}
            <rect x="250" y="0" width="900" height="250" fill="#3a7bc8" stroke="#2d6ab3" strokeWidth="2" />
            {/* X pattern on roof */}
            <line x1="250" y1="0" x2="1150" y2="250" stroke="#2d6ab3" strokeWidth="4" opacity="0.6" />
            <line x1="1150" y1="0" x2="250" y2="250" stroke="#2d6ab3" strokeWidth="4" opacity="0.6" />

            {/* ─── Zona Sucios (top-left corner) ──────────────────────── */}
            <rect x="80" y="20" width="170" height="240" rx="3" fill="#3a6fa8" stroke="#5ba0e0" strokeWidth="1.5" />
            {/* "Sucios" text rotated */}
            <text x="165" y="145" fontSize="18" fill="#a8d4ff" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle" transform="rotate(-90, 165, 145)">
              Sucios
            </text>
            {/* Car wash structure rectangles */}
            <rect x="90" y="40" width="60" height="80" rx="2" fill="#2d5a8a" stroke="#5ba0e0" strokeWidth="0.8" />
            <rect x="90" y="130" width="60" height="80" rx="2" fill="#2d5a8a" stroke="#5ba0e0" strokeWidth="0.8" />
            {/* Small white rectangles (parked dirty cars) */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <rect key={`dirty-${i}`} x="260" y={30 + i * 28} width="20" height="22" rx="1" fill="#c8ddf0" stroke="#7faed4" strokeWidth="0.5" />
            ))}

            {/* ─── Oficina Azul Cars ──────────────────────────────────── */}
            <rect x="780" y="330" width="180" height="120" rx="4" fill="#b8d4eb" stroke="#7faed4" strokeWidth="1.5" />
            <text x="870" y="385" fontSize="13" fill="#2d5a8a" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold">
              Azul Cars
            </text>
            <text x="870" y="405" fontSize="11" fill="#3a6fa8" fontFamily="sans-serif" textAnchor="middle">
              Oficina
            </text>
            {/* Map pin icon */}
            <circle cx="840" cy="370" r="6" fill="#5a5a5a" opacity="0.7" />
            <circle cx="840" cy="370" r="3" fill="white" />

            {/* ─── Small rectangle (container?) between 44-45 and 1-11 ── */}
            <rect x="500" y="300" width="40" height="25" rx="2" fill="#b8d4eb" stroke="#7faed4" strokeWidth="1" />

            {/* ─── SALIDA (exit marker, bottom center) ────────────────── */}
            <rect x="435" y="790" width="50" height="55" rx="3" fill="#7f1d1d" />
            <text x="460" y="815" fontSize="9" fill="white" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold">
              SALIDA
            </text>
            {/* Down arrow */}
            <polygon points="460,850 450,840 470,840" fill="white" />

            {/* ─── Road bottom (Son Maiferit) ─────────────────────────── */}
            <rect x="0" y={VH - 40} width={VW} height="40" fill="#8a8a8a" opacity="0.3" />
            <text x="1050" y={VH - 15} fontSize="11" fill="#d0e4f5" fontFamily="sans-serif" fontStyle="italic">
              Son Maiferit
            </text>

            {/* ─── Road right (Camí Fondo) ────────────────────────────── */}
            <rect x={VW - 40} y="250" width="40" height={VH - 290} fill="#8a8a8a" opacity="0.3" />
            <text x={VW - 20} y="550" fontSize="11" fill="#d0e4f5" fontFamily="sans-serif" fontStyle="italic" textAnchor="middle" transform={`rotate(-90, ${VW - 20}, 550)`}>
              Camí Fondo
            </text>

            {/* ─── Trees (bottom edge) ────────────────────────────────── */}
            {[0, 1, 2, 3, 4, 5].map(i => (
              <circle key={`tree-${i}`} cx={100 + i * 60} cy={VH - 20} r="18" fill="#2d6b2d" opacity="0.5" />
            ))}
            {[0, 1, 2].map(i => (
              <circle key={`tree-r-${i}`} cx={900 + i * 60} cy={VH - 20} r="18" fill="#2d6b2d" opacity="0.5" />
            ))}

            {/* ─── Planet Space label (top-right) ─────────────────────── */}
            <text x="1060" y="100" fontSize="10" fill="#a8d4ff" fontFamily="sans-serif" opacity="0.7">
              Planet Space
            </text>
            <text x="1060" y="115" fontSize="9" fill="#a8d4ff" fontFamily="sans-serif" opacity="0.7">
              of Terrace N2
            </text>

            {/* ─── Render all parking spots ────────────────────────────── */}
            {Array.from(SPOT_COORDS.entries()).map(([num, pos]) => {
              const spot = spotByNumber.get(num);
              const isOccupied = spot?.status === 'occupied';
              const isBlocked = spot?.status === 'blocked';
              const isReserved = spot?.status === 'reserved';
              const isHighlighted = highlightedSpotNum === num;

              let fill = '#ffffff';
              let stroke = '#7faed4';
              let textColor = '#1e3a5f';

              if (isOccupied) {
                fill = '#dc2626';
                stroke = '#991b1b';
                textColor = '#ffffff';
              } else if (isBlocked) {
                fill = '#6b7280';
                stroke = '#4b5563';
                textColor = '#ffffff';
              } else if (isReserved) {
                fill = '#f59e0b';
                stroke = '#d97706';
                textColor = '#1e293b';
              }

              return (
                <g
                  key={num}
                  onClick={() => spot && handleSpotClick(spot)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {isHighlighted && (
                    <rect
                      x={pos.x - 4}
                      y={pos.y - 4}
                      width={pos.w + 8}
                      height={pos.h + 8}
                      rx="5"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="3"
                      className="animate-pulse"
                    />
                  )}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.w}
                    height={pos.h}
                    rx="2"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="1"
                  />
                  {isOccupied && spot?.vehicle_matricula ? (
                    <text
                      x={pos.x + pos.w / 2}
                      y={pos.y + pos.h / 2 + 4}
                      fontSize="7"
                      fill={textColor}
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {spot.vehicle_matricula.length > 6
                        ? spot.vehicle_matricula.slice(-6)
                        : spot.vehicle_matricula}
                    </text>
                  ) : (
                    <text
                      x={pos.x + pos.w / 2}
                      y={pos.y + pos.h / 2 + 4}
                      fontSize="10"
                      fill={textColor}
                      fontFamily="sans-serif"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {num}
                    </text>
                  )}
                  <title>
                    {isOccupied
                      ? `Plaza ${num} — ${spot?.vehicle_matricula || 'Ocupada'}${spot?.occupied_at ? ` (desde ${new Date(spot.occupied_at).toLocaleString('es-ES')})` : ''}`
                      : isBlocked ? `Plaza ${num} — Bloqueada`
                      : isReserved ? `Plaza ${num} — Reservada`
                      : `Plaza ${num} — Libre`}
                  </title>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-white border border-blue-300" />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-red-600" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-amber-400 border border-amber-600" />
              <span>Reservada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-gray-500" />
              <span>Bloqueada</span>
            </div>
          </div>
        </div>
      )}

      {/* Release Confirm Dialog */}
      <Dialog open={showReleaseConfirm} onOpenChange={setShowReleaseConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-red-500" />
              Liberar Plaza {selectedSpot?.spot_number}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              ¿Confirmas que quieres liberar esta plaza?
            </p>
            {selectedSpot?.vehicle_matricula && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-bold text-sm">{selectedSpot.vehicle_matricula}</span>
                </div>
                {selectedSpot.occupied_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aparcado desde {new Date(selectedSpot.occupied_at).toLocaleString('es-ES')}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseConfirm(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => selectedSpot && releaseMutation.mutate(selectedSpot.id)}
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? 'Liberando...' : 'Liberar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <AssignSpotDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        spot={selectedSpot}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ['parking-overview'] });
          queryClient.invalidateQueries({ queryKey: ['parking-history'] });
          setShowAssignDialog(false);
          setSelectedSpot(null);
        }}
      />

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Parking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {history && history.length > 0 ? (
              history.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.action === 'occupy' ? 'default' : 'secondary'} className="text-xs">
                      {item.action === 'occupy' ? 'Entrada' : 'Salida'}
                    </Badge>
                    <span className="font-mono font-medium">{item.vehicle_matricula || '—'}</span>
                    <span className="text-muted-foreground">→ Plaza {item.spot_number}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.performed_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">Sin historial</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ─── Assign Spot Dialog ─────────────────────────────────────────────────────
function AssignSpotDialog({
  open,
  onOpenChange,
  spot,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spot: ParkingSpot | null;
  onAssigned: () => void;
}) {
  const [matricula, setMatricula] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; matricula: string; modelo: string | null }[]>([]);

  useEffect(() => {
    if (!open) return;
    setMatricula('');
    apiInvoke<{ data: any[] }>('supabase-query', {
      body: {
        table: 'vehicles',
        operation: 'select',
        select: 'id, matricula, modelo, status',
        filters: { is_archived: false },
      },
    }).then(result => {
      if (result.data?.data) {
        setVehicles(result.data.data.filter((v: any) => v.status === 'limpio' || v.status === 'sucio' || v.status === 'incompleto'));
      }
    });
  }, [open]);

  const handleAssign = async () => {
    if (!spot || !matricula) return;
    setIsSubmitting(true);
    try {
      const vehicle = vehicles.find(v => v.matricula === matricula);
      const result = await apiInvoke<{ ok: boolean; error?: string }>('parking/assign', {
        body: {
          spot_id: spot.id,
          vehicle_id: vehicle?.id || null,
          vehicle_matricula: matricula,
        },
      });
      if (result.error || !result.data?.ok) {
        throw new Error(result.data?.error || 'Error al asignar');
      }
      toast({ title: 'Plaza asignada', description: `${matricula} → Plaza ${spot.spot_number}` });
      onAssigned();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-500" />
            Asignar Plaza {spot?.spot_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Vehículo</label>
            <Select value={matricula} onValueChange={setMatricula}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vehículo..." />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.matricula}>
                    {v.matricula} {v.modelo ? `— ${v.modelo}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={!matricula || isSubmitting}>
            {isSubmitting ? 'Asignando...' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
