/**
 * Parking Map — Visual layout of the Azul Cars campa
 * Shows zones with numbered spots, occupancy status, and vehicle plates
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Car, ParkingSquare, MapPin, Clock, RefreshCw,
  Settings, History, CircleDot, AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

  // Fetch parking overview
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['parking-overview'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingOverview; error?: string }>('parking/overview', { body: {} });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
      return result.data.data;
    },
    refetchInterval: 15000, // Auto-refresh every 15s
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

      {/* Parking Zones Grid */}
      <div className="space-y-6">
        {filteredZones.map(zone => (
          <ParkingZoneGrid
            key={zone.id}
            zone={zone}
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

// ─── Zone Grid Component ────────────────────────────────────────────────────
function ParkingZoneGrid({
  zone,
  onSpotClick,
  onRelease,
}: {
  zone: ParkingZone;
  onSpotClick: (spot: ParkingSpot) => void;
  onRelease: (spot: ParkingSpot) => void;
}) {
  // Determine grid dimensions
  const maxRow = Math.max(...zone.spots.map(s => s.grid_row ?? 0), 0);
  const maxCol = Math.max(...zone.spots.map(s => s.grid_col ?? 0), 0);

  // Create a grid map for quick lookup
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

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
            <CardTitle className="text-base">{zone.name}</CardTitle>
            {zone.description && (
              <span className="text-xs text-muted-foreground">{zone.description}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              {freeCount} libres
            </Badge>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
              {occupiedCount} ocupadas
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${maxCol + 1}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, idx) => {
            const row = Math.floor(idx / (maxCol + 1));
            const col = idx % (maxCol + 1);
            const spot = gridMap.get(`${row}-${col}`);

            if (!spot) {
              return <div key={idx} className="h-12" />;
            }

            return (
              <SpotCell
                key={spot.id}
                spot={spot}
                zoneColor={zone.color}
                onClick={() => onSpotClick(spot)}
                onRelease={() => onRelease(spot)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Spot Cell Component ────────────────────────────────────────────────────
function SpotCell({
  spot,
  zoneColor,
  onClick,
  onRelease,
}: {
  spot: ParkingSpot;
  zoneColor: string;
  onClick: () => void;
  onRelease: () => void;
}) {
  const statusStyles = {
    free: 'bg-emerald-500/10 border-emerald-300 hover:bg-emerald-500/20 cursor-pointer',
    occupied: 'bg-blue-500/10 border-blue-300 hover:bg-blue-500/20 cursor-pointer',
    reserved: 'bg-amber-500/10 border-amber-300',
    blocked: 'bg-red-500/10 border-red-300 opacity-50',
  };

  return (
    <div
      className={`relative h-12 rounded border flex flex-col items-center justify-center text-xs transition-colors ${statusStyles[spot.status]}`}
      onClick={spot.status === 'occupied' ? onRelease : onClick}
      title={
        spot.status === 'occupied'
          ? `Plaza ${spot.spot_number} — ${spot.vehicle_matricula} (click para liberar)`
          : `Plaza ${spot.spot_number} — ${spot.status === 'free' ? 'Libre (click para asignar)' : spot.status}`
      }
    >
      <span className="font-bold text-[10px] text-muted-foreground leading-none">{spot.spot_number}</span>
      {spot.status === 'occupied' && spot.vehicle_matricula && (
        <span className="font-mono font-semibold text-[9px] text-blue-700 dark:text-blue-300 leading-none mt-0.5 truncate max-w-full px-0.5">
          {spot.vehicle_matricula}
        </span>
      )}
      {spot.status === 'free' && (
        <Car className="h-3 w-3 text-emerald-500 mt-0.5" />
      )}
    </div>
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

  // Fetch clean vehicles to show as options
  useEffect(() => {
    if (!open) return;
    setMatricula('');
    // Fetch vehicles that are in "limpio" status
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
