import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { ChevronLeft, ChevronRight, Sun, CloudSun, Sunset, MapPin, Car, User, Phone, Ship, Building2, ExternalLink, ArrowRight } from 'lucide-react';
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { VEHICLE_TYPE_META, DIRECTION_META } from '@/types/transfers';
import type { TransferRequest, TransferRequestStatus, TransferDirection, VehicleType } from '@/types/transfers';

interface TransfersDailySummaryProps {
  requests: TransferRequest[];
}

interface DailyTransferEvent {
  requestId: string;
  requestNumber: string;
  clientName: string;
  clientType: string;
  clientPhone: string | null;
  villaName: string | null;
  boatName: string | null;
  status: TransferRequestStatus;
  itemId: string;
  direction: TransferDirection;
  time: string; // HH:mm
  vehicleType: VehicleType | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupPlaceId: string | null;
  dropoffPlaceId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  paxCount: number | null;
  flightNumber: string | null;
}

type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'night';

const TIME_SLOTS: { key: TimeSlot; label: string; range: string; icon: typeof Sun; startHour: number; endHour: number }[] = [
  { key: 'morning', label: 'Mañana', range: '06:00 – 12:00', icon: Sun, startHour: 6, endHour: 12 },
  { key: 'midday', label: 'Mediodía', range: '12:00 – 16:00', icon: CloudSun, startHour: 12, endHour: 16 },
  { key: 'afternoon', label: 'Tarde', range: '16:00 – 22:00', icon: Sunset, startHour: 16, endHour: 22 },
  { key: 'night', label: 'Noche', range: '22:00 – 06:00', icon: Sunset, startHour: 22, endHour: 6 },
];

function getTimeSlot(time: string): TimeSlot {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 22) return 'afternoon';
  return 'night';
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Hoy';
  if (isTomorrow(date)) return 'Mañana';
  if (isYesterday(date)) return 'Ayer';
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

function openInGoogleMaps(placeId: string | null, address: string | null) {
  if (placeId) {
    window.open(`https://www.google.com/maps/place/?q=place_id:${placeId}`, '_blank');
  } else if (address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }
}

