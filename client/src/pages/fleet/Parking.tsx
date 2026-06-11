/**
 * Parking Map — Visual layout of the Azul Cars campa
 * Realistic top-down parking lot view with bay-style spots and lanes
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
  History, CircleDot, AlertTriangle, Search, X,
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

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Parking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');
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

  // Filtered zones
  const filteredZones = useMemo(() => {
    if (!overview) return [];
    if (selectedZoneFilter === 'all') return overview.zones;
    return overview.zones.filter(z => z.id === selectedZoneFilter);
  }, [overview, selectedZoneFilter]);

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
            <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todas las zonas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {overview?.zones.map(z => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {/* Parking Zones — Realistic Layout */}
      <div className="space-y-6">
        {filteredZones.map(zone => (
          <ParkingZoneMap
            key={zone.id}
            zone={zone}
            highlightedSpotId={highlightedSpotId}
            onSpotClick={(spot) => {
              setSelectedSpot(spot);
              if (spot.status === 'free') {
                setShowAssignDialog(true);
              }
            }}
            onRelease={(spot) => releaseMutation.mutate(spot.id)}
          />
        ))}
      </div>

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

// ─── Parking Zone Map (Realistic Layout) ───────────────────────────────────
function ParkingZoneMap({
  zone,
  highlightedSpotId,
  onSpotClick,
  onRelease,
}: {
  zone: ParkingZone;
  highlightedSpotId?: string | null;
  onSpotClick: (spot: ParkingSpot) => void;
  onRelease: (spot: ParkingSpot) => void;
}) {
  const maxRow = Math.max(...zone.spots.map(s => s.grid_row ?? 0), 0);
  const maxCol = Math.max(...zone.spots.map(s => s.grid_col ?? 0), 0);

  // Group spots by row for a row-based layout with lanes between
  const spotsByRow = useMemo(() => {
    const rows: Map<number, ParkingSpot[]> = new Map();
    zone.spots.forEach(spot => {
      const row = spot.grid_row ?? 0;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row)!.push(spot);
    });
    // Sort spots within each row by column
    rows.forEach(spots => spots.sort((a, b) => (a.grid_col ?? 0) - (b.grid_col ?? 0)));
    return rows;
  }, [zone.spots]);

  const freeCount = zone.spots.filter(s => s.status === 'free').length;
  const occupiedCount = zone.spots.filter(s => s.status === 'occupied').length;
  const totalCount = zone.spots.length;

  // Get sorted row keys
  const rowKeys = Array.from(spotsByRow.keys()).sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-border/60 bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
      {/* Zone header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: zone.color }}
          />
          <span className="text-sm font-semibold">{zone.name}</span>
          {zone.description && (
            <span className="text-xs text-muted-foreground">({zone.description})</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{freeCount} libres</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">{occupiedCount}/{totalCount}</span>
        </div>
      </div>

      {/* Parking lot area */}
      <div className="p-3 overflow-x-auto">
        <div className="min-w-fit">
          {rowKeys.map((rowIdx, i) => {
            const spots = spotsByRow.get(rowIdx) || [];
            return (
              <div key={rowIdx}>
                {/* Row of parking bays */}
                <div className="flex gap-px">
                  {spots.map(spot => (
                    <ParkingBay
                      key={spot.id}
                      spot={spot}
                      zoneColor={zone.color}
                      isHighlighted={highlightedSpotId === spot.id}
                      onClick={() => {
                        if (spot.status === 'occupied') {
                          onRelease(spot);
                        } else if (spot.status === 'free') {
                          onSpotClick(spot);
                        }
                      }}
                    />
                  ))}
                </div>
                {/* Lane/road between rows */}
                {i < rowKeys.length - 1 && (
                  <div className="h-3 bg-slate-200 dark:bg-slate-700/50 my-0.5 rounded-sm relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
                      <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Parking Bay (Single Spot — Realistic) ─────────────────────────────────
function ParkingBay({
  spot,
  zoneColor,
  isHighlighted,
  onClick,
}: {
  spot: ParkingSpot;
  zoneColor: string;
  isHighlighted?: boolean;
  onClick: () => void;
}) {
  const isOccupied = spot.status === 'occupied';
  const isFree = spot.status === 'free';
  const isBlocked = spot.status === 'blocked';

  return (
    <button
      id={`parking-spot-${spot.id}`}
      onClick={onClick}
      disabled={isBlocked}
      title={
        isOccupied
          ? `Plaza ${spot.spot_number} — ${spot.vehicle_matricula} (click para liberar)`
          : isFree
          ? `Plaza ${spot.spot_number} — Libre (click para asignar)`
          : `Plaza ${spot.spot_number} — ${spot.status}`
      }
      className={cn(
        "relative w-[72px] h-[40px] border flex flex-col items-center justify-center transition-all duration-100",
        "focus:outline-none focus:z-10",
        // Occupied: dark background with car
        isOccupied && "bg-slate-700 dark:bg-slate-600 border-slate-800 dark:border-slate-500 hover:bg-slate-600 cursor-pointer",
        // Free: light with line markings
        isFree && "bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-400 cursor-pointer",
        // Blocked
        isBlocked && "bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800 opacity-60 cursor-not-allowed",
        // Reserved
        spot.status === 'reserved' && "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700",
        // Highlighted (search result)
        isHighlighted && "ring-3 ring-yellow-400 ring-offset-1 shadow-lg shadow-yellow-300/40 z-20 animate-pulse"
      )}
    >
      {/* Spot number — top left corner */}
      <span className={cn(
        "absolute top-0 left-0.5 text-[8px] font-bold leading-none",
        isOccupied ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
      )}>
        {spot.spot_number}
      </span>

      {/* Occupied: show car silhouette + plate */}
      {isOccupied && (
        <div className="flex flex-col items-center gap-0">
          {/* Car top-down silhouette */}
          <svg width="20" height="12" viewBox="0 0 20 12" className="text-slate-300 dark:text-slate-400 mb-px">
            <rect x="2" y="1" width="16" height="10" rx="3" fill="currentColor" opacity="0.6" />
            <rect x="4" y="0" width="12" height="4" rx="2" fill="currentColor" opacity="0.4" />
            <rect x="4" y="8" width="12" height="4" rx="2" fill="currentColor" opacity="0.4" />
            <circle cx="4" cy="2" r="1.5" fill="currentColor" />
            <circle cx="16" cy="2" r="1.5" fill="currentColor" />
            <circle cx="4" cy="10" r="1.5" fill="currentColor" />
            <circle cx="16" cy="10" r="1.5" fill="currentColor" />
          </svg>
          {/* Plate */}
          {spot.vehicle_matricula && (
            <span className="font-mono font-bold text-[8px] text-white leading-none tracking-tight truncate max-w-[66px]">
              {spot.vehicle_matricula}
            </span>
          )}
        </div>
      )}

      {/* Free: just the number is visible, subtle P */}
      {isFree && (
        <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600">P</span>
      )}

      {/* Blocked */}
      {isBlocked && (
        <X className="h-3 w-3 text-red-400" />
      )}
    </button>
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
