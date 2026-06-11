/**
 * Parking Map — Visual layout of the Azul Cars campa
 * Uses the real aerial photo as background with interactive spots
 * positioned to match the physical layout exactly.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// ─── Spot Position Map ──────────────────────────────────────────────────────
// Positions are in percentage (%) relative to the background image dimensions
// Based on the real aerial photo of the Azul Cars campa
// Image aspect ratio: ~1230x960 (width x height)

interface SpotPosition {
  x: number; // % from left
  y: number; // % from top
  w: number; // width in %
  h: number; // height in %
}

function getSpotPositions(): Map<number, SpotPosition> {
  const positions = new Map<number, SpotPosition>();

  // Spot dimensions (approximate)
  const spotW = 3.8; // width %
  const spotH = 4.2; // height %
  const spotWnarrow = 3.2;
  const spotHnarrow = 3.8;

  // ─── Plazas 1-11: Top right horizontal row ───────────────────────
  const row1Y = 33;
  const row1StartX = 57;
  const row1Gap = 4.0;
  for (let i = 0; i < 11; i++) {
    positions.set(i + 1, { x: row1StartX + i * row1Gap, y: row1Y, w: spotW, h: spotH });
  }

  // ─── Plazas 12-19: Center row 1 ──────────────────────────────────
  const row2Y = 52;
  const row2StartX = 57;
  for (let i = 0; i < 8; i++) {
    positions.set(12 + i, { x: row2StartX + i * row1Gap, y: row2Y, w: spotW, h: spotH });
  }

  // ─── Plazas 20-27: Center row 2 ──────────────────────────────────
  const row3Y = 57;
  const row3StartX = 57;
  for (let i = 0; i < 8; i++) {
    positions.set(20 + i, { x: row3StartX + i * row1Gap, y: row3Y, w: spotW, h: spotH });
  }

  // ─── Plazas 28-35: Center row 3 ──────────────────────────────────
  const row4Y = 66;
  const row4StartX = 57;
  for (let i = 0; i < 8; i++) {
    positions.set(28 + i, { x: row4StartX + i * row1Gap, y: row4Y, w: spotW, h: spotH });
  }

  // ─── Plazas 36-43: Center row 4 (bottom) ─────────────────────────
  const row5Y = 71;
  const row5StartX = 57;
  for (let i = 0; i < 8; i++) {
    positions.set(36 + i, { x: row5StartX + i * row1Gap, y: row5Y, w: spotW, h: spotH });
  }

  // ─── Plazas 44-69: Two columns center-left ───────────────────────
  // Column pair: 44,45 / 46,47 / 48,49 ... / 68,69
  const col44StartY = 28;
  const col44X1 = 37;
  const col44X2 = 41.5;
  const col44Gap = 4.5;
  for (let i = 0; i < 13; i++) {
    const leftNum = 44 + i * 2;
    const rightNum = 45 + i * 2;
    positions.set(leftNum, { x: col44X1, y: col44StartY + i * col44Gap, w: spotWnarrow, h: spotHnarrow });
    positions.set(rightNum, { x: col44X2, y: col44StartY + i * col44Gap, w: spotWnarrow, h: spotHnarrow });
  }

  // ─── Plazas 70-95: Two columns left ──────────────────────────────
  // Column pair: 70,71 / 72,73 ... / 94,95
  const col70StartY = 28;
  const col70X1 = 20;
  const col70X2 = 24.5;
  const col70Gap = 4.5;
  for (let i = 0; i < 13; i++) {
    const leftNum = 70 + i * 2;
    const rightNum = 71 + i * 2;
    positions.set(leftNum, { x: col70X1, y: col70StartY + i * col70Gap, w: spotWnarrow, h: spotHnarrow });
    positions.set(rightNum, { x: col70X2, y: col70StartY + i * col70Gap, w: spotWnarrow, h: spotHnarrow });
  }

  // ─── Plazas 96-110: Single column far left ───────────────────────
  const col96StartY = 26;
  const col96X = 10;
  const col96Gap = 4.5;
  for (let i = 0; i < 15; i++) {
    positions.set(96 + i, { x: col96X, y: col96StartY + i * col96Gap, w: spotWnarrow, h: spotHnarrow });
  }

  return positions;
}

const SPOT_POSITIONS = getSpotPositions();

// Background image URL
const PARKING_BG_URL = '/manus-storage/parking-layout-azulcars_b682d8b9.png';

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Parking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSpotId, setHighlightedSpotId] = useState<string | null>(null);
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
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Flatten all spots from all zones
  const allSpots = useMemo(() => {
    if (!overview) return [];
    return overview.zones.flatMap(z => z.spots);
  }, [overview]);

  // Search for a vehicle by plate and highlight its spot
  const searchResult = useMemo(() => {
    if (!searchQuery.trim() || !overview) return null;
    const q = searchQuery.trim().toLowerCase();
    for (const zone of overview.zones) {
      for (const spot of zone.spots) {
        if (spot.status === 'occupied' && spot.vehicle_matricula &&
            spot.vehicle_matricula.toLowerCase().includes(q)) {
          return { spot, zoneName: zone.name, zoneColor: zone.color };
        }
      }
    }
    return null;
  }, [searchQuery, overview]);

  // When search result changes, highlight the spot
  useEffect(() => {
    if (searchResult) {
      setHighlightedSpotId(searchResult.spot.id);
      setTimeout(() => {
        const el = document.getElementById(`parking-spot-${searchResult.spot.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedSpotId(null), 5000);
    } else {
      setHighlightedSpotId(null);
    }
  }, [searchResult]);

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
              Configura el plano de tu campa con las zonas y plazas numeradas según tu layout real.
            </p>
          </div>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            size="lg"
          >
            {seedMutation.isPending ? 'Configurando...' : 'Configurar Layout Azul Cars'}
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
            {/* Search by plate */}
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
                  onClick={() => { setSearchQuery(''); setHighlightedSpotId(null); }}
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
          "mb-4 px-4 py-2.5 rounded-lg border text-sm flex items-center gap-3",
          searchResult
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        )}>
          {searchResult ? (
            <>
              <Car className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <span className="font-mono font-bold">{searchResult.spot.vehicle_matricula}</span>
                {' '}está en{' '}
                <span className="font-semibold">Plaza {searchResult.spot.spot_number}</span>
                {' '}—{' '}
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: searchResult.zoneColor }} />
                  {searchResult.zoneName}
                </span>
              </span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300">
                No se encontró ningún vehículo con "{searchQuery}"
              </span>
            </>
          )}
        </div>
      )}

      {/* Summary bar */}
      {overview && (
        <div className="flex items-center gap-4 mb-4 px-1">
          <div className="flex items-center gap-1.5 text-sm">
            <ParkingSquare className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{overview.summary.total}</span>
            <span className="text-muted-foreground">plazas</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <CircleDot className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-emerald-600">{overview.summary.free}</span>
            <span className="text-muted-foreground">libres</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Car className="h-4 w-4 text-blue-500" />
            <span className="font-semibold text-blue-600">{overview.summary.occupied}</span>
            <span className="text-muted-foreground">ocupadas</span>
          </div>
          {overview.summary.blocked > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-amber-600">{overview.summary.blocked}</span>
              <span className="text-muted-foreground">bloqueadas</span>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-[500px] rounded-lg" />
        </div>
      )}

      {/* ─── PARKING MAP WITH REAL LAYOUT ─────────────────────────────── */}
      {!isLoading && overview && (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-slate-100 dark:bg-slate-900">
          {/* Map container - maintains aspect ratio of the image */}
          <div className="relative w-full" style={{ paddingBottom: '78%' }}>
            {/* Background image */}
            <img
              src={PARKING_BG_URL}
              alt="Plano Parking Azul Cars"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />

            {/* Interactive spots overlay */}
            {allSpots.map(spot => {
              const pos = SPOT_POSITIONS.get(spot.spot_number);
              if (!pos) return null;

              const isOccupied = spot.status === 'occupied';
              const isFree = spot.status === 'free';
              const isHighlighted = highlightedSpotId === spot.id;

              return (
                <button
                  key={spot.id}
                  id={`parking-spot-${spot.id}`}
                  onClick={() => {
                    if (isOccupied) {
                      setSelectedSpot(spot);
                      // Show info or release
                      releaseMutation.mutate(spot.id);
                    } else if (isFree) {
                      setSelectedSpot(spot);
                      setShowAssignDialog(true);
                    }
                  }}
                  title={
                    isOccupied
                      ? `Plaza ${spot.spot_number} — ${spot.vehicle_matricula}\nClick para liberar`
                      : `Plaza ${spot.spot_number} — Libre\nClick para asignar`
                  }
                  className={cn(
                    "absolute flex items-center justify-center rounded-sm transition-all duration-150 text-[7px] font-bold leading-none",
                    "hover:z-20 hover:scale-110 focus:outline-none focus:z-20",
                    isOccupied && "bg-red-500/85 text-white border border-red-700/50 shadow-sm hover:bg-red-600",
                    isFree && "bg-emerald-400/70 text-emerald-900 border border-emerald-600/40 hover:bg-emerald-500/80",
                    spot.status === 'blocked' && "bg-gray-500/70 text-white border border-gray-700/50 cursor-not-allowed",
                    spot.status === 'reserved' && "bg-amber-400/80 text-amber-900 border border-amber-600/50",
                    isHighlighted && "ring-3 ring-yellow-300 shadow-lg shadow-yellow-400/50 z-30 animate-pulse scale-125"
                  )}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${pos.w}%`,
                    height: `${pos.h}%`,
                  }}
                >
                  {isOccupied ? (
                    <span className="truncate px-0.5 text-[6px] font-mono font-bold">
                      {spot.vehicle_matricula || spot.spot_number}
                    </span>
                  ) : (
                    <span>{spot.spot_number}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 bg-white/90 dark:bg-slate-900/90 border-t border-border/40 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-400/70 border border-emerald-600/40" />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500/85 border border-red-700/50" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-400/80 border border-amber-600/50" />
              <span>Reservada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-gray-500/70 border border-gray-700/50" />
              <span>Bloqueada</span>
            </div>
          </div>
        </div>
      )}

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
