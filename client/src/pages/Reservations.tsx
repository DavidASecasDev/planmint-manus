import { useState, useMemo } from 'react';
import { Upload, Table, MapPin } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReservationsTable } from '@/components/reservations/ReservationsTable';
import { ImportReservations } from '@/components/reservations/ImportReservations';
import { SyncRentlyDialog } from '@/components/reservations/SyncRentlyDialog';
import { useRentlySyncContext } from '@/contexts/RentlySyncContext';
import { useAuth } from '@/contexts/AuthContext';
import { OperationsMapView, type MapOperation } from '@/components/reservations/OperationsMapView';
import { useReservations } from '@/hooks/useReservations';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { format, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Reservations() {
  const [activeTab, setActiveTab] = useState('table');
  const { syncDialogOpen, setSyncDialogOpen } = useRentlySyncContext();

  const handleSyncComplete = () => {
    // The table should refetch automatically via react-query
  };

  return (
    <AppLayout title="Programación" fullWidth>
      <div className="flex flex-col h-full">
        {activeTab !== 'map' && (
          <div className="shrink-0">
            <PageHeader
              title="Programación"
              description="Gestiona las operaciones del día: entregas, devoluciones y transfers"
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className={`flex flex-col flex-1 min-h-0 ${activeTab === 'map' ? 'mt-0' : 'mt-6'}`}>
          <TabsList className="shrink-0">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Vista tabla
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Vista mapa
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="mt-6 flex-1 min-h-0">
            <ReservationsTable />
          </TabsContent>

          <TabsContent value="map" className="mt-0 flex-1 min-h-0">
            <MapTabContent />
          </TabsContent>

          <TabsContent value="import" className="mt-6 flex-1 min-h-0 overflow-auto">
            <ImportReservations />
          </TabsContent>
        </Tabs>
      </div>

      <SyncRentlyDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onSyncComplete={handleSyncComplete}
      />
    </AppLayout>
  );
}

/**
 * MapTabContent — Standalone date picker + map view for the map tab.
 * Uses its own date state independent of the table's filters.
 */
function MapTabContent() {
  const { profile } = useAuth();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch reservations for the selected date
  const dateFilter = useMemo(() => ({
    from: selectedDateStr,
    to: undefined,
  }), [selectedDateStr]);

  const { reservations, isLoading, updateReservation } = useReservations(dateFilter);
  const { members } = useOrganizationMembers();

  // Build a map from user_id to name for fast lookup
  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach(m => {
      if (m.user_id && m.name) map.set(m.user_id, m.name);
      if (m.user_id && m.profile?.name) map.set(m.user_id, m.profile.name);
    });
    return map;
  }, [members]);

  // Callback to mark an operation as completed from the map
  const handleMarkCompleted = (reservationId: string, tipoOperacion: 'Entrega' | 'Devoluci\u00f3n' | 'Transfer') => {
    const fieldMap: Record<string, string> = {
      'Entrega': 'entrega_completada',
      'Devoluci\u00f3n': 'devolucion_completada',
      'Transfer': 'transfer_completado',
    };
    updateReservation.mutate({ id: reservationId, data: { [fieldMap[tipoOperacion]]: true } as any });
  };

  // Convert reservations to MapOperation format
  const mapOperations = useMemo<MapOperation[]>(() => {
    const ops: MapOperation[] = [];

    reservations.forEach(r => {
      const clienteNombre = r.cliente_nombre || '';
      const clienteApellido = r.cliente_apellido || '';

      if (r.tipo_actividad === 'Transfer') {
        const assigneeId = r.asignado_rental_id;
        ops.push({
          id: `${r.id}_transfer`,
          reservationId: r.id,
          externalReservationId: r.external_reservation_id,
          tipoOperacion: 'Transfer',
          clienteNombre,
          clienteApellido,
          lugar: r.lugar_entrega || null,
          direccion: r.lugar_devolucion || null,
          confirmedDatetime: r.confirmed_entrega_datetime,
          fechaHora: r.desde,
          isCompleted: r.transfer_completado,
          assignedRentalName: assigneeId ? (memberNameMap.get(assigneeId) || null) : null,
          vehiclePlate: r.auto || null,
        });
      } else {
        // Entrega
        const entregaDateKey = r.desde ? r.desde.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : null;
        if (entregaDateKey === selectedDateStr) {
          const entregaAssigneeId = r.asignado_rental_entrega_id || r.asignado_rental_id;
          ops.push({
            id: `${r.id}_entrega`,
            reservationId: r.id,
            externalReservationId: r.external_reservation_id,
            tipoOperacion: 'Entrega',
            clienteNombre,
            clienteApellido,
            lugar: r.lugar_entrega,
            direccion: r.lugar_entrega_direccion || null,
            confirmedDatetime: r.confirmed_entrega_datetime,
            fechaHora: r.desde,
            isCompleted: r.entrega_completada,
            assignedRentalName: entregaAssigneeId ? (memberNameMap.get(entregaAssigneeId) || null) : null,
            vehiclePlate: r.auto || null,
          });
        }

        // Devolución
        const devolucionDateKey = r.hasta ? r.hasta.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : null;
        if (devolucionDateKey === selectedDateStr) {
          const devAssigneeId = r.asignado_rental_devolucion_id || r.asignado_rental_id;
          ops.push({
            id: `${r.id}_devolucion`,
            reservationId: r.id,
            externalReservationId: r.external_reservation_id,
            tipoOperacion: 'Devoluci\u00f3n',
            clienteNombre,
            clienteApellido,
            lugar: r.lugar_devolucion,
            direccion: r.lugar_devolucion_direccion || null,
            confirmedDatetime: r.confirmed_devolucion_datetime,
            fechaHora: r.hasta,
            isCompleted: r.devolucion_completada,
            assignedRentalName: devAssigneeId ? (memberNameMap.get(devAssigneeId) || null) : null,
            vehiclePlate: r.auto || null,
          });
        }
      }
    });

    return ops;
  }, [reservations, selectedDateStr, memberNameMap]);

  const goToPrevDay = () => setSelectedDate(d => addDays(d, -1));
  const goToNextDay = () => setSelectedDate(d => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  return (
    <div className="flex flex-col -m-4 md:-m-6 lg:-m-8 -mb-8 md:-mb-12 lg:-mb-16" style={{ height: 'calc(100% + 2rem + 2rem)' }}>
      {/* Full-page map with overlaid controls */}
      <OperationsMapView
        operations={mapOperations}
        isLoading={isLoading}
        organizationId={profile?.organization_id || undefined}
        fullPage
        onMarkCompleted={handleMarkCompleted}
        dateControls={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={goToPrevDay} className="h-8 w-8 bg-white/90 backdrop-blur-sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "min-w-[200px] justify-start text-left font-medium bg-white/90 backdrop-blur-sm",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="icon" onClick={goToNextDay} className="h-8 w-8 bg-white/90 backdrop-blur-sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {selectedDateStr !== todayStr && (
              <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs bg-white/90 backdrop-blur-sm">
                Ir a hoy
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
