/**
 * Parking Map — Pure SVG schematic of the Azul Cars campa.
 * EXACT TRACE of the real aerial photo layout.
 * Zones numbered 1-8 + Sucios, spots numbered sequentially.
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
// ViewBox: 1200 × 1000 (landscape, matching the real lot proportions from aerial photo)
// This is an EXACT TRACE of the annotated aerial photograph.
interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildSpotGeometry(): Map<number, SpotRect> {
  const spots = new Map<number, SpotRect>();

  // ─── Spot dimensions ───
  // Vertical columns (zones 4-8): spots are HORIZONTAL rectangles stacked vertically
  const colSpotW = 42; // width of a spot in vertical columns
  const colSpotH = 36; // height of a spot in vertical columns
  const colGapV = 5;   // vertical gap between spots in a column

  // Horizontal rows (zones 1-3): spots are VERTICAL rectangles in a row
  const rowSpotW = 32; // width of a spot in horizontal rows
  const rowSpotH = 44; // height of a spot in horizontal rows
  const rowGapH = 4;   // horizontal gap between spots in a row

  // Sucios: vertical column of square-ish spots
  const sucioW = 36;
  const sucioH = 36;
  const sucioGap = 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 1: Spots 1-11 — Horizontal row, TOP-RIGHT
  // Single row of 11 vertical spots going left to right
  // ═══════════════════════════════════════════════════════════════════════════
  const z1_x = 500;
  const z1_y = 170;
  for (let i = 0; i < 11; i++) {
    spots.set(1 + i, {
      x: z1_x + i * (rowSpotW + rowGapH),
      y: z1_y,
      w: rowSpotW,
      h: rowSpotH,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 2: Spots 12-27 — 2 rows × 8, CENTER-RIGHT (left of office)
  // ═══════════════════════════════════════════════════════════════════════════
  const z2_x = 500;
  const z2_y1 = 370; // top row
  const z2_y2 = z2_y1 + rowSpotH + rowGapH; // bottom row
  for (let i = 0; i < 8; i++) {
    spots.set(12 + i, { x: z2_x + i * (rowSpotW + rowGapH), y: z2_y1, w: rowSpotW, h: rowSpotH });
    spots.set(20 + i, { x: z2_x + i * (rowSpotW + rowGapH), y: z2_y2, w: rowSpotW, h: rowSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 3: Spots 28-43 — 2 rows × 8, BOTTOM-RIGHT
  // ═══════════════════════════════════════════════════════════════════════════
  const z3_x = 500;
  const z3_y1 = 600; // top row
  const z3_y2 = z3_y1 + rowSpotH + rowGapH; // bottom row
  for (let i = 0; i < 8; i++) {
    spots.set(28 + i, { x: z3_x + i * (rowSpotW + rowGapH), y: z3_y1, w: rowSpotW, h: rowSpotH });
    spots.set(36 + i, { x: z3_x + i * (rowSpotW + rowGapH), y: z3_y2, w: rowSpotW, h: rowSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEFT-SIDE VERTICAL COLUMNS (Zones 4-8)
  // From the aerial photo, reading RIGHT to LEFT:
  //   Zone 4 (rightmost) + Zone 5 form a PAIR
  //   Zone 6 + Zone 7 form a PAIR
  //   Zone 8 is alone on the far left
  // Each column has 13 spots EXCEPT zone 8 which has 15
  // ═══════════════════════════════════════════════════════════════════════════

  // Starting Y for all left-side columns (below the naves)
  const colStartY = 280;

  // Zone 4: rightmost column of the right pair (13 spots)
  const z4_x = 345;
  for (let i = 0; i < 13; i++) {
    spots.set(44 + i, { x: z4_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 5: left column of the right pair (13 spots)
  const z5_x = z4_x - colSpotW - 6; // small gap between paired columns
  for (let i = 0; i < 13; i++) {
    spots.set(57 + i, { x: z5_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 6: right column of the left pair (13 spots)
  const z6_x = z5_x - colSpotW - 40; // driving lane between pairs
  for (let i = 0; i < 13; i++) {
    spots.set(70 + i, { x: z6_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 7: left column of the left pair (13 spots)
  const z7_x = z6_x - colSpotW - 6; // small gap between paired columns
  for (let i = 0; i < 13; i++) {
    spots.set(83 + i, { x: z7_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 8: single column, far left (15 spots)
  const z8_x = z7_x - colSpotW - 40; // driving lane
  for (let i = 0; i < 15; i++) {
    spots.set(96 + i, { x: z8_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCIOS: Spots 111-118 — Vertical column, between naves and right area
  // 8 spots in green, top area
  // ═══════════════════════════════════════════════════════════════════════════
  const zS_x = 370;
  const zS_y = 35;
  for (let i = 0; i < 8; i++) {
    spots.set(111 + i, {
      x: zS_x,
      y: zS_y + i * (sucioH + sucioGap),
      w: sucioW,
      h: sucioH,
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
      viewBox="0 0 1200 1000"
      className="w-full h-auto"
      style={{ maxHeight: '78vh' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ─── Defs ─── */}
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

      {/* ─── Background: concrete/asphalt ground ─── */}
      <rect x="0" y="0" width="1200" height="1000" fill="#5c5c52" />

      {/* ─── Lot boundary (irregular polygon - red border like the photo) ─── */}
      <polygon
        points="25,20 380,20 420,20 950,20 1100,80 1100,850 1050,950 25,950"
        fill="#7a7568"
        stroke="#dc2626"
        strokeWidth="3"
      />

      {/* ─── NAVES / TALLER (top-left, two buildings with curved roofs) ─── */}
      {/* Nave 1 (upper) */}
      <rect x="35" y="30" width="300" height="100" fill="#8a8a8a" stroke="#aaa" strokeWidth="1.5" rx="2" />
      <path d="M 40,45 Q 185,30 330,45" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,65 Q 185,50 330,65" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,85 Q 185,70 330,85" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,105 Q 185,90 330,105" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,120 Q 185,105 330,120" fill="none" stroke="#bbb" strokeWidth="1.5" />
      {/* Nave 2 (lower) */}
      <rect x="35" y="140" width="300" height="100" fill="#8a8a8a" stroke="#aaa" strokeWidth="1.5" rx="2" />
      <path d="M 40,155 Q 185,140 330,155" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,175 Q 185,160 330,175" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,195 Q 185,180 330,195" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,215 Q 185,200 330,215" fill="none" stroke="#bbb" strokeWidth="1.5" />
      <path d="M 40,230 Q 185,215 330,230" fill="none" stroke="#bbb" strokeWidth="1.5" />

      {/* ─── OFICINA Azul Cars (center-right, glass building) ─── */}
      <rect x="830" y="290" width="150" height="160" fill="#1e293b" stroke="#475569" strokeWidth="2" rx="3" />
      <rect x="840" y="300" width="130" height="140" fill="none" stroke="#64748b" strokeWidth="0.8" rx="2" />
      <line x1="840" y1="300" x2="970" y2="440" stroke="#475569" strokeWidth="0.5" opacity="0.5" />
      <line x1="970" y1="300" x2="840" y2="440" stroke="#475569" strokeWidth="0.5" opacity="0.5" />
      <text x="905" y="370" textAnchor="middle" fill="#94a3b8" fontSize="14" fontWeight="600">OFICINA</text>
      <text x="905" y="392" textAnchor="middle" fill="#64748b" fontSize="11">Azul Cars</text>

      {/* ─── SUCIOS label (top, above the green spots) ─── */}
      <rect x="350" y="5" width="80" height="24" fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="12" />
      <text x="390" y="21" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">SUCIOS</text>
      {/* Arrow indicating direction */}
      <line x1="390" y1="32" x2="390" y2="365" stroke="#ffffff" strokeWidth="2" markerEnd="url(#arrowDown)" markerStart="url(#arrowUp)" opacity="0.6" />
      <defs>
        <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M 1,1 L 4,7 L 7,1" fill="none" stroke="#fff" strokeWidth="1.5" />
        </marker>
        <marker id="arrowUp" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M 1,7 L 4,1 L 7,7" fill="none" stroke="#fff" strokeWidth="1.5" />
        </marker>
      </defs>

      {/* ─── Zone labels (matching the annotated photo style) ─── */}
      {/* Zone 1 */}
      <rect x="488" y="148" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="500" y="163" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">1</text>
      {/* Zone 2 */}
      <rect x="488" y="348" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="500" y="363" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">2</text>
      {/* Zone 3 */}
      <rect x="488" y="578" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="500" y="593" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">3</text>
      {/* Zone 4 */}
      <rect x="354" y="820" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="366" y="835" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">4</text>
      {/* Zone 5 */}
      <rect x="306" y="820" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="318" y="835" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">5</text>
      {/* Zone 6 */}
      <rect x="218" y="820" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="230" y="835" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">6</text>
      {/* Zone 7 */}
      <rect x="170" y="820" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="182" y="835" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">7</text>
      {/* Zone 8 */}
      <rect x="30" y="260" width="24" height="20" fill="#1e293b" stroke="#fff" strokeWidth="1" rx="3" />
      <text x="42" y="275" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">8</text>

      {/* ─── Parking Spots ─── */}
      {Array.from(SPOT_GEOMETRY.entries()).map(([num, rect]) => {
        const spot = spotByNumber.get(num);
        const isOccupied = spot?.status === 'occupied';
        const isBlocked = spot?.status === 'blocked';
        const isReserved = spot?.status === 'reserved';
        const isSucios = num >= 111 && num <= 118;
        const isHighlighted = highlightedSpotNum === num;

        let fillColor = '#1e40af'; // dark blue (matching the aerial photo)
        let strokeColor = '#1d4ed8';
        if (isSucios && !isOccupied) {
          fillColor = '#65a30d'; // lime green for sucios (free)
          strokeColor = '#4d7c0f';
        }
        if (isOccupied) {
          fillColor = '#dc2626'; // red
          strokeColor = '#991b1b';
        } else if (isBlocked) {
          fillColor = '#6b7280'; // gray
          strokeColor = '#4b5563';
        } else if (isReserved) {
          fillColor = '#f59e0b'; // amber
          strokeColor = '#d97706';
        }

        // Label
        let label = String(num);
        if (isOccupied && spot?.vehicle_matricula) {
          const plate = spot.vehicle_matricula;
          label = plate.length > 7 ? plate.slice(-7) : plate;
        }

        const fontSize = isOccupied && spot?.vehicle_matricula ? 7 : 9;

        return (
          <g
            key={num}
            onClick={() => spot && onSpotClick(spot)}
            style={{ cursor: spot ? 'pointer' : 'default' }}
          >
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="1.2"
              rx="3"
              className="transition-opacity hover:opacity-75"
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
                rx="5"
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
              style={{ pointerEvents: 'none', userSelect: 'none' }}
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
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#1e40af' }} />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-red-600" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#65a30d' }} />
              <span>Sucios</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-amber-500" />
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
