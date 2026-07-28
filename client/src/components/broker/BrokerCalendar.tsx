/**
 * BrokerCalendar — Monthly calendar view for the broker portal
 * Shows only transfers assigned to the broker's organization
 * Follows Azul Cars brand styling (dark navy header, gold accents)
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, MapPin, Clock, User, Baby } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TransferRequest, TransferRequestStatus } from '@/types/transfers';

interface BrokerCalendarProps {
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
  babySeatsCount: number;
}

const STATUS_STYLES: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-900 border-l-amber-500',
  aceptado: 'bg-blue-50 text-blue-900 border-l-blue-500',
  conductor_asignado: 'bg-blue-50 text-blue-900 border-l-blue-500',
  en_curso: 'bg-orange-50 text-orange-900 border-l-orange-500',
  completado: 'bg-emerald-50 text-emerald-900 border-l-emerald-500',
  rechazado: 'bg-red-50 text-red-900 border-l-red-400',
  cancelado: 'bg-gray-100 text-gray-600 border-l-gray-400',
};

export function BrokerCalendar({ requests }: BrokerCalendarProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Build calendar events from transfer items
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const req of requests) {
      if (!req.items) continue;
      for (const item of req.items) {
        if (!item.transfer_date) continue;
        if (statusFilter !== 'all' && req.status !== statusFilter) continue;

        const dateKey = item.transfer_date.slice(0, 10);
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
          babySeatsCount: (item as any).baby_seats_count || 0,
        });
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [requests, statusFilter]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
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

  // Count total events for the month
  const monthEventCount = useMemo(() => {
    let count = 0;
    for (const day of calendarDays) {
      if (!isSameMonth(day, currentMonth)) continue;
      const dateKey = format(day, 'yyyy-MM-dd');
      count += (eventsByDate[dateKey] || []).length;
    }
    return count;
  }, [calendarDays, currentMonth, eventsByDate]);

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2
            className="text-lg min-w-[180px] text-center capitalize text-foreground"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
          >
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="ml-2 text-xs">
            Hoy
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {monthEventCount} servicio{monthEventCount !== 1 ? 's' : ''}
          </span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border">
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
      </div>

      {/* Calendar grid */}
      <Card className="overflow-hidden border-border">
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
                  className={`min-h-[110px] border-b border-r border-border p-1 transition-colors ${
                    !isCurrentMonth ? 'bg-muted/10 opacity-40' : ''
                  } ${isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 px-1 ${
                    isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}>
                    {format(day, 'd')}
                    {dayEvents.length > 0 && isCurrentMonth && (
                      <span className="ml-1 text-[9px] text-muted-foreground">({dayEvents.length})</span>
                    )}
                  </div>
                  <div className="space-y-0.5 max-h-[85px] overflow-y-auto">
                    {dayEvents.slice(0, 3).map((evt, evtIdx) => (
                      <div
                        key={`${evt.itemId}-${evtIdx}`}
                        className={`text-[10px] leading-tight px-1.5 py-1 rounded border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${
                          STATUS_STYLES[evt.status] || 'bg-gray-100 text-gray-700 border-l-gray-400'
                        }`}
                        onClick={() => navigate(`/broker/request/${evt.requestId}`)}
                        title={`${evt.time} · ${evt.clientName}\n${evt.pickupLocation || ''} → ${evt.dropoffLocation || ''}\n${evt.driverName ? 'Conductor: ' + evt.driverName : 'Sin conductor'}`}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 shrink-0 opacity-60" />
                          <span className="font-semibold">{evt.time || '--:--'}</span>
                          <span className="truncate">{evt.clientName}</span>
                          {evt.babySeatsCount > 0 && <Baby className="w-3 h-3 shrink-0 text-pink-500" />}
                        </div>
                        {evt.driverName && (
                          <div className="flex items-center gap-1 mt-0.5 opacity-70">
                            <User className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{evt.driverName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1 font-medium">
                        +{dayEvents.length - 3} más
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
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-300" /> Aceptado/Asignado
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-50 border border-orange-300" /> En curso
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" /> Completado
        </span>
      </div>
    </div>
  );
}
