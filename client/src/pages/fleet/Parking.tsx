/**
 * Parking Map — Visual layout of the Azul Cars campa
 * Shows zones with numbered spots, occupancy status, and vehicle plates
 * Designed as a realistic top-down parking lot view
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  History, CircleDot, AlertTriangle, LayoutGrid, List, Search, X,
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
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
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
      // Auto-scroll to the spot element
      setTimeout(() => {
        const el = document.getElementById(`parking-spot-${searchResult.spot.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      // Clear highlight after 5 seconds
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
            {/* View mode toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === 'map' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                title="Vista plano"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                title="Vista lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
              <SelectTrigger className="w-[180px]">
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

      {/* Summary KPIs */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Total Plazas" value={overview.summary.total} icon={ParkingSquare} color="text-foreground" />
          <KpiCard label="Libres" value={overview.summary.free} icon={CircleDot} color="text-emerald-500" />
          <KpiCard label="Ocupadas" value={overview.summary.occupied} icon={Car} color="text-blue-500" />
          <KpiCard label="Bloqueadas" value={overview.summary.blocked} icon={AlertTriangle} color="text-amber-500" />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      )}

      {/* Map View — Full parking lot layout */}
      {viewMode === 'map' && !isLoading && (
        <TooltipProvider delayDuration={200}>
          <div className="space-y-4">
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
        </TooltipProvider>
      )}

      {/* List View — Table of occupied spots */}
      {viewMode === 'list' && !isLoading && overview && (
        <OccupiedSpotsList
          zones={filteredZones}
          onRelease={(spot) => releaseMutation.mutate(spot.id)}
        />
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

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Parking Zone Map (Visual Layout) ──────────────────────────────────────
function ParkingZoneMap({
  zone,
  onSpotClick,
  onRelease,
  highlightedSpotId,
}: {
  zone: ParkingZone;
  onSpotClick: (spot: ParkingSpot) => void;
  onRelease: (spot: ParkingSpot) => void;
  highlightedSpotId?: string | null;
}) {
  const maxRow = Math.max(...zone.spots.map(s => s.grid_row ?? 0), 0);
  const maxCol = Math.max(...zone.spots.map(s => s.grid_col ?? 0), 0);

  const gridMap = useMemo(() => {
    const map = new Map<string, ParkingSpot>();
    zone.spots.forEach(spot => {
      const key = `${spot.grid_row ?? 0}-${spot.grid_col ?? 0}`;
      map.set(key, spot);
    });
    return map;
  }, [zone.spots]);

  const freeCount = zone.spots.filter(s => s.status === 'free').length;
  const occupiedCount = zone.spots.filter(s => s.status === 'occupied').length;
  const totalCount = zone.spots.length;

  return (
    <Card className="border-border/40 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: zone.color }}
            />
            <CardTitle className="text-sm font-semibold">{zone.name}</CardTitle>
            {zone.description && (
              <span className="text-xs text-muted-foreground hidden sm:inline">({zone.description})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium">
              {freeCount} libres
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800 text-xs font-medium">
              {occupiedCount}/{totalCount}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Parking lot visual grid */}
        <div className="overflow-x-auto">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${maxCol + 1}, minmax(72px, 1fr))`,
            }}
          >
            {Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, idx) => {
              const row = Math.floor(idx / (maxCol + 1));
              const col = idx % (maxCol + 1);
              const spot = gridMap.get(`${row}-${col}`);

              if (!spot) {
                return <div key={idx} className="h-16" />;
              }

              return (
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
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Parking Bay (Single Spot) ─────────────────────────────────────────────
function ParkingBay({
  spot,
  zoneColor,
  onClick,
  isHighlighted,
}: {
  spot: ParkingSpot;
  zoneColor: string;
  onClick: () => void;
  isHighlighted?: boolean;
}) {
  const isOccupied = spot.status === 'occupied';
  const isFree = spot.status === 'free';
  const isBlocked = spot.status === 'blocked';

  // Time since occupied
  const timeLabel = useMemo(() => {
    if (!spot.occupied_at) return null;
    const diff = Date.now() - new Date(spot.occupied_at).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return '<1h';
  }, [spot.occupied_at]);

  const tooltipText = isOccupied
    ? `Plaza ${spot.spot_number} — ${spot.vehicle_matricula}${timeLabel ? ` (${timeLabel})` : ''}\nClick para liberar`
    : isFree
    ? `Plaza ${spot.spot_number} — Libre\nClick para asignar`
    : `Plaza ${spot.spot_number} — ${spot.status}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          id={`parking-spot-${spot.id}`}
          onClick={onClick}
          disabled={isBlocked}
          className={cn(
            "relative h-16 rounded-md border-2 flex flex-col items-center justify-center transition-all duration-150 group",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            isOccupied && "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:shadow-md cursor-pointer",
            isFree && "bg-emerald-50 dark:bg-emerald-950/20 border-dashed border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 cursor-pointer",
            isBlocked && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 opacity-50 cursor-not-allowed",
            spot.status === 'reserved' && "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700",
            isHighlighted && "ring-4 ring-yellow-400 ring-offset-1 border-yellow-400 shadow-lg shadow-yellow-200/50 dark:shadow-yellow-900/30 animate-pulse z-10"
          )}
        >
          {/* Spot number badge */}
          <span className={cn(
            "absolute top-0.5 left-1 text-[9px] font-bold leading-none",
            isOccupied ? "text-slate-400 dark:text-slate-500" : "text-emerald-500 dark:text-emerald-400"
          )}>
            {spot.spot_number}
          </span>

          {/* Vehicle plate (main content for occupied) */}
          {isOccupied && spot.vehicle_matricula && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-0.5">
                <Car className="h-3 w-3 text-blue-500 shrink-0" />
                <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-100 leading-none tracking-tight">
                  {spot.vehicle_matricula}
                </span>
              </div>
              {timeLabel && (
                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">
                  {timeLabel}
                </span>
              )}
            </div>
          )}

          {/* Free spot indicator */}
          {isFree && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-emerald-300 dark:border-emerald-600 flex items-center justify-center group-hover:border-emerald-500">
                <span className="text-[8px] font-bold text-emerald-500">P</span>
              </div>
            </div>
          )}

          {/* Blocked indicator */}
          {isBlocked && (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs whitespace-pre-line">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Occupied Spots List View ──────────────────────────────────────────────
function OccupiedSpotsList({
  zones,
  onRelease,
}: {
  zones: ParkingZone[];
  onRelease: (spot: ParkingSpot) => void;
}) {
  const occupiedSpots = useMemo(() => {
    const spots: (ParkingSpot & { zoneName: string; zoneColor: string })[] = [];
    zones.forEach(zone => {
      zone.spots
        .filter(s => s.status === 'occupied')
        .forEach(spot => {
          spots.push({ ...spot, zoneName: zone.name, zoneColor: zone.color });
        });
    });
    return spots.sort((a, b) => a.spot_number - b.spot_number);
  }, [zones]);

  if (occupiedSpots.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <ParkingSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No hay plazas ocupadas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Car className="h-4 w-4" />
          Plazas Ocupadas ({occupiedSpots.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_120px_100px_80px] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
            <span>Plaza</span>
            <span>Matrícula</span>
            <span>Zona</span>
            <span>Tiempo</span>
            <span className="text-right">Acción</span>
          </div>
          {/* Rows */}
          {occupiedSpots.map(spot => {
            const timeLabel = spot.occupied_at
              ? (() => {
                  const diff = Date.now() - new Date(spot.occupied_at).getTime();
                  const hours = Math.floor(diff / 3600000);
                  const days = Math.floor(hours / 24);
                  if (days > 0) return `${days}d ${hours % 24}h`;
                  if (hours > 0) return `${hours}h`;
                  return '<1h';
                })()
              : '—';

            return (
              <div
                key={spot.id}
                className="grid grid-cols-[60px_1fr_120px_100px_80px] gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors"
              >
                <span className="font-bold text-sm">{spot.spot_number}</span>
                <span className="font-mono font-semibold text-sm text-foreground">
                  {spot.vehicle_matricula || '—'}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: spot.zoneColor }} />
                  <span className="text-xs text-muted-foreground truncate">{spot.zoneName}</span>
                </div>
                <span className="text-xs text-muted-foreground">{timeLabel}</span>
                <div className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => onRelease(spot)}
                  >
                    Liberar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