export function TransfersDailySummary({ requests }: TransfersDailySummaryProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Only show confirmed transfers (aceptado, conductor_asignado, en_curso)
  const confirmedStatuses = ['aceptado', 'conductor_asignado', 'en_curso'];

  const dailyEvents = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const events: DailyTransferEvent[] = [];

    for (const req of requests) {
      if (!confirmedStatuses.includes(req.status)) continue;
      if (!req.items) continue;

      for (const item of req.items) {
        if (!item.transfer_date || !item.transfer_time) continue;
        const itemDateStr = item.transfer_date.slice(0, 10);
        if (itemDateStr !== dateStr) continue;

        events.push({
          requestId: req.id,
          requestNumber: req.request_number,
          clientName: req.client_name,
          clientType: req.client_type,
          clientPhone: req.client_phone,
          villaName: req.villa_name,
          boatName: req.boat_name,
          status: req.status,
          itemId: item.id,
          direction: item.direction,
          time: item.transfer_time.slice(0, 5),
          vehicleType: item.vehicle_type,
          pickupLocation: item.pickup_location,
          dropoffLocation: item.dropoff_location,
          pickupPlaceId: item.pickup_place_id,
          dropoffPlaceId: item.dropoff_place_id,
          driverName: item.driver_name,
          driverPhone: item.driver_phone,
          paxCount: item.pax_count,
          flightNumber: item.flight_number,
        });
      }
    }

    events.sort((a, b) => a.time.localeCompare(b.time));
    return events;
  }, [requests, selectedDate]);

  // Group by time slot
  const groupedBySlot = useMemo(() => {
    const groups: Record<TimeSlot, DailyTransferEvent[]> = {
      morning: [],
      midday: [],
      afternoon: [],
      night: [],
    };
    for (const evt of dailyEvents) {
      const slot = getTimeSlot(evt.time);
      groups[slot].push(evt);
    }
    return groups;
  }, [dailyEvents]);

  // Stats
  const totalEvents = dailyEvents.length;
  const withDriver = dailyEvents.filter(e => e.driverName).length;
  const withoutDriver = totalEvents - withDriver;

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <h2 className="text-lg font-semibold capitalize">{getDateLabel(selectedDate)}</h2>
            <p className="text-xs text-muted-foreground">{format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isToday(selectedDate) && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())} className="ml-2 text-xs">
              Hoy
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="secondary" className="text-xs">
            {totalEvents} servicio{totalEvents !== 1 ? 's' : ''}
          </Badge>
          {withDriver > 0 && (
            <Badge variant="outline" className="text-xs text-green-700 border-green-300">
              <User className="w-3 h-3 mr-1" /> {withDriver} con conductor
            </Badge>
          )}
          {withoutDriver > 0 && (
            <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">
              {withoutDriver} sin asignar
            </Badge>
          )}
        </div>
      </div>

      {/* Time slots */}
      {totalEvents === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay transfers confirmados para este día
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {TIME_SLOTS.map(slot => {
            const slotEvents = groupedBySlot[slot.key];
            if (slotEvents.length === 0) return null;
            const SlotIcon = slot.icon;

            return (
              <Card key={slot.key} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <SlotIcon className="w-4 h-4 text-amber-500" />
                      {slot.label}
                      <span className="text-xs text-muted-foreground font-normal">({slot.range})</span>
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {slotEvents.length} servicio{slotEvents.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {slotEvents.map((evt, idx) => (
                    <div
                      key={`${evt.itemId}-${idx}`}
                      className="p-4 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/transfers/requests/${evt.requestId}`)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Time column */}
                        <div className="shrink-0 w-14 text-center">
                          <div className="text-lg font-bold text-primary">{evt.time}</div>
                          <Badge variant="outline" className={`text-[10px] ${DIRECTION_META[evt.direction]?.color || ''}`}>
                            {evt.direction === 'ida' ? '→ Ida' : '← Vuelta'}
                          </Badge>
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Client row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{evt.clientName}</span>
                            {evt.clientType === 'charter' ? (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Ship className="w-3 h-3" /> {evt.boatName || 'Charter'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Building2 className="w-3 h-3" /> {evt.villaName || 'Villa'}
                              </Badge>
                            )}
                            {evt.paxCount && evt.paxCount > 0 && (
                              <span className="text-xs text-muted-foreground">{evt.paxCount} pax</span>
                            )}
                            {evt.flightNumber && (
                              <Badge variant="secondary" className="text-[10px]">✈ {evt.flightNumber}</Badge>
                            )}
                            <TransferStatusBadge status={evt.status} />
                          </div>

                          {/* Route row */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <button
                              className="flex items-center gap-1 hover:text-primary transition-colors text-left truncate max-w-[200px]"
                              onClick={e => { e.stopPropagation(); openInGoogleMaps(evt.pickupPlaceId, evt.pickupLocation); }}
                              title="Abrir en Google Maps"
                            >
                              <MapPin className="w-3 h-3 shrink-0 text-green-600" />
                              <span className="truncate">{evt.pickupLocation || 'Sin definir'}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </button>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                            <button
                              className="flex items-center gap-1 hover:text-primary transition-colors text-left truncate max-w-[200px]"
                              onClick={e => { e.stopPropagation(); openInGoogleMaps(evt.dropoffPlaceId, evt.dropoffLocation); }}
                              title="Abrir en Google Maps"
                            >
                              <MapPin className="w-3 h-3 shrink-0 text-red-600" />
                              <span className="truncate">{evt.dropoffLocation || 'Sin definir'}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          </div>

                          {/* Vehicle & driver row */}
                          <div className="flex items-center gap-3 text-xs">
                            {evt.vehicleType && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Car className="w-3 h-3" />
                                {VEHICLE_TYPE_META[evt.vehicleType]?.label || evt.vehicleType}
                              </span>
                            )}
                            {evt.driverName ? (
                              <span className="flex items-center gap-1 text-green-700 font-medium">
                                <User className="w-3 h-3" />
                                {evt.driverName}
                                {evt.driverPhone && (
                                  <a
                                    href={`tel:${evt.driverPhone}`}
                                    className="flex items-center gap-0.5 hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <Phone className="w-3 h-3" /> {evt.driverPhone}
                                  </a>
                                )}
                              </span>
                            ) : (
                              <span className="text-yellow-600 font-medium text-xs">⚠ Sin conductor asignado</span>
                            )}
                          </div>
                        </div>

                        {/* Request number */}
                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-mono text-muted-foreground">{evt.requestNumber}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
