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
// ViewBox: 1200 × 900 (landscape, matching the real lot proportions from aerial photo)
// EXACT TRACE: positions measured proportionally from the annotated aerial photograph.
// The left-side columns (zones 4-8) occupy ~55% of width. Right side (zones 1-3 + office) ~45%.
interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildSpotGeometry(): Map<number, SpotRect> {
  const spots = new Map<number, SpotRect>();

  // ─── Dimensions calibrated from aerial photo ───
  // Vertical columns (zones 4-8): spots are WIDE rectangles stacked vertically
  const colSpotW = 50;  // wide — matches the photo where spots are wider than tall
  const colSpotH = 38;
  const colGapV = 6;    // vertical gap between spots in a column
  const pairGap = 8;    // gap between two columns in a pair
  const laneGap = 50;   // driving lane between pairs

  // Horizontal rows (zones 1-3): spots in a horizontal line
  const rowSpotW = 38;
  const rowSpotH = 38;
  const rowGapH = 5;

  // Sucios: slightly smaller squares
  const sucioW = 38;
  const sucioH = 38;
  const sucioGap = 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // LEFT-SIDE VERTICAL COLUMNS (Zones 4-8)
  // From the photo reading LEFT to RIGHT:
  //   Zone 8 (single, far left)
  //   [lane]
  //   Zone 7 (left of left pair)
  //   Zone 6 (right of left pair)
  //   [lane]
  //   Zone 5 (left of right pair)
  //   Zone 4 (right of right pair)
  // Each zone = 1 independent column. 13 spots each, except zone 8 = 15.
  // ═══════════════════════════════════════════════════════════════════════════

  const colStartY = 260; // below the naves

  // Zone 8: single column, far left (15 spots)
  const z8_x = 55;
  for (let i = 0; i < 15; i++) {
    spots.set(96 + i, { x: z8_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 7: left column of the left pair (13 spots)
  const z7_x = z8_x + colSpotW + laneGap;
  for (let i = 0; i < 13; i++) {
    spots.set(83 + i, { x: z7_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 6: right column of the left pair (13 spots)
  const z6_x = z7_x + colSpotW + pairGap;
  for (let i = 0; i < 13; i++) {
    spots.set(70 + i, { x: z6_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 5: left column of the right pair (13 spots)
  const z5_x = z6_x + colSpotW + laneGap;
  for (let i = 0; i < 13; i++) {
    spots.set(57 + i, { x: z5_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // Zone 4: right column of the right pair (13 spots)
  const z4_x = z5_x + colSpotW + pairGap;
  for (let i = 0; i < 13; i++) {
    spots.set(44 + i, { x: z4_x, y: colStartY + i * (colSpotH + colGapV), w: colSpotW, h: colSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCIOS: Spots 111-118 — Vertical column, to the RIGHT of the naves
  // 8 spots in green, top area. In the photo they start at the top and go down.
  // ═══════════════════════════════════════════════════════════════════════════
  const zS_x = 395;
  const zS_y = 40;
  for (let i = 0; i < 8; i++) {
    spots.set(111 + i, {
      x: zS_x,
      y: zS_y + i * (sucioH + sucioGap),
      w: sucioW,
      h: sucioH,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RIGHT SIDE: Zones 1, 2, 3
  // Zone 1: horizontal row of 11 spots, top-right
  // Zone 2: 2 rows × 8 = 16 spots, center-right (left of office)
  // Zone 3: 2 rows × 8 = 16 spots, bottom-right
  // ═══════════════════════════════════════════════════════════════════════════

  // Zone 1: 11 spots in a single horizontal row, top-right area
  const z1_x = 590;
  const z1_y = 210;
  for (let i = 0; i < 11; i++) {
    spots.set(1 + i, {
      x: z1_x + i * (rowSpotW + rowGapH),
      y: z1_y,
      w: rowSpotW,
      h: rowSpotH,
    });
  }

  // Zone 2: 2 rows × 8, center-right
  const z2_x = 590;
  const z2_y1 = 380;
  const z2_y2 = z2_y1 + rowSpotH + rowGapH;
  for (let i = 0; i < 8; i++) {
    spots.set(12 + i, { x: z2_x + i * (rowSpotW + rowGapH), y: z2_y1, w: rowSpotW, h: rowSpotH });
    spots.set(20 + i, { x: z2_x + i * (rowSpotW + rowGapH), y: z2_y2, w: rowSpotW, h: rowSpotH });
  }

  // Zone 3: 2 rows × 8, bottom-right
  const z3_x = 590;
  const z3_y1 = 570;
  const z3_y2 = z3_y1 + rowSpotH + rowGapH;
  for (let i = 0; i < 8; i++) {
    spots.set(28 + i, { x: z3_x + i * (rowSpotW + rowGapH), y: z3_y1, w: rowSpotW, h: rowSpotH });
    spots.set(36 + i, { x: z3_x + i * (rowSpotW + rowGapH), y: z3_y2, w: rowSpotW, h: rowSpotH });
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
      viewBox="0 0 1200 900"
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

      {/* ─── Background: dark outside the lot ─── */}
      <rect x="0" y="0" width="1200" height="900" fill="#1a1a1a" />

      {/* ─── Lot boundary (irregular polygon - red border like the photo) ─── */}
      <polygon
        points="30,25 390,25 450,25 1050,25 1140,100 1140,750 1080,870 30,870"
        fill="#6b6560"
        stroke="#dc2626"
        strokeWidth="3"
      />

      {/* ─── NAVES / TALLER (top-left, two buildings with curved roofs) ─── */}
      {/* Nave 1 (upper) */}
      <rect x="40" y="35" width="320" height="95" fill="#7a7a7a" stroke="#999" strokeWidth="1.5" rx="2" />
      <path d="M 45,50 Q 200,35 355,50" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,68 Q 200,53 355,68" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,86 Q 200,71 355,86" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,104 Q 200,89 355,104" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,120 Q 200,105 355,120" fill="none" stroke="#aaa" strokeWidth="1.2" />
      {/* Nave 2 (lower) */}
      <rect x="40" y="138" width="320" height="95" fill="#7a7a7a" stroke="#999" strokeWidth="1.5" rx="2" />
      <path d="M 45,153 Q 200,138 355,153" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,171 Q 200,156 355,171" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,189 Q 200,174 355,189" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,207 Q 200,192 355,207" fill="none" stroke="#aaa" strokeWidth="1.2" />
      <path d="M 45,223 Q 200,208 355,223" fill="none" stroke="#aaa" strokeWidth="1.2" />

      {/* ─── OFICINA Azul Cars (right side, glass building) ─── */}
      <rect x="940" y="280" width="150" height="170" fill="#1e293b" stroke="#475569" strokeWidth="2" rx="3" />
      <rect x="950" y="290" width="130" height="150" fill="none" stroke="#64748b" strokeWidth="0.8" rx="2" />
      <line x1="950" y1="290" x2="1080" y2="440" stroke="#475569" strokeWidth="0.5" opacity="0.4" />
      <line x1="1080" y1="290" x2="950" y2="440" stroke="#475569" strokeWidth="0.5" opacity="0.4" />
      <text x="1015" y="365" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="600">OFICINA</text>
      <text x="1015" y="385" textAnchor="middle" fill="#64748b" fontSize="10">Azul Cars</text>

      {/* ─── SUCIOS label (top center, above the green spots) ─── */}
      <rect x="385" y="8" width="80" height="24" fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="12" />
      <text x="425" y="24" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">SUCIOS</text>
      {/* Arrow indicating direction */}
      <line x1="414" y1="395" x2="414" y2="50" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
      <polygon points="414,45 408,58 420,58" fill="#fff" opacity="0.5" />
      <polygon points="414,400 408,387 420,387" fill="#fff" opacity="0.5" />

      {/* ─── Zone labels (matching the annotated photo style — dark badge with white border) ─── */}
      {/* Zone 8 — far left */}
      <rect x="35" y="240" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="48" y="256" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">8</text>
      {/* Zone 7 — bottom of zone 7 column */}
      <rect x="143" y="840" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="156" y="856" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">7</text>
      {/* Zone 6 — bottom of zone 6 column */}
      <rect x="201" y="840" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="214" y="856" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">6</text>
      {/* Zone 5 — bottom of zone 5 column */}
      <rect x="301" y="840" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="314" y="856" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">5</text>
      {/* Zone 4 — bottom of zone 4 column */}
      <rect x="359" y="840" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="372" y="856" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">4</text>
      {/* Zone 1 — top-right */}
      <rect x="568" y="188" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="581" y="204" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">1</text>
      {/* Zone 2 — center-right */}
      <rect x="568" y="358" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="581" y="374" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">2</text>
      {/* Zone 3 — bottom-right */}
      <rect x="568" y="548" width="26" height="22" fill="#1e293b" stroke="#fff" strokeWidth="1.2" rx="4" />
      <text x="581" y="564" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">3</text>

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
