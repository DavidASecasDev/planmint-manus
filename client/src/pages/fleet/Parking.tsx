/**
 * Parking Map — Uses the real aerial photo as background with interactive spots
 * overlaid precisely on top of each blue rectangle in the image.
 * 
 * The image dimensions are ~1200×1050. We use percentage-based positioning
 * so spots align with the blue rectangles regardless of container size.
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

// ─── Background image ───────────────────────────────────────────────────────
const PARKING_BG_IMAGE = '/manus-storage/parking-layout-v3_026ec2a1.png';

// ─── Spot Position Map ──────────────────────────────────────────────────────
// Positions are in percentage (%) relative to the image container.
// Each spot: { left, top, width, height } in %
// Carefully mapped from the aerial photo with blue rectangles.
//
// Image analysis (approx 1200×1050 px):
// - The lot boundary (red line) starts at roughly x=15,y=15 to x=1185,y=1035
// - Effective content area: ~1170 wide × ~1020 tall
//
// Spot groups identified from the image:
// 1. TOP-CENTER COLUMN (Sucios): ~8 spots, vertical column between the naves
//    Approx x=355-400, y=80-420 → left≈30%, top≈8-40%, each spot ~3.8%×3%
//
// 2. TOP-RIGHT ROW: 11 spots horizontal (1-11)
//    Approx x=620-1100, y=230-290 → left≈52-92%, top≈22%, each spot ~3.5%×5%
//
// 3. LEFT COLUMN (96-110): 15 spots, single vertical column
//    Approx x=15-80, y=320-920 → left≈1.5%, top≈30-88%, each spot ~5.5%×3.5%
//
// 4. LEFT-CENTER BLOCK (70-95): 2 columns × 13 rows
//    Approx x=115-270, y=320-920 → left≈10-22%, top≈30-88%
//
// 5. CENTER BLOCK (44-69): 2 columns × 13 rows
//    Approx x=330-490, y=320-920 → left≈28-41%, top≈30-88%
//
// 6. CENTER-RIGHT BLOCK (12-19, 20-27): 2 rows × 8 spots
//    Approx x=520-860, y=470-600 → left≈43-72%, top≈45-57%
//
// 7. BOTTOM-RIGHT BLOCK (28-35, 36-43): 2 rows × 8 spots
//    Approx x=520-860, y=680-810 → left≈43-72%, top≈65-77%

interface SpotPosition {
  left: number;  // % from left
  top: number;   // % from top
  width: number; // % width
  height: number; // % height
}

function buildSpotPositions(): Map<number, SpotPosition> {
  const positions = new Map<number, SpotPosition>();

  // Spot dimensions (in %)
  const hSpotW = 5.2;   // horizontal spot width
  const hSpotH = 3.2;   // horizontal spot height
  const vSpotW = 3.5;   // vertical spot width
  const vSpotH = 5.0;   // vertical spot height
  const vGap = 0.4;     // vertical gap between spots
  const hGap = 0.3;     // horizontal gap between spots

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCIOS (111-118): Vertical column of 8 horizontal spots
  // Between the naves, top-center area
  // ═══════════════════════════════════════════════════════════════════════════
  const xSucios = 30.5;
  const ySuciosStart = 8.5;
  for (let i = 0; i < 8; i++) {
    positions.set(111 + i, {
      left: xSucios,
      top: ySuciosStart + i * (hSpotH + vGap),
      width: hSpotW - 1,
      height: hSpotH - 0.5,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAZAS 1-11: Horizontal row of 11 vertical spots (top-right)
  // ═══════════════════════════════════════════════════════════════════════════
  const x1Start = 53;
  const y1 = 22;
  for (let i = 0; i < 11; i++) {
    positions.set(1 + i, {
      left: x1Start + i * (vSpotW + hGap),
      top: y1,
      width: vSpotW,
      height: vSpotH,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAZAS 96-110: Single vertical column (far left)
  // 15 horizontal spots stacked vertically
  // ═══════════════════════════════════════════════════════════════════════════
  const x96 = 1.5;
  const y96Start = 31;
  for (let i = 0; i < 15; i++) {
    positions.set(96 + i, {
      left: x96,
      top: y96Start + i * (hSpotH + vGap),
      width: hSpotW,
      height: hSpotH,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAZAS 70-95: Two vertical columns × 13 rows (left-center)
  // Pairs: 70,71 / 72,73 / ... / 94,95
  // ═══════════════════════════════════════════════════════════════════════════
  const x70col1 = 10.5;
  const x70col2 = x70col1 + hSpotW + hGap;
  const y70Start = 31;
  for (let i = 0; i < 13; i++) {
    const y = y70Start + i * (hSpotH + vGap);
    positions.set(70 + i * 2, { left: x70col1, top: y, width: hSpotW, height: hSpotH });
    positions.set(71 + i * 2, { left: x70col2, top: y, width: hSpotW, height: hSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAZAS 44-69: Two vertical columns × 13 rows (center)
  // Pairs: 44,45 / 46,47 / ... / 68,69
  // ═══════════════════════════════════════════════════════════════════════════
  const x44col1 = 28.5;
  const x44col2 = x44col1 + hSpotW + hGap;
  const y44Start = 31;
  for (let i = 0; i < 13; i++) {
    const y = y44Start + i * (hSpotH + vGap);
    positions.set(44 + i * 2, { left: x44col1, top: y, width: hSpotW, height: hSpotH });
    positions.set(45 + i * 2, { left: x44col2, top: y, width: hSpotW, height: hSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAZAS 12-19 y 20-27: Two horizontal rows × 8 vertical spots (center-right)
  // ═══════════════════════════════════════════════════════════════════════════
  const x12Start = 44;
  const y12 = 45;
  const y20 = y12 + vSpotH + vGap;
  for (let i = 0; i < 8; i++) {
    positions.set(12 + i, { left: x12Start + i * (vSpotW + hGap), top: y12, width: vSpotW, height: vSpotH });
    positions.set(20 + i, { left: x12Start + i * (vSpotW + hGap), top: y20, width: vSpotW, height: vSpotH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAZAS 28-35 y 36-43: Two horizontal rows × 8 vertical spots (bottom-right)
  // ═══════════════════════════════════════════════════════════════════════════
  const x28Start = 44;
  const y28 = 65;
  const y36 = y28 + vSpotH + vGap;
  for (let i = 0; i < 8; i++) {
    positions.set(28 + i, { left: x28Start + i * (vSpotW + hGap), top: y28, width: vSpotW, height: vSpotH });
    positions.set(36 + i, { left: x28Start + i * (vSpotW + hGap), top: y36, width: vSpotW, height: vSpotH });
  }

  return positions;
}

const SPOT_POSITIONS = buildSpotPositions();

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

      {/* ─── PARKING MAP WITH IMAGE BACKGROUND ─────────────────────── */}
      {!isLoading && overview && (
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <div
            className="relative w-full"
            style={{
              backgroundImage: `url(${PARKING_BG_IMAGE})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              // Maintain aspect ratio of the image (~1200×1050 ≈ 1.14:1)
              paddingBottom: '87.5%',
            }}
          >
            {/* Render interactive spots on top of the image */}
            {Array.from(SPOT_POSITIONS.entries()).map(([num, pos]) => {
              const spot = spotByNumber.get(num);
              const isOccupied = spot?.status === 'occupied';
              const isBlocked = spot?.status === 'blocked';
              const isReserved = spot?.status === 'reserved';
              const isHighlighted = highlightedSpotNum === num;

              let bgColor = 'rgba(34, 197, 94, 0.85)'; // green (free)
              let borderColor = 'rgba(22, 163, 74, 1)';
              let textColor = '#ffffff';

              if (isOccupied) {
                bgColor = 'rgba(220, 38, 38, 0.9)'; // red
                borderColor = 'rgba(185, 28, 28, 1)';
                textColor = '#ffffff';
              } else if (isBlocked) {
                bgColor = 'rgba(107, 114, 128, 0.85)';
                borderColor = 'rgba(75, 85, 99, 1)';
                textColor = '#ffffff';
              } else if (isReserved) {
                bgColor = 'rgba(59, 130, 246, 0.85)';
                borderColor = 'rgba(37, 99, 235, 1)';
                textColor = '#ffffff';
              }

              return (
                <div
                  key={num}
                  onClick={() => spot && handleSpotClick(spot)}
                  className={cn(
                    "absolute flex items-center justify-center cursor-pointer rounded-[2px] transition-all duration-150 hover:scale-105 hover:z-10",
                    isHighlighted && "ring-2 ring-yellow-400 ring-offset-1 animate-pulse z-20"
                  )}
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    width: `${pos.width}%`,
                    height: `${pos.height}%`,
                    backgroundColor: bgColor,
                    border: `1.5px solid ${borderColor}`,
                  }}
                  title={
                    isOccupied
                      ? `Plaza ${num} — ${spot?.vehicle_matricula || 'Ocupada'}${spot?.occupied_at ? ` (desde ${new Date(spot.occupied_at).toLocaleString('es-ES')})` : ''}`
                      : isBlocked ? `Plaza ${num} — Bloqueada`
                      : isReserved ? `Plaza ${num} — Reservada`
                      : `Plaza ${num} — Libre`
                  }
                >
                  <span
                    className="font-bold leading-none text-center select-none"
                    style={{
                      color: textColor,
                      fontSize: 'clamp(6px, 0.9vw, 11px)',
                    }}
                  >
                    {isOccupied && spot?.vehicle_matricula
                      ? (spot.vehicle_matricula.length > 7
                          ? spot.vehicle_matricula.slice(-7)
                          : spot.vehicle_matricula)
                      : num}
                  </span>
                </div>
              );
            })}
          </div>

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
