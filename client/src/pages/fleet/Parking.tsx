/**
 * Parking Map — Clean schematic SVG matching the real Azul Cars campa layout.
 * 
 * Layout from the aerial photo (looking down):
 * - The lot is roughly square, slightly wider than tall
 * - Top area: buildings/naves (grey structures)
 * - Left column (96-110): 15 spots, single vertical column, horizontal orientation
 * - Left-center block (70-95): 2 vertical columns × 13 rows, horizontal orientation
 * - Top-center column (sucios area): ~8 spots vertical, horizontal orientation  
 * - Center block (44-69): 2 vertical columns × 13 rows, horizontal orientation
 * - Top-right row (1-11): horizontal row, vertical orientation spots
 * - Mid-right block (12-19, 20-27): 2 horizontal rows × 8, vertical orientation
 * - Bottom-right block (28-35, 36-43): 2 horizontal rows × 8, vertical orientation
 * - Office building: center-right area
 * - Exit (SALIDA): bottom-center
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
// ViewBox: 1000 x 1000 (square, matching the roughly square lot)
const VW = 1000;
const VH = 1000;

/**
 * Spot coordinates carefully mapped from the aerial photo.
 * 
 * Key observations from the image:
 * - Spots in LEFT zones (96-110, 70-95, 44-69) are HORIZONTAL rectangles (wider than tall)
 *   arranged in VERTICAL columns
 * - Spots in RIGHT zones (1-11, 12-27, 28-43) are VERTICAL rectangles (taller than wide)
 *   arranged in HORIZONTAL rows
 * - The "sucios" column at top-center has ~8 horizontal spots in a vertical column
 */

// Horizontal spot (wider than tall) - used for left-side columns
const HW = 48; // width of horizontal spot
const HH = 26; // height of horizontal spot

// Vertical spot (taller than wide) - used for right-side rows  
const VSpotW = 30; // width of vertical spot
const VSpotH = 44; // height of vertical spot

const VGAP = 3; // vertical gap between spots in a column
const HGAP = 3; // horizontal gap between spots in a row

