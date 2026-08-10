import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { ChevronLeft, ChevronRight, MapPin, Car, User, ArrowRight, Baby } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { VEHICLE_TYPE_META, DIRECTION_META, TRANSFER_REQUEST_STATUS_META } from '@/types/transfers';
import type { TransferRequest, TransferRequestStatus, TransferDirection, VehicleType } from '@/types/transfers';

interface TransfersWeeklyCalendarProps {
  requests: TransferRequest[];
}

interface WeeklyEvent {
  requestId: string;
  requestNumber: string;
  clientName: string;
  clientType: string;
  status: TransferRequestStatus;
  itemId: string;
  direction: TransferDirection;
  time: string; // HH:mm
  hour: number;
  vehicleType: VehicleType | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  driverName: string | null;
  paxCount: number | null;
  flightNumber: string | null;
  babySeatsCount: number;
  luggageCount: number;
  vansNeeded: number;
}

// Hours to display (6:00 to 23:00)
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export function TransfersWeeklyCalendar({ requests }: TransfersWeeklyCalendarProps) {
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Generate 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Build events mapped by day and hour
  const eventsByDayHour = useMemo(() => {
    const map: Record<string, Record<number, WeeklyEvent[]>> = {};

    for (const day of weekDays) {
      const dateKey = format(day, 'yyyy-MM-dd');
      map[dateKey] = {};
      for (const h of HOURS) {
        map[dateKey][h] = [];
      }
    }

    for (const req of requests) {
      if (!req.items) continue;
      if (statusFilter !== 'all' && req.status !== statusFilter) continue;

      for (const item of req.items) {
        if (!item.transfer_date || !item.transfer_time) continue;
        if (vehicleFilter !== 'all' && item.vehicle_type !== vehicleFilter) continue;

        const itemDateStr = item.transfer_date.slice(0, 10);
        if (!map[itemDateStr]) continue; // Not in this week

        const hour = parseInt(item.transfer_time.slice(0, 2), 10);
        const displayHour = hour < 6 ? 6 : hour > 23 ? 23 : hour;

        if (!map[itemDateStr][displayHour]) {
          map[itemDateStr][displayHour] = [];
        }

        map[itemDateStr][displayHour].push({
          requestId: req.id,
          requestNumber: req.request_number || '',
          clientName: req.client_name,
          clientType: req.client_type,
          status: req.status,
          itemId: item.id,
          direction: item.direction || 'ida',
          time: item.transfer_time.slice(0, 5),
          hour: displayHour,
          vehicleType: item.vehicle_type,
          pickupLocation: item.pickup_location,
          dropoffLocation: item.dropoff_location,
          driverName: item.driver_name,
          paxCount: item.pax_count,
          flightNumber: item.flight_number,
          babySeatsCount: item.baby_seats_count || 0,
          luggageCount: (item as any).luggage_count || 0,
          vansNeeded: (item as any).vans_needed || 1,
        });
      }
    }

    // Sort events within each slot by time
    for (const dateKey of Object.keys(map)) {
      for (const h of Object.keys(map[dateKey])) {
        map[dateKey][Number(h)].sort((a, b) => a.time.localeCompare(b.time));
      }
    }

    return map;
  }, [requests, weekDays, statusFilter, vehicleFilter]);

  // Count total events per day for the header
  const eventsPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of weekDays) {
      const dateKey = format(day, 'yyyy-MM-dd');
      let count = 0;
      for (const h of HOURS) {
        count += (eventsByDayHour[dateKey]?.[h]?.length || 0);
      }
      counts[dateKey] = count;
    }
    return counts;
  }, [weekDays, eventsByDayHour]);

  // Count baby seats needed per day for stock planning
  const babySeatsPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of weekDays) {
      const dateKey = format(day, 'yyyy-MM-dd');
      let total = 0;
      for (const h of HOURS) {
        const events = eventsByDayHour[dateKey]?.[h] || [];
        for (const evt of events) {
          total += evt.babySeatsCount;
        }
      }
      counts[dateKey] = total;
    }
    return counts;
  }, [weekDays, eventsByDayHour]);

  const today = new Date();

  const getStatusBg = (status: TransferRequestStatus) => {
    switch (status) {
      case 'pendiente': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'aceptado':
      case 'conductor_asignado': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'en_curso': return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
      case 'completado': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      default: return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Week header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[260px] text-center">
            {format(weekDays[0], "d MMM", { locale: es })} – {format(weekDays[6], "d MMM yyyy", { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="ml-2 text-xs"
          >
            Esta semana
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

      {/* Weekly grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30 sticky top-0 z-10 pr-[10px]">
              <div className="p-2 border-r flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Hora</span>
              </div>
              {weekDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const isCurrentDay = isSameDay(day, today);
                const count = eventsPerDay[dateKey] || 0;
                return (
                  <div
                    key={idx}
                    className={`p-2 text-center border-r last:border-r-0 ${
                      isCurrentDay ? 'bg-blue-50/80 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <div className={`text-xs font-medium capitalize ${isCurrentDay ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      {format(day, 'EEE', { locale: es })}
                    </div>
                    <div className={`text-sm font-bold ${isCurrentDay ? 'text-blue-600' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
                        {count}
                      </Badge>
                    )}
                    {(babySeatsPerDay[dateKey] || 0) > 0 && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        <Baby className="w-3 h-3 text-pink-500" />
                        <span className="text-[9px] font-bold text-pink-600">{babySeatsPerDay[dateKey]}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            <div className="max-h-[600px] overflow-y-auto">
              {HOURS.map(hour => {
                // Check if any day has events for this hour
                const hasAnyEvent = weekDays.some(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  return (eventsByDayHour[dateKey]?.[hour]?.length || 0) > 0;
                });

                return (
                  <div
                    key={hour}
                    className={`grid grid-cols-[60px_repeat(7,1fr)] border-b ${
                      hasAnyEvent ? 'min-h-[70px]' : 'min-h-[36px]'
                    }`}
                  >
                    {/* Hour label */}
                    <div className="p-1 border-r flex items-start justify-center pt-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>

                    {/* Day cells */}
                    {weekDays.map((day, dayIdx) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const cellEvents = eventsByDayHour[dateKey]?.[hour] || [];
                      const isCurrentDay = isSameDay(day, today);

                      return (
                        <div
                          key={dayIdx}
                          className={`border-r last:border-r-0 p-0.5 ${
                            isCurrentDay ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                          }`}
                        >
                          {cellEvents.map((evt, evtIdx) => (
                            <div
                              key={`${evt.itemId}-${evtIdx}`}
                              className={`p-1.5 rounded border cursor-pointer hover:shadow-sm transition-shadow mb-0.5 ${getStatusBg(evt.status)}`}
                              onClick={() => navigate(`/transfers/requests/${evt.requestId}`)}
                              title={`${evt.time} · ${evt.clientName} · ${evt.pickupLocation || ''} → ${evt.dropoffLocation || ''}`}
                            >
                              {/* Time + client */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-primary">{evt.time}</span>
                                <span className="text-[10px] truncate font-medium">{evt.clientName}</span>
                                {evt.babySeatsCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 flex-shrink-0" title={`${evt.babySeatsCount} sillita${evt.babySeatsCount > 1 ? 's' : ''} de bebé`}>
                                    <Baby className="h-2.5 w-2.5 text-pink-500" />
                                  </span>
                                )}
                                {evt.direction === 'vuelta' && (
                                  <span className="text-[9px] text-muted-foreground">↩</span>
                                )}
                              </div>

                              {/* Route compact */}
                              <div className="flex items-center gap-0.5 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 shrink-0 text-green-600" />
                                <span className="text-[9px] truncate text-muted-foreground max-w-[60px]">
                                  {evt.pickupLocation || '-'}
                                </span>
                                <ArrowRight className="w-2 h-2 shrink-0 text-muted-foreground" />
                                <MapPin className="w-2.5 h-2.5 shrink-0 text-red-600" />
                                <span className="text-[9px] truncate text-muted-foreground max-w-[60px]">
                                  {evt.dropoffLocation || '-'}
                                </span>
                              </div>

                              {/* Driver + vehicle */}
                              <div className="flex items-center gap-1 mt-0.5">
                                {evt.driverName ? (
                                  <span className="flex items-center gap-0.5 text-[9px] text-green-700 font-medium">
                                    <User className="w-2.5 h-2.5" />
                                    <span className="truncate max-w-[70px]">{evt.driverName}</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-yellow-600 font-medium">⚠ Sin conductor</span>
                                )}
                                {evt.vehicleType && (
                                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground ml-auto">
                                    <Car className="w-2.5 h-2.5" />
                                    <span className="truncate max-w-[50px]">
                                      {VEHICLE_TYPE_META[evt.vehicleType]?.label?.split(' ')[1] || evt.vehicleType}
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Pax + flight */}
                              {(evt.paxCount || evt.flightNumber) && (
                                <div className="flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground">
                                  {evt.paxCount && <span>{evt.paxCount} pax</span>}
                                  {evt.flightNumber && <span>✈ {evt.flightNumber}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300" /> Pendiente
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-300" /> Aceptado/Asignado
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-50 border border-orange-300" /> En curso
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-50 border border-green-300" /> Completado
        </span>
        <span className="flex items-center gap-1 ml-4">
          <User className="w-3 h-3 text-green-700" /> Conductor asignado
        </span>
        <span className="flex items-center gap-1">
          <span className="text-yellow-600 font-medium">⚠</span> Sin conductor
        </span>
      </div>
    </div>
  );
}
