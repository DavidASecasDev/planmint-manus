import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { ChevronLeft, ChevronRight, Ship, Building2, Car } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { CLIENT_TYPE_META, VEHICLE_TYPE_META, TRANSFER_REQUEST_STATUS_META } from '@/types/transfers';
import type { TransferRequest, TransferRequestStatus, VehicleType } from '@/types/transfers';

interface TransfersCalendarProps {
  requests: TransferRequest[];
}

interface CalendarEvent {
  requestId: string;
  requestNumber: string;
  clientName: string;
  clientType: string;
  status: TransferRequestStatus;
  itemId: string;
  direction: string;
  time: string;
  vehicleType?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  driverName?: string;
}

export function TransfersCalendar({ requests }: TransfersCalendarProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Build calendar events from transfer items
  const events = useMemo(() => {
    const evts: CalendarEvent[] = [];
    for (const req of requests) {
      if (!req.items) continue;
      for (const item of req.items) {
        if (!item.transfer_date) continue;
        // Apply filters
        if (statusFilter !== 'all' && req.status !== statusFilter) continue;
        if (vehicleFilter !== 'all' && item.vehicle_type !== vehicleFilter) continue;

        evts.push({
          requestId: req.id,
          requestNumber: req.request_number || '',
          clientName: req.client_name,
          clientType: req.client_type,
          status: req.status,
          itemId: item.id,
          direction: item.direction || 'ida',
          time: item.transfer_time ? item.transfer_time.slice(0, 5) : '',
          vehicleType: item.vehicle_type || undefined,
          pickupLocation: item.pickup_location || undefined,
          dropoffLocation: item.dropoff_location || undefined,
          driverName: item.driver_name || undefined,
        });
      }
    }
    return evts;
  }, [requests, statusFilter, vehicleFilter]);

  // Map events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const req of requests) {
      if (!req.items) continue;
      for (const item of req.items) {
        if (!item.transfer_date) continue;
        // Apply filters
        if (statusFilter !== 'all' && req.status !== statusFilter) continue;
        if (vehicleFilter !== 'all' && item.vehicle_type !== vehicleFilter) continue;

        const dateKey = item.transfer_date.slice(0, 10); // YYYY-MM-DD
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push({
          requestId: req.id,
          requestNumber: req.request_number || '',
          clientName: req.client_name,
          clientType: req.client_type,
          status: req.status,
          itemId: item.id,
          direction: item.direction || 'ida',
          time: item.transfer_time ? item.transfer_time.slice(0, 5) : '',
          vehicleType: item.vehicle_type || undefined,
          pickupLocation: item.pickup_location || undefined,
          dropoffLocation: item.dropoff_location || undefined,
          driverName: item.driver_name || undefined,
        });
      }
    }
    // Sort events within each day by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [requests, statusFilter, vehicleFilter]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="ml-2 text-xs">
            Hoy
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="aceptado">Aceptado</SelectItem>
              <SelectItem value="conductor_asignado">Conductor asignado</SelectItem>
              <SelectItem value="en_curso">En curso</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Vehículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mercedes_vito">Mercedes Vito</SelectItem>
              <SelectItem value="mercedes_vclass">Mercedes V-Class</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r p-1 ${
                    !isCurrentMonth ? 'bg-muted/20 opacity-50' : ''
                  } ${isToday ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 px-1 ${
                    isToday ? 'text-blue-600 font-bold' : 'text-muted-foreground'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                    {dayEvents.slice(0, 4).map((evt, evtIdx) => {
                      const statusMeta = TRANSFER_REQUEST_STATUS_META[evt.status];
                      return (
                        <div
                          key={`${evt.itemId}-${evtIdx}`}
                          className={`text-[10px] leading-tight px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity truncate ${
                            evt.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            evt.status === 'aceptado' || evt.status === 'conductor_asignado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            evt.status === 'en_curso' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                            evt.status === 'completado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                          onClick={() => navigate(`/transfers/requests/${evt.requestId}`)}
                          title={`${evt.time} · ${evt.clientName} · ${evt.direction === 'ida' ? '→' : '←'} ${evt.pickupLocation || ''}`}
                        >
                          <span className="font-medium">{evt.time}</span>
                          {' '}
                          <span>{evt.clientName}</span>
                          {evt.direction === 'vuelta' && ' ↩'}
                        </div>
                      );
                    })}
                    {dayEvents.length > 4 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 4} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> Pendiente
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> Aceptado/Asignado
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-100 border border-orange-300" /> En curso
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Completado
        </span>
      </div>
    </div>
  );
}