function buildSpotCoords(): Map<number, { x: number; y: number; w: number; h: number }> {
  const coords = new Map<number, { x: number; y: number; w: number; h: number }>();

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA IZQUIERDA - Plazas 96-110: Single vertical column, far left
  // 15 horizontal spots stacked vertically
  // ═══════════════════════════════════════════════════════════════════════════
  const x96 = 30;
  const y96Start = 290;
  for (let i = 0; i < 15; i++) {
    coords.set(96 + i, { x: x96, y: y96Start + i * (HH + VGAP), w: HW, h: HH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA CENTRAL IZQUIERDA - Plazas 70-95: Two vertical columns
  // 13 rows × 2 columns of horizontal spots
  // Pairs: 70,71 / 72,73 / 74,75 / ... / 94,95
  // ═══════════════════════════════════════════════════════════════════════════
  const x70col1 = 130;
  const x70col2 = x70col1 + HW + HGAP;
  const y70Start = 290;
  for (let i = 0; i < 13; i++) {
    const y = y70Start + i * (HH + VGAP);
    coords.set(70 + i * 2, { x: x70col1, y, w: HW, h: HH });
    coords.set(71 + i * 2, { x: x70col2, y, w: HW, h: HH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA SUPERIOR CENTRAL - "Sucios" column: ~8 spots
  // These are the spots visible in the top-center of the image
  // Vertical column of horizontal spots, between the buildings
  // In the numbered plan these don't have numbers, but in the DB they might
  // be part of the 44-69 block. Looking at the plan image:
  // The column at top-center appears to be spots that go into the "sucios" area
  // ═══════════════════════════════════════════════════════════════════════════
  // (These are part of the visual structure but may not have spot numbers assigned)

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA CENTRAL PRINCIPAL - Plazas 44-69: Two vertical columns
  // 13 rows × 2 columns of horizontal spots
  // Pairs: 44,45 / 46,47 / ... / 68,69
  // Position: center of the lot, to the right of 70-95 with a driving lane between
  // ═══════════════════════════════════════════════════════════════════════════
  const x44col1 = 330;
  const x44col2 = x44col1 + HW + HGAP;
  const y44Start = 290;
  for (let i = 0; i < 13; i++) {
    const y = y44Start + i * (HH + VGAP);
    coords.set(44 + i * 2, { x: x44col1, y, w: HW, h: HH });
    coords.set(45 + i * 2, { x: x44col2, y, w: HW, h: HH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA SUPERIOR DERECHA - Plazas 1-11: Horizontal row
  // 11 vertical spots arranged left to right
  // Position: top-right area of the lot
  // ═══════════════════════════════════════════════════════════════════════════
  const x1Start = 530;
  const y1 = 260;
  for (let i = 0; i < 11; i++) {
    coords.set(1 + i, { x: x1Start + i * (VSpotW + HGAP), y: y1, w: VSpotW, h: VSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA MEDIA DERECHA - Plazas 12-19 y 20-27: Two horizontal rows
  // 8 vertical spots per row
  // Position: center-right, below the office building
  // ═══════════════════════════════════════════════════════════════════════════
  const x12Start = 500;
  const y12 = 490;
  const y20 = y12 + VSpotH + VGAP;
  for (let i = 0; i < 8; i++) {
    coords.set(12 + i, { x: x12Start + i * (VSpotW + HGAP), y: y12, w: VSpotW, h: VSpotH });
    coords.set(20 + i, { x: x12Start + i * (VSpotW + HGAP), y: y20, w: VSpotW, h: VSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA INFERIOR DERECHA - Plazas 28-35 y 36-43: Two horizontal rows
  // 8 vertical spots per row
  // Position: bottom-right area
  // ═══════════════════════════════════════════════════════════════════════════
  const x28Start = 500;
  const y28 = 650;
  const y36 = y28 + VSpotH + VGAP;
  for (let i = 0; i < 8; i++) {
    coords.set(28 + i, { x: x28Start + i * (VSpotW + HGAP), y: y28, w: VSpotW, h: VSpotH });
    coords.set(36 + i, { x: x28Start + i * (VSpotW + HGAP), y: y36, w: VSpotW, h: VSpotH });
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
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-[#e8e4df]">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="w-full h-auto"
            style={{ minHeight: '450px', maxHeight: '72vh' }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* ─── Asphalt background ─────────────────────────────────── */}
            <rect x="0" y="0" width={VW} height={VH} fill="#c4bfb8" />

            {/* ─── Property boundary (red line) ───────────────────────── */}
            <polygon
              points="10,10 480,10 480,230 970,230 970,10 990,10 990,900 950,960 850,980 100,980 10,980"
              fill="none"
              stroke="#dc2626"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* ─── Buildings / Naves (top area) ───────────────────────── */}
            {/* Left nave 1 */}
            <rect x="30" y="30" width="120" height="100" rx="3" fill="#a8a8a8" stroke="#888" strokeWidth="1" />
            {/* Left nave 2 */}
            <rect x="30" y="145" width="120" height="100" rx="3" fill="#a8a8a8" stroke="#888" strokeWidth="1" />
            {/* Top-center structures */}
            <rect x="200" y="30" width="80" height="180" rx="3" fill="#9a9a9a" stroke="#888" strokeWidth="1" />
            {/* Top-right structures (various containers/buildings) */}
            <rect x="500" y="30" width="60" height="100" rx="2" fill="#6b8e8e" stroke="#5a7a7a" strokeWidth="1" />
            <rect x="580" y="30" width="50" height="120" rx="2" fill="#7a9090" stroke="#5a7a7a" strokeWidth="1" />
            <rect x="650" y="30" width="80" height="100" rx="2" fill="#5a7878" stroke="#4a6868" strokeWidth="1" />
            <rect x="750" y="30" width="60" height="90" rx="2" fill="#8a8a8a" stroke="#6a6a6a" strokeWidth="1" />
            <rect x="830" y="30" width="70" height="110" rx="2" fill="#7a7a7a" stroke="#5a5a5a" strokeWidth="1" />

            {/* ─── Office building (center-right) ─────────────────────── */}
            <rect x="760" y="340" width="180" height="130" rx="4" fill="#8a9aa8" stroke="#6a7a88" strokeWidth="1.5" />

            {/* ─── Sucios column (top-center, vertical column of ~8 spots) ─── */}
            {/* These appear as the column between the buildings in the aerial photo */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <rect
                key={`sucios-${i}`}
                x={295}
                y={40 + i * (HH + VGAP)}
                width={HW - 10}
                height={HH - 4}
                rx="2"
                fill="#f5c542"
                stroke="#c9a030"
                strokeWidth="0.8"
                opacity="0.6"
              />
            ))}

            {/* ─── Render all numbered parking spots ──────────────────── */}
            {Array.from(SPOT_COORDS.entries()).map(([num, pos]) => {
              const spot = spotByNumber.get(num);
              const isOccupied = spot?.status === 'occupied';
              const isBlocked = spot?.status === 'blocked';
              const isReserved = spot?.status === 'reserved';
              const isHighlighted = highlightedSpotNum === num;

              // Colors matching the spec: yellow for spots
              let fill = '#f5c542'; // yellow (free)
              let stroke = '#c9a030';
              let textColor = '#1a1a1a';

              if (isOccupied) {
                fill = '#e85d5d'; // red
                stroke = '#b84040';
                textColor = '#ffffff';
              } else if (isBlocked) {
                fill = '#6b7280';
                stroke = '#4b5563';
                textColor = '#ffffff';
              } else if (isReserved) {
                fill = '#60a5fa';
                stroke = '#3b82f6';
                textColor = '#ffffff';
              }

              const fontSize = pos.w > pos.h
                ? Math.min(10, pos.h * 0.38) // horizontal spot
                : Math.min(9, pos.w * 0.32); // vertical spot

              return (
                <g
                  key={num}
                  onClick={() => spot && handleSpotClick(spot)}
                  className="cursor-pointer"
                  style={{ transition: 'opacity 0.15s' }}
                >
                  {isHighlighted && (
                    <rect
                      x={pos.x - 4}
                      y={pos.y - 4}
                      width={pos.w + 8}
                      height={pos.h + 8}
                      rx="4"
                      fill="none"
                      stroke="#ffffff"
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
                      y={pos.y + pos.h / 2 + fontSize * 0.35}
                      fontSize={fontSize * 0.75}
                      fill={textColor}
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {spot.vehicle_matricula.length > 7
                        ? spot.vehicle_matricula.slice(-7)
                        : spot.vehicle_matricula}
                    </text>
                  ) : (
                    <text
                      x={pos.x + pos.w / 2}
                      y={pos.y + pos.h / 2 + fontSize * 0.35}
                      fontSize={fontSize}
                      fill={textColor}
                      fontFamily="sans-serif"
                      textAnchor="middle"
                      fontWeight="700"
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

            {/* ─── Driving lanes (subtle lines) ───────────────────────── */}
            {/* Vertical lane between 96-110 and 70-95 */}
            <line x1="95" y1="280" x2="95" y2="720" stroke="#9a9590" strokeWidth="1" strokeDasharray="8,4" opacity="0.5" />
            {/* Vertical lane between 70-95 and 44-69 */}
            <line x1="265" y1="280" x2="265" y2="720" stroke="#9a9590" strokeWidth="1" strokeDasharray="8,4" opacity="0.5" />
            {/* Horizontal lane between left blocks and right blocks */}
            <line x1="440" y1="400" x2="440" y2="750" stroke="#9a9590" strokeWidth="1" strokeDasharray="8,4" opacity="0.5" />
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-[#f5c542] border border-[#c9a030]" />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-[#e85d5d]" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-[#60a5fa]" />
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
