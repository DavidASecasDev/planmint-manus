/**
 * Parking Map — Clean schematic SVG layout of the Azul Cars campa
 * Recreates the physical layout as a professional blueprint-style diagram.
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
// The SVG viewBox is 1200 x 900 to give us plenty of room
const SVG_W = 1200;
const SVG_H = 900;

// Spot dimensions
const SPOT_W = 34;
const SPOT_H = 28;
const GAP = 2;

// ─── Spot coordinate generator ──────────────────────────────────────────────
function buildSpotCoords(): Map<number, { x: number; y: number; w: number; h: number }> {
  const coords = new Map<number, { x: number; y: number; w: number; h: number }>();

  // ─── Plazas 1-11: Top-right horizontal row ────────────────────────
  // In the real layout these are at the top-right, horizontal
  const row1X = 640;
  const row1Y = 260;
  for (let i = 0; i < 11; i++) {
    coords.set(i + 1, { x: row1X + i * (SPOT_W + GAP), y: row1Y, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 12-19: Center block, row 1 ────────────────────────────
  const centerX = 640;
  const centerY1 = 420;
  for (let i = 0; i < 8; i++) {
    coords.set(12 + i, { x: centerX + i * (SPOT_W + GAP), y: centerY1, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 20-27: Center block, row 2 ────────────────────────────
  const centerY2 = centerY1 + SPOT_H + GAP;
  for (let i = 0; i < 8; i++) {
    coords.set(20 + i, { x: centerX + i * (SPOT_W + GAP), y: centerY2, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 28-35: Center block, row 3 ────────────────────────────
  const centerY3 = centerY2 + SPOT_H + 40;
  for (let i = 0; i < 8; i++) {
    coords.set(28 + i, { x: centerX + i * (SPOT_W + GAP), y: centerY3, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 36-43: Center block, row 4 ────────────────────────────
  const centerY4 = centerY3 + SPOT_H + GAP;
  for (let i = 0; i < 8; i++) {
    coords.set(36 + i, { x: centerX + i * (SPOT_W + GAP), y: centerY4, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 44-69: Two columns center-left ────────────────────────
  // Pairs: 44,45 / 46,47 / ... / 68,69 (13 rows, 2 cols)
  const col44X1 = 480;
  const col44X2 = col44X1 + SPOT_W + GAP;
  const col44StartY = 240;
  for (let i = 0; i < 13; i++) {
    const y = col44StartY + i * (SPOT_H + GAP);
    coords.set(44 + i * 2, { x: col44X1, y, w: SPOT_W, h: SPOT_H });
    coords.set(45 + i * 2, { x: col44X2, y, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 70-95: Two columns left ───────────────────────────────
  // Pairs: 70,71 / 72,73 / ... / 94,95 (13 rows, 2 cols)
  const col70X1 = 300;
  const col70X2 = col70X1 + SPOT_W + GAP;
  const col70StartY = 240;
  for (let i = 0; i < 13; i++) {
    const y = col70StartY + i * (SPOT_H + GAP);
    coords.set(70 + i * 2, { x: col70X1, y, w: SPOT_W, h: SPOT_H });
    coords.set(71 + i * 2, { x: col70X2, y, w: SPOT_W, h: SPOT_H });
  }

  // ─── Plazas 96-110: Single column far-left ────────────────────────
  const col96X = 180;
  const col96StartY = 240;
  for (let i = 0; i < 15; i++) {
    coords.set(96 + i, { x: col96X, y: col96StartY + i * (SPOT_H + GAP), w: SPOT_W, h: SPOT_H });
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

  // Fetch parking overview
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['parking-overview'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingOverview; error?: string }>('parking/overview', { body: {} });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
      return result.data.data;
    },
    refetchInterval: 15000,
  });

  // Fetch parking history
  const { data: history } = useQuery({
    queryKey: ['parking-history'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingHistoryItem[] }>('parking/history', { body: { limit: 30 } });
      if (result.error || !result.data?.ok) return [];
      return result.data.data;
    },
  });

  // Seed layout mutation
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

  // Release spot mutation
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

  // Flatten all spots
  const allSpots = useMemo(() => {
    if (!overview) return [];
    return overview.zones.flatMap(z => z.spots);
  }, [overview]);

  // Create a map of spot_number -> spot for quick lookup
  const spotByNumber = useMemo(() => {
    const map = new Map<number, ParkingSpot>();
    allSpots.forEach(s => map.set(s.spot_number, s));
    return map;
  }, [allSpots]);

  // Search
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

  // If no zones exist, show setup button
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
            {/* Search */}
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

      {/* Search result banner */}
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

      {/* Summary */}
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

      {/* Loading */}
      {isLoading && <Skeleton className="h-[600px] rounded-xl" />}

      {/* ─── SVG PARKING MAP ──────────────────────────────────────────── */}
      {!isLoading && overview && (
        <TooltipProvider delayDuration={200}>
          <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-auto bg-[#2563a8]"
              style={{ minHeight: '500px' }}
            >
              {/* Background decorative elements */}
              {/* Road border (white band at bottom) */}
              <rect x="0" y={SVG_H - 50} width={SVG_W} height="50" fill="#e5e7eb" />
              <text x={SVG_W - 80} y={SVG_H - 20} fontSize="12" fill="#6b7280" fontFamily="sans-serif">
                Camí Fondo
              </text>
              <text x={SVG_W / 2 - 40} y={SVG_H - 20} fontSize="12" fill="#6b7280" fontFamily="sans-serif">
                Son Maiferit
              </text>

              {/* Zona Sucios label */}
              <rect x="380" y="80" width="180" height="140" rx="4" fill="#1e4a7a" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" />
              <text x="470" y="155" fontSize="14" fill="#93c5fd" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold">
                SUCIOS
              </text>

              {/* Oficina Azul Cars */}
              <rect x="750" y="320" width="140" height="80" rx="4" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="1" />
              <text x="820" y="360" fontSize="11" fill="#93c5fd" fontFamily="sans-serif" textAnchor="middle">
                Azul Cars
              </text>
              <text x="820" y="378" fontSize="10" fill="#7dd3fc" fontFamily="sans-serif" textAnchor="middle">
                Oficina
              </text>

              {/* SALIDA marker */}
              <rect x="540" y={SVG_H - 100} width="50" height="40" rx="3" fill="#991b1b" />
              <text x="565" y={SVG_H - 75} fontSize="9" fill="white" fontFamily="sans-serif" textAnchor="middle" fontWeight="bold">
                SALIDA
              </text>
              {/* Arrow down */}
              <polygon points="565,810 555,800 575,800" fill="#991b1b" />

              {/* ─── Render all parking spots ─────────────────────────── */}
              {Array.from(SPOT_COORDS.entries()).map(([num, pos]) => {
                const spot = spotByNumber.get(num);
                const isOccupied = spot?.status === 'occupied';
                const isFree = !spot || spot.status === 'free';
                const isBlocked = spot?.status === 'blocked';
                const isReserved = spot?.status === 'reserved';
                const isHighlighted = highlightedSpotNum === num;

                // Colors
                let fill = '#ffffff'; // free = white
                let stroke = '#94a3b8';
                let textColor = '#1e293b';

                if (isOccupied) {
                  fill = '#ef4444';
                  stroke = '#b91c1c';
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
                    className="cursor-pointer"
                    style={{ transition: 'transform 0.1s' }}
                  >
                    {/* Highlight ring */}
                    {isHighlighted && (
                      <rect
                        x={pos.x - 3}
                        y={pos.y - 3}
                        width={pos.w + 6}
                        height={pos.h + 6}
                        rx="4"
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="3"
                        className="animate-pulse"
                      />
                    )}

                    {/* Spot rectangle */}
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

                    {/* Spot number or plate */}
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
                        {spot.vehicle_matricula.length > 7
                          ? spot.vehicle_matricula.slice(-7)
                          : spot.vehicle_matricula}
                      </text>
                    ) : (
                      <text
                        x={pos.x + pos.w / 2}
                        y={pos.y + pos.h / 2 + 4}
                        fontSize="9"
                        fill={textColor}
                        fontFamily="sans-serif"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {num}
                      </text>
                    )}

                    {/* Hover area (invisible, larger hit target) */}
                    <rect
                      x={pos.x - 1}
                      y={pos.y - 1}
                      width={pos.w + 2}
                      height={pos.h + 2}
                      fill="transparent"
                      className="hover:opacity-80"
                    >
                      <title>
                        {isOccupied
                          ? `Plaza ${num} — ${spot?.vehicle_matricula || 'Ocupada'}`
                          : `Plaza ${num} — Libre`}
                      </title>
                    </rect>
                  </g>
                );
              })}
            </svg>

            {/* Legend bar */}
            <div className="flex items-center gap-5 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-border/40 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded-sm bg-white border border-slate-300" />
                <span>Libre</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded-sm bg-red-500 border border-red-700" />
                <span>Ocupada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded-sm bg-amber-400 border border-amber-600" />
                <span>Reservada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded-sm bg-gray-500 border border-gray-700" />
                <span>Bloqueada</span>
              </div>
            </div>
          </div>
        </TooltipProvider>
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
