/**
 * Parking Map — Pure SVG schematic of the Azul Cars campa.
 * No background image. All elements are SVG shapes.
 * Scales perfectly at any resolution (1080p, 1440p, 4K).
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

// ─── SVG Spot Geometry ──────────────────────────────────────────────────────
// ViewBox: 1200 × 820 (landscape)
// All coordinates are in SVG units (not percentages).
interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildSpotGeometry(): Map<number, SpotRect> {
  const spots = new Map<number, SpotRect>();

  // Spot sizes
  const hW = 52; // horizontal spot width
  const hH = 26; // horizontal spot height
  const vW = 30; // vertical spot width
  const vH = 50; // vertical spot height
  const gap = 3; // gap between spots

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 96-110: Single column, far left, horizontal orientation
  // 15 spots stacked vertically
  // ═══════════════════════════════════════════════════════════════════════════
  const x96 = 30;
  const y96Start = 220;
  for (let i = 0; i < 15; i++) {
    spots.set(96 + i, {
      x: x96,
      y: y96Start + i * (hH + gap),
      w: hW,
      h: hH,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 70-95: Two paired columns, left-center, horizontal orientation
  // Pairs: 70,71 / 72,73 / ... / 94,95 (13 rows × 2 cols)
  // ═══════════════════════════════════════════════════════════════════════════
  const x70col1 = 120;
  const x70col2 = x70col1 + hW + gap;
  const y70Start = 220;
  for (let i = 0; i < 13; i++) {
    const y = y70Start + i * (hH + gap);
    spots.set(70 + i * 2, { x: x70col1, y, w: hW, h: hH });
    spots.set(71 + i * 2, { x: x70col2, y, w: hW, h: hH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 44-69: Two paired columns, center-left, horizontal orientation
  // Pairs: 44,45 / 46,47 / ... / 68,69 (13 rows × 2 cols)
  // ═══════════════════════════════════════════════════════════════════════════
  const x44col1 = 280;
  const x44col2 = x44col1 + hW + gap;
  const y44Start = 220;
  for (let i = 0; i < 13; i++) {
    const y = y44Start + i * (hH + gap);
    spots.set(44 + i * 2, { x: x44col1, y, w: hW, h: hH });
    spots.set(45 + i * 2, { x: x44col2, y, w: hW, h: hH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 1-11: Horizontal row of vertical spots, top-right area
  // ═══════════════════════════════════════════════════════════════════════════
  const x1Start = 540;
  const y1 = 160;
  for (let i = 0; i < 11; i++) {
    spots.set(1 + i, {
      x: x1Start + i * (vW + gap),
      y: y1,
      w: vW,
      h: vH,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 12-19 & 20-27: Two rows of vertical spots, center-right
  // ═══════════════════════════════════════════════════════════════════════════
  const x12Start = 540;
  const y12 = 310;
  const y20 = y12 + vH + gap;
  for (let i = 0; i < 8; i++) {
    spots.set(12 + i, { x: x12Start + i * (vW + gap), y: y12, w: vW, h: vH });
    spots.set(20 + i, { x: x12Start + i * (vW + gap), y: y20, w: vW, h: vH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 28-35 & 36-43: Two rows of vertical spots, bottom-right
  // ═══════════════════════════════════════════════════════════════════════════
  const x28Start = 540;
  const y28 = 490;
  const y36 = y28 + vH + gap;
  for (let i = 0; i < 8; i++) {
    spots.set(28 + i, { x: x28Start + i * (vW + gap), y: y28, w: vW, h: vH });
    spots.set(36 + i, { x: x28Start + i * (vW + gap), y: y36, w: vW, h: vH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTS 111-118: Sucios column, between naves, near top-center
  // Horizontal orientation, stacked vertically
  // ═══════════════════════════════════════════════════════════════════════════
  const xSucios = 380;
  const ySuciosStart = 55;
  for (let i = 0; i < 8; i++) {
    spots.set(111 + i, {
      x: xSucios,
      y: ySuciosStart + i * (hH + gap),
      w: hW,
      h: hH,
    });
  }

  return spots;
}

const SPOT_GEOMETRY = buildSpotGeometry();

// ─── SVG Parking Map Component ──────────────────────────────────────────────
function ParkingMapSVG({
  spotByNumber,
  highlightedSpotNum,
  onSpotClick,
}: {
  spotByNumber: Map<number, ParkingSpot>;
  highlightedSpotNum: number | null;
  onSpotClick: (spot: ParkingSpot) => void;
}) {
  return (
    <svg
      viewBox="0 0 1200 820"
      className="w-full h-auto"
      style={{ maxHeight: '75vh' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ─── Defs: highlight animation ─── */}
      <defs>
        <style>{`
          @keyframes pulseHighlight {
            0%, 100% { stroke-opacity: 1; stroke-width: 3; }
            50% { stroke-opacity: 0.4; stroke-width: 5; }
          }
          .spot-highlight {
            animation: pulseHighlight 1s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* ─── Background: asphalt ─── */}
      <rect x="0" y="0" width="1200" height="820" fill="#374151" rx="8" />

      {/* ─── Lot boundary ─── */}
      <rect
        x="15" y="15" width="1170" height="790"
        fill="none" stroke="#6b7280" strokeWidth="2" strokeDasharray="8 4" rx="6"
      />

      {/* ─── Buildings / Naves (top) ─── */}
      <rect x="30" y="30" width="340" height="160" fill="#4b5563" stroke="#9ca3af" strokeWidth="1.5" rx="3" />
      <text x="200" y="115" textAnchor="middle" fill="#d1d5db" fontSize="14" fontWeight="600">NAVES / TALLER</text>
      {/* Roof pattern */}
      <line x1="30" y1="30" x2="200" y2="110" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="200" y1="110" x2="370" y2="30" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="30" y1="110" x2="200" y2="190" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="200" y1="190" x2="370" y2="110" stroke="#6b7280" strokeWidth="0.8" />

      {/* ─── Sucios zone label ─── */}
      <rect x="370" y="30" width="70" height="18" fill="#92400e" rx="3" />
      <text x="405" y="43" textAnchor="middle" fill="#fef3c7" fontSize="9" fontWeight="700">SUCIOS</text>

      {/* ─── Oficina Azul Cars ─── */}
      <rect x="820" y="280" width="140" height="80" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="1.5" rx="4" />
      <text x="890" y="315" textAnchor="middle" fill="#93c5fd" fontSize="11" fontWeight="600">OFICINA</text>
      <text x="890" y="332" textAnchor="middle" fill="#bfdbfe" fontSize="10">Azul Cars</text>

      {/* ─── Exit / SALIDA (bottom-center) ─── */}
      <rect x="530" y="740" width="120" height="40" fill="#065f46" stroke="#34d399" strokeWidth="1.5" rx="4" />
      <text x="590" y="763" textAnchor="middle" fill="#a7f3d0" fontSize="12" fontWeight="700">SALIDA ↓</text>
      {/* Arrow */}
      <polygon points="580,785 600,800 590,800 590,810 570,810 570,800 560,800" fill="#34d399" opacity="0.7" />

      {/* ─── Road: Camí Fondo (right side) ─── */}
      <rect x="1050" y="30" width="120" height="760" fill="#1f2937" stroke="#4b5563" strokeWidth="1" rx="3" />
      <text x="1110" y="420" textAnchor="middle" fill="#9ca3af" fontSize="11" fontWeight="500"
        transform="rotate(90, 1110, 420)">CAMÍ FONDO</text>

      {/* ─── Road: Son Maiferit (bottom) ─── */}
      <rect x="30" y="780" width="1000" height="25" fill="#1f2937" stroke="#4b5563" strokeWidth="1" rx="3" />
      <text x="530" y="797" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="500">SON MAIFERIT</text>

      {/* ─── Driving lanes (dashed lines) ─── */}
      {/* Horizontal lane between naves and parking */}
      <line x1="30" y1="200" x2="1040" y2="200" stroke="#6b7280" strokeWidth="1" strokeDasharray="6 4" />
      {/* Vertical lane between columns 96 and 70-95 */}
      <line x1="95" y1="210" x2="95" y2="660" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="4 3" />
      {/* Vertical lane between 70-95 and 44-69 */}
      <line x1="240" y1="210" x2="240" y2="660" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="4 3" />
      {/* Vertical lane between 44-69 and right blocks */}
      <line x1="400" y1="210" x2="400" y2="660" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="4 3" />
      {/* Horizontal lane below spots 1-11 */}
      <line x1="530" y1="220" x2="920" y2="220" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="4 3" />

      {/* ─── Zone labels ─── */}
      <text x="56" y="210" fill="#9ca3af" fontSize="8" fontWeight="500">96-110</text>
      <text x="155" y="210" fill="#9ca3af" fontSize="8" fontWeight="500">70-95</text>
      <text x="310" y="210" fill="#9ca3af" fontSize="8" fontWeight="500">44-69</text>
      <text x="680" y="150" fill="#9ca3af" fontSize="8" fontWeight="500">1-11</text>
      <text x="640" y="300" fill="#9ca3af" fontSize="8" fontWeight="500">12-27</text>
      <text x="640" y="480" fill="#9ca3af" fontSize="8" fontWeight="500">28-43</text>

      {/* ─── Decorative trees ─── */}
      {[
        [980, 200], [1000, 350], [980, 500], [1000, 650],
        [450, 700], [550, 700], [650, 700], [750, 700],
      ].map(([cx, cy], i) => (
        <circle key={`tree-${i}`} cx={cx} cy={cy} r="8" fill="#166534" opacity="0.6" />
      ))}

      {/* ─── Parking Spots ─── */}
      {Array.from(SPOT_GEOMETRY.entries()).map(([num, rect]) => {
        const spot = spotByNumber.get(num);
        const isOccupied = spot?.status === 'occupied';
        const isBlocked = spot?.status === 'blocked';
        const isReserved = spot?.status === 'reserved';
        const isHighlighted = highlightedSpotNum === num;

        let fillColor = '#22c55e'; // green (free)
        let strokeColor = '#16a34a';
        if (isOccupied) {
          fillColor = '#dc2626';
          strokeColor = '#991b1b';
        } else if (isBlocked) {
          fillColor = '#6b7280';
          strokeColor = '#4b5563';
        } else if (isReserved) {
          fillColor = '#3b82f6';
          strokeColor = '#1d4ed8';
        }

        // Determine text content
        let label = String(num);
        if (isOccupied && spot?.vehicle_matricula) {
          const plate = spot.vehicle_matricula;
          label = plate.length > 7 ? plate.slice(-7) : plate;
        }

        // Font size based on spot orientation
        const isHorizontal = rect.w > rect.h;
        const fontSize = isOccupied && spot?.vehicle_matricula
          ? (isHorizontal ? 8 : 7)
          : (isHorizontal ? 9 : 8);

        return (
          <g
            key={num}
            onClick={() => spot && onSpotClick(spot)}
            style={{ cursor: spot ? 'pointer' : 'default' }}
            className="transition-opacity hover:opacity-80"
          >
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="1.2"
              rx="2"
            />
            {/* Highlight ring */}
            {isHighlighted && (
              <rect
                x={rect.x - 3}
                y={rect.y - 3}
                width={rect.w + 6}
                height={rect.h + 6}
                fill="none"
                stroke="#facc15"
                strokeWidth="3"
                rx="4"
                className="spot-highlight"
              />
            )}
            {/* Label text */}
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + rect.h / 2 + fontSize / 3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={fontSize}
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
              style={{ pointerEvents: 'none' }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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

      {/* ─── PURE SVG PARKING MAP ─────────────────────────────────── */}
      {!isLoading && overview && (
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <ParkingMapSVG
            spotByNumber={spotByNumber}
            highlightedSpotNum={highlightedSpotNum}
            onSpotClick={handleSpotClick}
          />

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-green-500 border border-green-600" />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-red-600" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-blue-500" />
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
