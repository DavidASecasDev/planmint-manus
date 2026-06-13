/**
 * Parking Map — Uses the REAL aerial photo as background with interactive spot overlays.
 * The background image IS the exact plan provided by the user.
 * Spot coordinates were extracted via OpenCV from the actual photo (1374×1145px).
 * Overlay rectangles are positioned at the exact pixel locations of each spot.
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
import { useAllVehiclesForSelect } from '@/hooks/useAllVehiclesForSelect';

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

// ─── Spot Coordinates (extracted from the aerial photo via OpenCV) ───────────
// Image dimensions: 1374 × 1145 px
// ViewBox matches exactly: 1374 × 1145
// Coordinates are PIXEL positions from the real photo.
interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildSpotGeometry(): Map<number, SpotRect> {
  const spots = new Map<number, SpotRect>();
  let num = 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 1: Horizontal row, top-right (11 spots)
  // y=433, x starts at 856, step=43, w=35, h=59 (portrait)
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 11; i++) {
    spots.set(num++, { x: 856 + i * 43, y: 433, w: 35, h: 59 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 2: 2 rows × 8 = 16 spots, center-right
  // Row 1: y=683, Row 2: y=755, x from 679, step=42, w=34, h=58
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 8; i++) {
    spots.set(num++, { x: 679 + i * 42, y: 683, w: 34, h: 58 });
  }
  for (let i = 0; i < 8; i++) {
    spots.set(num++, { x: 679 + i * 42, y: 755, w: 34, h: 58 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 3: 2 rows × 8 = 16 spots, bottom-right
  // Row 1: y=901, Row 2: y=974, x from 679, step=42, w=34, h=58
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 8; i++) {
    spots.set(num++, { x: 679 + i * 42, y: 901, w: 34, h: 58 });
  }
  for (let i = 0; i < 8; i++) {
    spots.set(num++, { x: 679 + i * 42, y: 974, w: 34, h: 58 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 4: Vertical column (rightmost of left group), 13 spots
  // x=541, y starts at 439, step=43, w=56, h=35 (landscape)
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 13; i++) {
    spots.set(num++, { x: 541, y: 439 + i * 43, w: 56, h: 35 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 5: Vertical column, x=462
  // 13 spots, y starts at 437, step=43, w=57, h=36 (landscape)
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 13; i++) {
    spots.set(num++, { x: 462, y: 437 + i * 43, w: 57, h: 36 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 6: Vertical column, x=289
  // 13 spots, y starts at 442, step=43, w=58, h=36 (landscape)
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 13; i++) {
    spots.set(num++, { x: 289, y: 442 + i * 43, w: 58, h: 36 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 7: Vertical column, x=223
  // 13 spots, y starts at 442, step=43, w=56, h=36 (landscape)
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 13; i++) {
    spots.set(num++, { x: 223, y: 442 + i * 43, w: 56, h: 36 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 8: Single column, far left, x=52
  // 15 spots, y starts at 433, step=43, w=56, h=35 (landscape)
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 15; i++) {
    spots.set(num++, { x: 52, y: 433 + i * 43, w: 56, h: 35 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCIOS: 8 green spots, vertical column
  // x=463, y starts at 74, step=44, w=55, h=35
  // ═══════════════════════════════════════════════════════════════════════════
  for (let i = 0; i < 8; i++) {
    spots.set(num++, { x: 463, y: 74 + i * 44, w: 55, h: 35 });
  }

  return spots;
}

const SPOT_GEOMETRY = buildSpotGeometry();

// Background image URL (the exact aerial photo provided by the user)
const BG_IMAGE_URL = '/manus-storage/plano_parking_extracted_099694f8.png';

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
      viewBox="0 0 1374 1145"
      className="w-full h-auto"
      style={{ maxHeight: '78vh' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ─── Defs ─── */}
      <defs>
        <style>{`
          @keyframes pulseHighlight {
            0%, 100% { stroke-opacity: 1; stroke-width: 4; }
            50% { stroke-opacity: 0.4; stroke-width: 6; }
          }
          .spot-highlight {
            animation: pulseHighlight 1s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* ─── Background: the REAL aerial photo ─── */}
      <image
        href={BG_IMAGE_URL}
        x="0"
        y="0"
        width="1374"
        height="1145"
        preserveAspectRatio="xMidYMid meet"
      />

      {/* ─── Interactive Spot Overlays ─── */}
      {Array.from(SPOT_GEOMETRY.entries()).map(([num, rect]) => {
        const spot = spotByNumber.get(num);
        const isOccupied = spot?.status === 'occupied';
        const isBlocked = spot?.status === 'blocked';
        const isReserved = spot?.status === 'reserved';
        const isSucios = num >= 111 && num <= 118;
        const isHighlighted = highlightedSpotNum === num;

        // Default: transparent overlay (the image shows the spots already)
        // Only show color when status changes from default
        let fillColor = 'transparent';
        let strokeColor = 'transparent';
        let fillOpacity = 0;

        if (isOccupied) {
          fillColor = '#dc2626'; // red
          strokeColor = '#991b1b';
          fillOpacity = 0.85;
        } else if (isBlocked) {
          fillColor = '#6b7280'; // gray
          strokeColor = '#4b5563';
          fillOpacity = 0.8;
        } else if (isReserved) {
          fillColor = '#f59e0b'; // amber
          strokeColor = '#d97706';
          fillOpacity = 0.8;
        }
        // Free spots: transparent — the background image already shows them

        // Label: show number for free spots, plate for occupied
        let label = '';
        if (isOccupied && spot?.vehicle_matricula) {
          const plate = spot.vehicle_matricula;
          label = plate.length > 7 ? plate.slice(-7) : plate;
        } else if (isOccupied || isBlocked || isReserved) {
          label = String(num);
        }

        const fontSize = isOccupied && spot?.vehicle_matricula ? 8 : 10;

        return (
          <g
            key={num}
            onClick={() => spot && onSpotClick(spot)}
            style={{ cursor: spot ? 'pointer' : 'default' }}
          >
            {/* Clickable area (always present, transparent when free) */}
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={strokeColor}
              strokeWidth={fillOpacity > 0 ? 1.5 : 0}
              rx="3"
              className="transition-all hover:opacity-80"
            />
            {/* Hover indicator for free spots */}
            {!isOccupied && !isBlocked && !isReserved && (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill="transparent"
                stroke="transparent"
                strokeWidth="0"
                rx="3"
                className="hover:fill-white/20 hover:stroke-white/40 hover:stroke-[1.5px] transition-all"
              />
            )}
            {/* Highlight ring for search */}
            {isHighlighted && (
              <rect
                x={rect.x - 4}
                y={rect.y - 4}
                width={rect.w + 8}
                height={rect.h + 8}
                fill="none"
                stroke="#facc15"
                strokeWidth="4"
                rx="6"
                className="spot-highlight"
              />
            )}
            {/* Label text (only for occupied/blocked/reserved) */}
            {label && (
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
            )}
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

      {/* ─── PARKING MAP WITH REAL IMAGE BACKGROUND ─────────────────── */}
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
  const { activeVehicles, isLoading: vehiclesLoading } = useAllVehiclesForSelect();

  useEffect(() => {
    if (!open) setMatricula('');
  }, [open]);

  const vehicles = useMemo(() => activeVehicles.map(v => ({
    id: v.id,
    matricula: v.matricula,
    modelo: v.modelo,
  })), [activeVehicles]);

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
