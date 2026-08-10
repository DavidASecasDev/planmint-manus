import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { ChevronLeft, ChevronRight, MapPin, Car, User, ArrowRight, Baby, Plus } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { toast } from 'sonner';
import { VEHICLE_TYPE_META, DIRECTION_META, TRANSFER_REQUEST_STATUS_META } from '@/types/transfers';
import type { TransferRequest, TransferRequestStatus, TransferDirection, VehicleType } from '@/types/transfers';

interface TransfersWeeklyCalendarProps {
  requests: TransferRequest[];
  onItemUpdated?: () => void;
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

export function TransfersWeeklyCalendar({ requests, onItemUpdated }: TransfersWeeklyCalendarProps) {
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [draggedEvent, setDraggedEvent] = useState<WeeklyEvent | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dateKey: string; hour: number } | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ evt: WeeklyEvent; dateKey: string; hour: number } | null>(null);

  const canDrag = (status: string) => ['pendiente', 'aceptado', 'conductor_asignado'].includes(status);

  const handleDragStart = (evt: WeeklyEvent, e: React.DragEvent) => {
    if (!canDrag(evt.status)) { e.preventDefault(); return; }
    setDraggedEvent(evt);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', evt.itemId);
  };

  const handleDragOver = (dateKey: string, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ dateKey, hour });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (dateKey: string, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggedEvent) return;

    // Don't update if same cell
    if (hour === draggedEvent.hour) {
      setDraggedEvent(null);
      return;
    }

    // Show confirmation dialog instead of directly updating
    setPendingDrop({ evt: draggedEvent, dateKey, hour });
    setDraggedEvent(null);
  };

  const confirmDrop = async () => {
    if (!pendingDrop) return;
    const { evt, dateKey, hour } = pendingDrop;
    const newTime = String(hour).padStart(2, '0') + ':00:00';
    try {
      const { error } = await supabaseQuery
        .from('transfer_items')
        .update({ transfer_date: dateKey, transfer_time: newTime })
        .eq('id', evt.itemId);
      if (error) throw new Error(error.message);
      toast.success(`Transfer movido a ${format(new Date(dateKey), 'EEE dd/MM', { locale: es })} ${String(hour).padStart(2, '0')}:00`);
      onItemUpdated?.();
    } catch (err: any) {
      toast.error(`Error al mover: ${err.message}`);
    }
    setPendingDrop(null);
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDropTarget(null);
  };

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
                          className={`border-r last:border-r-0 p-0.5 group/cell relative ${
                            isCurrentDay ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                          } ${
                            cellEvents.length === 0 ? 'hover:bg-muted/40 cursor-pointer' : ''
                          } ${
                            dropTarget?.dateKey === dateKey && dropTarget?.hour === hour ? 'bg-blue-100/60 ring-2 ring-blue-400/50 ring-inset' : ''
                          }`}
                          onClick={() => {
                            if (cellEvents.length === 0) {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const timeStr = String(hour).padStart(2, '0') + ':00';
                              navigate(`/transfers/new?date=${dateStr}&time=${timeStr}`);
                            }
                          }}
                          onDragOver={(e) => handleDragOver(dateKey, hour, e)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(dateKey, hour, e)}
                        >
                          {cellEvents.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                              <Plus className="w-3.5 h-3.5 text-muted-foreground/50" />
                            </div>
                          )}
                          {cellEvents.map((evt, evtIdx) => (
                          <Tooltip key={`${evt.itemId}-${evtIdx}`}>
                            <TooltipTrigger asChild>
                            <div
                              draggable={canDrag(evt.status)}
                              onDragStart={(e) => handleDragStart(evt, e)}
                              onDragEnd={handleDragEnd}
                              className={`p-1.5 rounded border hover:shadow-sm transition-shadow mb-0.5 ${getStatusBg(evt.status)} ${canDrag(evt.status) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                                draggedEvent?.itemId === evt.itemId ? 'opacity-50' : ''
                              }`}
                              onClick={(e) => { e.stopPropagation(); navigate(`/transfers/requests/${evt.requestId}`); }}
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
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px] p-3 space-y-1.5">
                              <div className="font-semibold text-sm">{evt.clientName}</div>
                              <div className="text-xs text-muted-foreground">{evt.requestNumber} · {evt.time}</div>
                              <div className="flex items-center gap-1 text-xs">
                                <MapPin className="w-3 h-3 text-green-600 shrink-0" />
                                <span className="truncate">{evt.pickupLocation || 'Sin recogida'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <MapPin className="w-3 h-3 text-red-600 shrink-0" />
                                <span className="truncate">{evt.dropoffLocation || 'Sin destino'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs pt-1 border-t">
                                <User className="w-3 h-3 shrink-0" />
                                <span>{evt.driverName || 'Sin conductor asignado'}</span>
                              </div>
                              {evt.vehicleType && (
                                <div className="flex items-center gap-1 text-xs">
                                  <Car className="w-3 h-3 shrink-0" />
                                  <span>{VEHICLE_TYPE_META[evt.vehicleType]?.label || evt.vehicleType}</span>
                                </div>
                              )}
                              {evt.babySeatsCount > 0 && (
                                <div className="flex items-center gap-1 text-xs text-pink-600">
                                  <Baby className="w-3 h-3 shrink-0" />
                                  <span>{evt.babySeatsCount} sillita{evt.babySeatsCount > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
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

      {/* Confirmation dialog for drag & drop */}
      <AlertDialog open={!!pendingDrop} onOpenChange={(open) => { if (!open) setPendingDrop(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover transfer?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {pendingDrop && (
                  <span>
                    Mover <strong>{pendingDrop.evt.clientName}</strong> ({pendingDrop.evt.requestNumber}) de{' '}
                    <strong>{pendingDrop.evt.time}</strong> a{' '}
                    <strong>{format(new Date(pendingDrop.dateKey), 'EEEE dd/MM', { locale: es })} {String(pendingDrop.hour).padStart(2, '0')}:00</strong>
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDrop}>Mover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
