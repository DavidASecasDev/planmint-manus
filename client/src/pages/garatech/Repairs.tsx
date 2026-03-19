import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Hammer, MoreHorizontal, Trash2, Car, List, LayoutGrid, Eye, Filter, Loader2, ShieldAlert } from 'lucide-react';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useRepairs } from '@/hooks/useRepairs';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useVehicles } from '@/hooks/useVehicles';
import { RepairKanbanBoard } from '@/components/garatech/RepairKanbanBoard';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, REPAIR_TYPE_LABELS, type Repair, type RepairStatus, type RepairType } from '@/types/garatech';

interface Filters {
  type: RepairType | 'all';
  workshopId: string;
  vehicleId: string;
}

export default function GaratechRepairs() {
  const navigate = useNavigate();
  const { repairs, isLoading, updateRepair, deleteRepair, canView, canManage, permissionsLoading } = useRepairs();
  const { workshops } = useWorkshops();
  const { vehicles } = useVehicles();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [filters, setFilters] = usePersistedFilters<Filters>({
    type: 'all',
    workshopId: 'all',
    vehicleId: 'all',
  });

  const filteredRepairs = useMemo(() => {
    return repairs.filter((repair) => {
      if (filters.type !== 'all' && repair.repair_type !== filters.type) return false;
      if (filters.workshopId !== 'all' && repair.workshop_id !== filters.workshopId) return false;
      if (filters.vehicleId !== 'all' && repair.vehicle_id !== filters.vehicleId) return false;
      return true;
    });
  }, [repairs, filters]);

  const handleView = (repair: Repair) => {
    navigate(`/garatech/repairs/${repair.id}`);
  };

  const handleDelete = async (repair: Repair) => {
    const vehicleLabel = repair.vehicle ? `${repair.vehicle.matricula}` : 'esta reparación';
    if (confirm(`¿Eliminar la reparación de ${vehicleLabel}?`)) {
      await deleteRepair.mutateAsync(repair.id);
    }
  };

  const handleStatusChange = async (repair: Repair, newStatus: RepairStatus) => {
    await updateRepair.mutateAsync({ id: repair.id, data: { status: newStatus } });
  };

  const activeFiltersCount = [
    filters.type !== 'all',
    filters.workshopId !== 'all',
    filters.vehicleId !== 'all',
  ].filter(Boolean).length;

  if (permissionsLoading) {
    return (
      <AppLayout title="Reparaciones">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout title="Reparaciones">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver reparaciones</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reparaciones">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Reparaciones"
            description="Gestiona las reparaciones de vehículos de la flota"
            icon={Hammer}
          />
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as 'list' | 'kanban')}
              className="border rounded-md"
            >
              <ToggleGroupItem value="list" aria-label="Vista lista" size="sm">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Vista kanban" size="sm">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            {canManage && (
              <Button onClick={() => navigate('/garatech/repairs/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Reparación
              </Button>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filtros</span>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{activeFiltersCount}</Badge>
                )}
              </div>
              <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value as RepairType | 'all' }))}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {Object.entries(REPAIR_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.workshopId} onValueChange={(value) => setFilters(prev => ({ ...prev, workshopId: value }))}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Taller" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los talleres</SelectItem>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>{workshop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.vehicleId} onValueChange={(value) => setFilters(prev => ({ ...prev, vehicleId: value }))}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Vehículo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vehículos</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.matricula}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({ type: 'all', workshopId: 'all', vehicleId: 'all' })} className="text-muted-foreground">
                  Limpiar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card><CardContent className="pt-6"><div className="space-y-2">{[1, 2, 3].map(i => (<Skeleton key={i} className="h-16 w-full" />))}</div></CardContent></Card>
        ) : filteredRepairs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <Hammer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No hay reparaciones</p>
                <p className="text-sm mt-1">
                  {repairs.length > 0 ? 'No hay reparaciones que coincidan con los filtros' : 'Las reparaciones de vehículos aparecerán aquí'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'kanban' ? (
          <RepairKanbanBoard repairs={filteredRepairs} onRepairClick={handleView} onStatusChange={handleStatusChange} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Fecha Programada</TableHead>
                    <TableHead className="text-right">Coste Est.</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRepairs.map((repair) => (
                    <TableRow key={repair.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleView(repair)}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{repair.repair_number || '--'}</TableCell>
                      <TableCell>
                        {repair.vehicle ? (
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{repair.vehicle.matricula}</div>
                              <div className="text-xs text-muted-foreground">{repair.vehicle.modelo}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sin vehículo</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{REPAIR_TYPE_LABELS[repair.repair_type]}</Badge></TableCell>
                      <TableCell><Badge className={REPAIR_STATUS_COLORS[repair.status]}>{REPAIR_STATUS_LABELS[repair.status]}</Badge></TableCell>
                      <TableCell>{repair.workshop?.name || <span className="text-muted-foreground">--</span>}</TableCell>
                      <TableCell>
                        {repair.scheduled_date ? format(new Date(repair.scheduled_date), 'dd MMM yyyy', { locale: es }) : <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{repair.cost_estimate ? `${repair.cost_estimate.toLocaleString('es-ES')}€` : '--'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(repair)}>
                              <Eye className="h-4 w-4 mr-2" />Ver detalle
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                {Object.entries(REPAIR_STATUS_LABELS).map(([status, label]) => (
                                  status !== repair.status && (
                                    <DropdownMenuItem key={status} onClick={() => handleStatusChange(repair, status as RepairStatus)}>
                                      Cambiar a {label}
                                    </DropdownMenuItem>
                                  )
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(repair)}>
                                  <Trash2 className="h-4 w-4 mr-2" />Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
