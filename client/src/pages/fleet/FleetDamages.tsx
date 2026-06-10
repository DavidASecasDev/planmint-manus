import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { AlertTriangle, Filter, Clock, Wrench, CheckCircle2, BarChart3, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FLEET_DAMAGE_STATUS_OPTIONS, DAMAGE_ZONES } from '@/types/fleet';
import type { FleetVehicleDamage, FleetDamageStatus } from '@/types/fleet';
import { DamageDetailSheet } from '@/components/fleet/DamageDetailSheet';
import { AddDamageDialog } from '@/components/fleet/AddDamageDialog';
import { RepairFormDialog } from '@/components/garatech/RepairFormDialog';
import type { RepairFormData } from '@/types/garatech';
import { toast } from 'sonner';

interface DamageWithVehicle {
  id: string;
  fleet_vehicle_id: string;
  zona: string;
  pieza: string | null;
  descripcion: string | null;
  severidad: string | null;
  status: string | null;
  created_at: string | null;
  origin_type: string;
  photo_url: string | null;
  has_premium_coverage: boolean | null;
  damage_report_id: string | null;
  repair_id: string | null;
  reservation_id: string | null;
  croquis_x: number | null;
  croquis_y: number | null;
  reported_by: string | null;
  resolved_at: string | null;
  fleet_vehicles: {
    matricula: string;
    marca: string | null;
    modelo: string | null;
  } | null;
}

interface FleetVehicleOption {
  id: string;
  matricula: string;
  marca: string | null;
  modelo: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  leve: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  moderado: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  grave: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-destructive/10 text-destructive',
  en_reparacion: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  reparado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function toFleetVehicleDamage(d: DamageWithVehicle): FleetVehicleDamage {
  return {
    id: d.id,
    fleet_vehicle_id: d.fleet_vehicle_id,
    organization_id: '',
    zona: d.zona,
    pieza: d.pieza,
    descripcion: d.descripcion,
    severidad: d.severidad ?? 'leve',
    photo_url: d.photo_url,
    origin_type: (d.origin_type as FleetVehicleDamage['origin_type']) ?? 'movimiento_empleado',
    reservation_id: d.reservation_id,
    has_premium_coverage: d.has_premium_coverage ?? false,
    repair_id: d.repair_id,
    damage_report_id: d.damage_report_id,
    status: (d.status as FleetDamageStatus) ?? 'pendiente',
    croquis_x: d.croquis_x,
    croquis_y: d.croquis_y,
    reported_by: d.reported_by,
    created_at: d.created_at ?? '',
    resolved_at: d.resolved_at,
  };
}

export default function FleetDamages() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');

  const [selectedDamage, setSelectedDamage] = useState<FleetVehicleDamage | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Global register damage states
  const [vehicleSelectorOpen, setVehicleSelectorOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicleOption | null>(null);
  const [addDamageOpen, setAddDamageOpen] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [repairPrefill, setRepairPrefill] = useState<Partial<RepairFormData> | undefined>(undefined);
  const [pendingDamageForRepair, setPendingDamageForRepair] = useState<string | null>(null);

  const { data: damages = [], isLoading } = useQuery({
    queryKey: ['fleet-all-damages', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicle_damages')
        .select('id, fleet_vehicle_id, zona, pieza, descripcion, severidad, status, created_at, origin_type, photo_url, has_premium_coverage, damage_report_id, repair_id, reservation_id, croquis_x, croquis_y, reported_by, resolved_at, fleet_vehicles(matricula, marca, modelo)')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as DamageWithVehicle[]) ?? [];
    },
    enabled: !!orgId,
  });

