import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, MapPin, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TransferRequest } from '@/types/transfers';

interface TransfersCalendarProps {
  requests: TransferRequest[];
  onRequestClick: (request: TransferRequest) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
  en_gestion: 'bg-blue-100 text-blue-800 border-blue-200',
  presupuesto_enviado: 'bg-purple-100 text-purple-800 border-purple-200',
  confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completado: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-500',
  en_gestion: 'bg-blue-500',
  presupuesto_enviado: 'bg-purple-500',
  confirmado: 'bg-emerald-500',
  completado: 'bg-gray-400',
  cancelado: 'bg-red-500',
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_VISIBLE = 3;

function TransferCalendarCard({ request, compact, onClick }: { request: TransferRequest; compact?: boolean; onClick: () => void }) {
  const firstItem = request.items?.[0];
  
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate border transition-colors hover:opacity-80",
          STATUS_COLORS[request.status] || 'bg-muted text-foreground'
        )}
        title={`${request.request_number} — ${request.client_name}`}
      >
        <span className="truncate">{request.client_name}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-2 rounded-md border transition-colors hover:bg-muted/50",
        STATUS_COLORS[request.status] || 'bg-muted text-foreground'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT_COLORS[request.status])} />
        <span className="font-medium text-xs truncate">{request.request_number}</span>
      </div>
      <p className="text-xs font-medium truncate">{request.client_name}</p>
      <p className="text-[10px] text-muted-foreground truncate">{request.broker_name}</p>
      {firstItem && (
        <div className="mt-1 space-y-0.5">
          {firstItem.pickup_location && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{firstItem.pickup_location}</span>
            </div>
          )}
          {firstItem.pickup_time && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              <span>{firstItem.pickup_time}</span>
            </div>
          )}
          {firstItem.pax_count && firstItem.pax_count > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-2.5 w-2.5 shrink-0" />
              <span>{firstItem.pax_count} pax</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export function TransfersCalendar({ requests, onRequestClick }: TransfersCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Group requests by their first_transfer_date (or first item's transfer_date)
  const requestsByDay = useMemo(() => {
    const map = new Map<string, TransferRequest[]>();
    
    requests.forEach((request) => {
      // Use first_transfer_date (computed field) or first item's date
      const date = request.first_transfer_date || request.items?.[0]?.transfer_date;
      if (date) {
        const dateKey = date.substring(0, 10); // yyyy-MM-dd
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(request);
      }

      // Also check other items for multi-day transfers
      if (request.items && request.items.length > 1) {
        request.items.slice(1).forEach(item => {
          if (item.transfer_date) {
            const itemDateKey = item.transfer_date.substring(0, 10);
            if (itemDateKey !== date?.substring(0, 10)) {
              if (!map.has(itemDateKey)) {
                map.set(itemDateKey, []);
              }
              // Avoid duplicates
              const existing = map.get(itemDateKey)!;
              if (!existing.find(r => r.id === request.id)) {
                existing.push(request);
              }
            }
          }
        });
      }
    });

    return map;
  }, [requests]);

  // Count total transfers this month
  const monthTransferCount = useMemo(() => {
    let count = 0;
    calendarDays.forEach(day => {
      if (isSameMonth(day, currentDate)) {
        const dateKey = format(day, 'yyyy-MM-dd');
        count += (requestsByDay.get(dateKey) || []).length;
      }
    });
    return count;
  }, [calendarDays, currentDate, requestsByDay]);

  return (
    <div className="flex flex-col">
      {/* Calendar header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="font-medium">
            Hoy
          </Button>
          <div className="flex items-center rounded-lg border border-border/50 bg-card">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="rounded-r-none h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="rounded-l-none h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold capitalize ml-2">
            {format(currentDate, "MMMM 'de' yyyy", { locale: es })}
          </h2>
        </div>
        <Badge variant="secondary" className="text-xs">
          {monthTransferCount} transfer{monthTransferCount !== 1 ? 's' : ''} este mes
        </Badge>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayRequests = requestsByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-[110px] p-1 border rounded-md transition-colors",
                isCurrentMonth ? "bg-card" : "bg-muted/30",
                isTodayDate && "ring-2 ring-primary",
                dayRequests.length > 0 && isCurrentMonth && "bg-card hover:bg-muted/20"
              )}
            >
              <div className={cn(
                "text-sm font-medium mb-1 flex items-center justify-between",
                !isCurrentMonth && "text-muted-foreground",
                isTodayDate && "text-primary"
              )}>
                <span>{format(day, 'd')}</span>
                {dayRequests.length > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded-full px-1.5">
                    {dayRequests.length}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                {dayRequests.slice(0, MAX_VISIBLE).map((request) => (
                  <TransferCalendarCard
                    key={request.id}
                    request={request}
                    compact
                    onClick={() => onRequestClick(request)}
                  />
                ))}

                {dayRequests.length > MAX_VISIBLE && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-auto py-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        +{dayRequests.length - MAX_VISIBLE} más
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="font-medium mb-2">
                        {format(day, "EEEE d 'de' MMMM", { locale: es })}
                      </div>
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {dayRequests.map((request) => (
                            <TransferCalendarCard
                              key={request.id}
                              request={request}
                              onClick={() => onRequestClick(request)}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t">
        <span className="text-xs text-muted-foreground font-medium">Leyenda:</span>
        {[
          { key: 'pendiente', label: 'Pendiente' },
          { key: 'en_gestion', label: 'En gestión' },
          { key: 'confirmado', label: 'Confirmado' },
          { key: 'completado', label: 'Completado' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT_COLORS[key])} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
