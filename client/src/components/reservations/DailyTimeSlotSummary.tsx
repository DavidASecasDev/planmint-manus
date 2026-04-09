import React, { useMemo } from 'react';
import { Sun, Sunset, Moon, MapPin, Car, ArrowRight, User, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OperationRow {
  id: string;
  reservationId: string;
  reservation: {
    id: string;
    external_reservation_id: string;
    cliente_nombre: string | null;
    cliente_apellido: string | null;
    modelo: string | null;
    auto: string | null;
  };
  tipoOperacion: 'Entrega' | 'Devolución' | 'Transfer';
  fechaHora: string | null;
  confirmedDatetime: string | null;
  lugar: string | null;
  isCompleted: boolean;
}

interface TimeSlot {
  id: string;
  label: string;
  icon: React.ReactNode;
  startHour: number;
  endHour: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const TIME_SLOTS: TimeSlot[] = [
  {
    id: 'morning',
    label: 'Mañana',
    icon: <Sun className="h-4 w-4" />,
    startHour: 6,
    endHour: 12,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  {
    id: 'midday',
    label: 'Mediodía',
    icon: <Sunset className="h-4 w-4" />,
    startHour: 12,
    endHour: 16,
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    id: 'evening',
    label: 'Tarde / Noche',
    icon: <Moon className="h-4 w-4" />,
    startHour: 16,
    endHour: 24,
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
];

// Extract hour from ISO string without timezone conversion
function extractHour(isoStr: string): number | null {
  const match = isoStr.match(/T(\d{2}):\d{2}/);
  return match ? parseInt(match[1], 10) : null;
}

// Extract time (HH:MM) from ISO string without timezone conversion
function extractTime(isoStr: string): string {
  const match = isoStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '--:--';
}

// Extract date part from ISO string
function extractDatePart(isoStr: string): string | null {
  const match = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// Format date part to readable Spanish label
function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${dayNames[d.getDay()]} ${day} de ${monthNames[d.getMonth()]}`;
}

interface DayGroup {
  dateKey: string;
  label: string;
  slots: {
    slot: TimeSlot;
    operations: OperationRow[];
  }[];
  totalOps: number;
}

function getClientName(r: OperationRow['reservation']): string {
  return [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(' ') || 'Sin cliente';
}

function getTipoBadgeColor(tipo: string): string {
  switch (tipo) {
    case 'Entrega': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'Devolución': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    case 'Transfer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default: return '';
  }
}

interface DailyTimeSlotSummaryProps {
  operations: OperationRow[];
}

export function DailyTimeSlotSummary({ operations }: DailyTimeSlotSummaryProps) {
  const dayGroups = useMemo<DayGroup[]>(() => {
    // Group operations by day (using confirmed datetime, fallback to fechaHora)
    const byDay = new Map<string, OperationRow[]>();

    for (const op of operations) {
      const dateStr = op.confirmedDatetime || op.fechaHora;
      if (!dateStr) continue;
      const dayKey = extractDatePart(dateStr);
      if (!dayKey) continue;

      if (!byDay.has(dayKey)) byDay.set(dayKey, []);
      byDay.get(dayKey)!.push(op);
    }

    // Sort days chronologically
    const sortedDays = Array.from(byDay.keys()).sort();

    return sortedDays.map(dateKey => {
      const dayOps = byDay.get(dateKey)!;

      // Group by time slot
      const slots = TIME_SLOTS.map(slot => {
        const slotOps = dayOps.filter(op => {
          const dateStr = op.confirmedDatetime || op.fechaHora;
          if (!dateStr) return false;
          const hour = extractHour(dateStr);
          if (hour === null) return false;
          return hour >= slot.startHour && hour < slot.endHour;
        });

        // Sort operations within slot by time
        slotOps.sort((a, b) => {
          const aStr = a.confirmedDatetime || a.fechaHora || '';
          const bStr = b.confirmedDatetime || b.fechaHora || '';
          return aStr.localeCompare(bStr);
        });

        return { slot, operations: slotOps };
      });

      return {
        dateKey,
        label: formatDayLabel(dateKey),
        slots,
        totalOps: dayOps.length,
      };
    });
  }, [operations]);

  if (dayGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No hay operaciones para mostrar en la vista de franjas horarias.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dayGroups.map(day => (
        <div key={day.dateKey} className="space-y-3">
          {/* Day header */}
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground capitalize">
              {day.label}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {day.totalOps} operaciones
            </Badge>
          </div>

          {/* Time slots */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {day.slots.map(({ slot, operations: slotOps }) => (
              <Card
                key={slot.id}
                className={cn(
                  "border overflow-hidden",
                  slot.borderColor,
                  slotOps.length === 0 && "opacity-50"
                )}
              >
                {/* Slot header */}
                <div className={cn(
                  "flex items-center justify-between px-3 py-2 border-b",
                  slot.bgColor,
                  slot.borderColor
                )}>
                  <div className={cn("flex items-center gap-2 text-sm font-medium", slot.color)}>
                    {slot.icon}
                    <span>{slot.label}</span>
                    <span className="text-xs font-normal opacity-70">
                      ({String(slot.startHour).padStart(2, '0')}:00 – {slot.endHour === 24 ? '23:59' : `${String(slot.endHour).padStart(2, '0')}:00`})
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("text-xs font-semibold", slot.color)}
                  >
                    {slotOps.length}
                  </Badge>
                </div>

                {/* Operations list */}
                <CardContent className="p-0">
                  {slotOps.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Sin operaciones
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {slotOps.map(op => {
                        const dateStr = op.confirmedDatetime || op.fechaHora;
                        const time = dateStr ? extractTime(dateStr) : '--:--';
                        const isModified = op.confirmedDatetime && op.fechaHora && op.confirmedDatetime !== op.fechaHora;

                        return (
                          <div
                            key={op.id}
                            className={cn(
                              "px-3 py-2 flex items-start gap-2 text-xs hover:bg-muted/30 transition-colors",
                              op.isCompleted && "opacity-50"
                            )}
                          >
                            {/* Time */}
                            <div className="flex items-center gap-1 shrink-0 w-12 pt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn(
                                      "font-mono font-medium",
                                      isModified && "text-amber-700 dark:text-amber-400"
                                    )}>
                                      {time}
                                    </span>
                                  </TooltipTrigger>
                                  {isModified && (
                                    <TooltipContent side="top" className="text-xs">
                                      <p>Hora ajustada manualmente</p>
                                      <p className="text-muted-foreground">
                                        Original: {op.fechaHora ? extractTime(op.fechaHora) : '--:--'}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            {/* Operation details */}
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  getTipoBadgeColor(op.tipoOperacion)
                                )}>
                                  {op.tipoOperacion}
                                </span>
                                <span className="font-medium text-foreground truncate">
                                  {getClientName(op.reservation)}
                                </span>
                                {op.isCompleted && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-emerald-600 border-emerald-300">
                                    Completada
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-muted-foreground">
                                {op.reservation.auto && (
                                  <span className="flex items-center gap-0.5">
                                    <Car className="h-3 w-3" />
                                    {op.reservation.auto}
                                  </span>
                                )}
                                {op.reservation.modelo && (
                                  <span className="truncate">{op.reservation.modelo}</span>
                                )}
                                {op.lugar && (
                                  <span className="flex items-center gap-0.5 truncate">
                                    <MapPin className="h-3 w-3" />
                                    {op.lugar}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Reservation ID */}
                            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                              #{op.reservation.external_reservation_id}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