  // Fleet vehicles for the vehicle selector
  const { data: fleetVehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles-list', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicles')
        .select('id, matricula, marca, modelo')
        .eq('organization_id', orgId!)
        .order('matricula');
      if (error) throw error;
      return (data as FleetVehicleOption[]) ?? [];
    },
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fleet_vehicle_damages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-all-damages'] });
      toast.success('Daño eliminado');
    },
    onError: () => toast.error('Error al eliminar el daño'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FleetDamageStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'reparado') updates.resolved_at = new Date().toISOString();
      else updates.resolved_at = null;
      const { error } = await supabase.from('fleet_vehicle_damages').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-all-damages'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });

  // Create damage report handler
  const handleCreateReport = async (damage: FleetVehicleDamage) => {
    if (!damage.reservation_id) {
      toast.error('Este daño no tiene reserva vinculada. Vincúlalo primero.');
      return;
    }

    try {
      // Fetch reservation data from synced API data
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('id, external_reservation_id, cliente_nombre, cliente_apellido, tipo_documento_cliente, documento_cliente, desde, hasta, modelo, auto, categoria')
        .eq('id', damage.reservation_id)
        .single();

      if (resError || !reservation) {
        toast.error('No se pudo obtener la información de la reserva');
        return;
      }

      // Generate report number
      const { count } = await supabase
        .from('damage_reports')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!);

      const reportNumber = `DMG-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;

      const customerName = [reservation.cliente_nombre, reservation.cliente_apellido].filter(Boolean).join(' ');

      // Insert damage report with data from synced reservation
      const { data: report, error: insertError } = await supabase
        .from('damage_reports')
        .insert({
          organization_id: orgId!,
          report_number: reportNumber,
          damage_date: damage.created_at || new Date().toISOString(),
          vehicle_id: null,
          reservation_id: damage.reservation_id,
          customer_name: customerName || null,
          customer_document: reservation.documento_cliente || null,
          reported_by: profile?.id || null,
          status: 'borrador',
          document_type: reservation.tipo_documento_cliente || null,
          external_reservation_number: reservation.external_reservation_id || null,
          contract_start_date: reservation.desde || null,
          contract_end_date: reservation.hasta || null,
          vehicle_brand: reservation.categoria || null,
          vehicle_model: reservation.modelo || null,
          vehicle_plate: reservation.auto || null,
        } as any)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Link the damage report to the damage
      await supabase
        .from('fleet_vehicle_damages')
        .update({ damage_report_id: report!.id })
        .eq('id', damage.id);

      queryClient.invalidateQueries({ queryKey: ['fleet-all-damages'] });
      setSheetOpen(false);
      toast.success('Informe de cobro creado correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al crear el informe');
    }
  };

  // Handle adding damage from global button
  const handleAddDamage = async (damageData: any) => {
    const { error } = await supabase.from('fleet_vehicle_damages').insert(damageData);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['fleet-all-damages'] });
    toast.success('Daño registrado');
  };

  const handleCreateRepairFromDamage = async (damage: FleetVehicleDamage) => {
    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('id')
      .eq('fleet_vehicle_id', damage.fleet_vehicle_id)
      .limit(1)
      .single();

    const vehicleId = vehicleData?.id || '';
    const desc = `Reparación: ${damage.zona.replace(/_/g, ' ')}${damage.pieza ? ` - ${damage.pieza}` : ''}${damage.descripcion ? ` (${damage.descripcion})` : ''}`;

    setRepairPrefill({
      vehicle_id: vehicleId,
      repair_type: 'reparacion',
      description: desc,
    });
    setPendingDamageForRepair(damage.id);
    setRepairDialogOpen(true);
  };

  const handleRepairCreated = async (repairId: string) => {
    if (pendingDamageForRepair) {
      await supabase
        .from('fleet_vehicle_damages')
        .update({ repair_id: repairId, status: 'en_reparacion' } as any)
        .eq('id', pendingDamageForRepair);
      queryClient.invalidateQueries({ queryKey: ['fleet-all-damages'] });
      setPendingDamageForRepair(null);
    }
  };

  // Unique vehicles for filter
  const vehicleOptions = useMemo(() => {
    const map = new Map<string, string>();
    damages.forEach(d => {
      if (d.fleet_vehicles?.matricula) {
        map.set(d.fleet_vehicle_id, d.fleet_vehicles.matricula);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [damages]);

  const filtered = useMemo(() => {
    return damages.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (severityFilter !== 'all' && d.severidad !== severityFilter) return false;
      if (vehicleFilter !== 'all' && d.fleet_vehicle_id !== vehicleFilter) return false;
      if (originFilter !== 'all' && d.origin_type !== originFilter) return false;
      return true;
    });
  }, [damages, statusFilter, severityFilter, vehicleFilter, originFilter]);

  // KPI counts
  const totalCount = damages.length;
  const pendingCount = damages.filter(d => d.status === 'pendiente').length;
  const inRepairCount = damages.filter(d => d.status === 'en_reparacion').length;
  const repairedCount = damages.filter(d => d.status === 'reparado').length;

  const kpis = [
    { label: 'Total', value: totalCount, icon: BarChart3, color: 'text-foreground', bg: 'bg-muted/50' },
    { label: 'Pendientes', value: pendingCount, icon: Clock, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'En reparación', value: inRepairCount, icon: Wrench, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20' },
    { label: 'Reparados', value: repairedCount, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
  ];

  const handleRowClick = (d: DamageWithVehicle) => {
    setSelectedDamage(toFleetVehicleDamage(d));
    setSheetOpen(true);
  };

  return (
    <AppLayout title="Historial de Daños">
      <div className="space-y-6 w-full pb-8">
        <PageHeader
          icon={AlertTriangle}
          title="Historial de Daños"
          actions={
            <Button
              className="rounded-2xl"
              onClick={() => setVehicleSelectorOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Daño
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className={`rounded-2xl border border-border/50 p-4 ${k.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <k.icon className={`h-4 w-4 ${k.color}`} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <span className={`text-2xl font-bold ${k.color}`}>{k.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {FLEET_DAMAGE_STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="leve">Leve</SelectItem>
              <SelectItem value="moderado">Moderado</SelectItem>
              <SelectItem value="grave">Grave</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Vehículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vehicleOptions.map(([id, matricula]) => (
                <SelectItem key={id} value={id}>{matricula}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="reserva">Reserva</SelectItem>
              <SelectItem value="movimiento_empleado">Movimiento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No se encontraron daños con los filtros seleccionados.
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => {
                  const vehicle = d.fleet_vehicles;
                  const zoneLabel = DAMAGE_ZONES.find(z => z.key === d.zona)?.label ?? d.zona;
                  return (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(d)}
                    >
                      <TableCell className="font-medium">
                        <div>{vehicle?.matricula ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{[vehicle?.marca, vehicle?.modelo].filter(Boolean).join(' ') || '—'}</div>
                      </TableCell>
                      <TableCell>{zoneLabel}</TableCell>
                      <TableCell className="text-sm">{d.pieza ?? '—'}</TableCell>
                      <TableCell>
                        {d.severidad && (
                          <Badge variant="outline" className={SEVERITY_COLORS[d.severidad] ?? ''}>
                            {d.severidad}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[d.status ?? ''] ?? ''}>
                          {FLEET_DAMAGE_STATUS_OPTIONS.find(s => s.value === d.status)?.label ?? d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.origin_type === 'reserva' ? 'Reserva' : 'Movimiento'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.created_at ? format(new Date(d.created_at), 'dd MMM yyyy', { locale: es }) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DamageDetailSheet
        damage={selectedDamage}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDelete={(id) => deleteMutation.mutate(id)}
        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
        onCreateReport={handleCreateReport}
        onCreateRepair={handleCreateRepairFromDamage}
      />

      <RepairFormDialog
        open={repairDialogOpen}
        onOpenChange={setRepairDialogOpen}
        prefill={repairPrefill}
        onCreated={handleRepairCreated}
      />

      {/* Vehicle selector dialog for global "Registrar Daño" */}
      <Dialog open={vehicleSelectorOpen} onOpenChange={setVehicleSelectorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Seleccionar vehículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {fleetVehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay vehículos registrados</p>
            ) : (
              fleetVehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedVehicle(v);
                    setVehicleSelectorOpen(false);
                    setAddDamageOpen(true);
                  }}
                >
                  <div className="text-sm font-medium">{v.matricula}</div>
                  <div className="text-xs text-muted-foreground">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add damage dialog (global) */}
      {selectedVehicle && orgId && (
        <AddDamageDialog
          open={addDamageOpen}
          onOpenChange={(v) => { setAddDamageOpen(v); if (!v) setSelectedVehicle(null); }}
          fleetVehicleId={selectedVehicle.id}
          organizationId={orgId}
          vehiclePlate={selectedVehicle.matricula}
          onSubmit={handleAddDamage}
        />
      )}
    </AppLayout>
  );
}
