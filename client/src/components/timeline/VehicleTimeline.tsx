/**
 * VehicleTimeline — Gantt-style horizontal timeline for vehicle reservations.
 *
 * Inspired by Rently's timeline view:
 * - Y-axis: vehicles grouped by category
 * - X-axis: days (scrollable)
 * - Bars: colored by reservation status
 * - Hover: tooltip with reservation info
 * - Click: navigates to reservation detail (when interactive=true)
 *
 * Props:
 * - data: TimelineData from the API
 * - interactive: if true, bars are clickable and show full info on hover
 * - onReservationClick: callback when a bar is clicked (interactive mode)
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineReservation {
  id: string;
  vehiclePlate: string;
  startDate: string;
  endDate: string;
  status: string;
  color: string;
  clientName: string | null;
  clientPhone: string | null;
  model: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  origin: string | null;
  paid: string | null;
  externalId: string | null;
  durationDays: number;
}

export interface TimelineVehicle {
  plate: string;
  model: string | null;
  reservations: TimelineReservation[];
}

export interface TimelineGroup {
  category: string;
  vehicles: TimelineVehicle[];
}

export interface TimelineData {
  fromDate: string;
  toDate: string;
  today: string;
  groups: TimelineGroup[];
  statusColors: Record<string, string>;
}

export interface VehicleTimelineProps {
  data: TimelineData | null;
  isLoading?: boolean;
  interactive?: boolean;
  onReservationClick?: (reservationId: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (value: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_WIDTH = 32; // px per day column
const ROW_HEIGHT = 28; // px per vehicle row
const HEADER_HEIGHT = 50; // px for the date header
const LABEL_WIDTH = 140; // px for vehicle labels column
const DAY_NAMES_ES = ["D", "L", "M", "X", "J", "V", "S"];
const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const current = new Date(start);
  while (current <= end) {
    days.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function dayIndex(day: string, days: string[]): number {
  return days.indexOf(day);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VehicleTimeline({
  data,
  isLoading = false,
  interactive = false,
  onReservationClick,
  categoryFilter,
  onCategoryFilterChange,
}: VehicleTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    reservation: TimelineReservation;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute days array
  const days = useMemo(() => {
    if (!data) return [];
    return getDaysBetween(data.fromDate, data.toDate);
  }, [data]);

  // Get categories for filter
  const categories = useMemo(() => {
    if (!data) return [];
    return data.groups.map(g => g.category).sort();
  }, [data]);

  // Filter groups by category
  const filteredGroups = useMemo(() => {
    if (!data) return [];
    if (!categoryFilter || categoryFilter === "all") return data.groups;
    return data.groups.filter(g => g.category === categoryFilter);
  }, [data, categoryFilter]);

  // Scroll to today on mount
  useEffect(() => {
    if (!data || !scrollRef.current || days.length === 0) return;
    const todayIdx = dayIndex(data.today, days);
    if (todayIdx > 0) {
      const scrollTo = Math.max(0, (todayIdx - 3) * DAY_WIDTH);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [data, days]);

  // Scroll navigation
  const scrollBy = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = DAY_WIDTH * 7;
    scrollRef.current.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  }, []);

  // Tooltip handlers
  const handleBarMouseEnter = useCallback((e: React.MouseEvent, reservation: TimelineReservation) => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      reservation,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 200);
  }, []);

  const handleBarClick = useCallback((reservation: TimelineReservation) => {
    if (interactive && onReservationClick) {
      onReservationClick(reservation.id);
    }
  }, [interactive, onReservationClick]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-card rounded-lg border">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-8 w-8 animate-pulse" />
          <span className="text-sm">Cargando timeline...</span>
        </div>
      </div>
    );
  }

  if (!data || filteredGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-card rounded-lg border">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-8 w-8" />
          <span className="text-sm">No hay datos para mostrar</span>
        </div>
      </div>
    );
  }

  // Build month headers
  const monthHeaders: Array<{ label: string; startIdx: number; span: number }> = [];
  let currentMonth = "";
  let currentStart = 0;
  let currentSpan = 0;
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i] + "T00:00:00");
    const monthKey = `${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`;
    if (monthKey !== currentMonth) {
      if (currentMonth) {
        monthHeaders.push({ label: currentMonth, startIdx: currentStart, span: currentSpan });
      }
      currentMonth = monthKey;
      currentStart = i;
      currentSpan = 1;
    } else {
      currentSpan++;
    }
  }
  if (currentMonth) {
    monthHeaders.push({ label: currentMonth, startIdx: currentStart, span: currentSpan });
  }

  const totalWidth = days.length * DAY_WIDTH;
  const todayIdx = dayIndex(data.today, days);

  return (
    <div className="flex flex-col bg-card rounded-lg border overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
        <Button variant="outline" size="sm" onClick={() => scrollBy("left")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => scrollBy("right")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {categories.length > 1 && onCategoryFilterChange && (
          <Select value={categoryFilter || "all"} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          {Object.entries(data.statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
              <span>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline grid */}
      <div className="flex overflow-hidden">
        {/* Left labels column */}
        <div className="flex-shrink-0 border-r bg-muted/20" style={{ width: LABEL_WIDTH }}>
          {/* Header spacer */}
          <div style={{ height: HEADER_HEIGHT }} className="border-b flex items-end px-2 pb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vehículo</span>
          </div>
          {/* Vehicle labels */}
          {filteredGroups.map(group => (
            <div key={group.category}>
              {/* Category header */}
              <div
                className="flex items-center px-2 bg-muted/40 border-b border-t"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider truncate">
                  {group.category}
                </span>
              </div>
              {/* Vehicle rows */}
              {group.vehicles.map(vehicle => (
                <div
                  key={vehicle.plate}
                  className="flex items-center px-2 border-b hover:bg-muted/30 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="text-[11px] font-medium text-foreground truncate" title={vehicle.model || vehicle.plate}>
                    {vehicle.plate}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Scrollable timeline area */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div style={{ width: totalWidth, position: "relative" }}>
            {/* Date header */}
            <div style={{ height: HEADER_HEIGHT }} className="border-b sticky top-0 bg-card z-10">
              {/* Month row */}
              <div className="flex" style={{ height: 22 }}>
                {monthHeaders.map((mh, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-[11px] font-semibold text-foreground border-r"
                    style={{ width: mh.span * DAY_WIDTH, marginLeft: i === 0 ? mh.startIdx * DAY_WIDTH : 0 }}
                  >
                    {mh.label}
                  </div>
                ))}
              </div>
              {/* Day row */}
              <div className="flex" style={{ height: 28 }}>
                {days.map((day, i) => {
                  const d = new Date(day + "T00:00:00");
                  const dayOfWeek = d.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isToday = day === data.today;
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex flex-col items-center justify-center border-r text-[9px]",
                        isWeekend && "bg-muted/40",
                        isToday && "bg-emerald-100 dark:bg-emerald-900/30"
                      )}
                      style={{ width: DAY_WIDTH }}
                    >
                      <span className={cn(
                        "font-medium",
                        isToday ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                      )}>
                        {DAY_NAMES_ES[dayOfWeek]}
                      </span>
                      <span className={cn(
                        "font-bold",
                        isToday ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                      )}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vehicle rows with bars */}
            {filteredGroups.map(group => (
              <div key={group.category}>
                {/* Category separator */}
                <div
                  className="bg-muted/40 border-b border-t"
                  style={{ height: ROW_HEIGHT, width: totalWidth }}
                />
                {/* Vehicle rows */}
                {group.vehicles.map(vehicle => (
                  <div
                    key={vehicle.plate}
                    className="relative border-b"
                    style={{ height: ROW_HEIGHT, width: totalWidth }}
                  >
                    {/* Weekend background stripes */}
                    {days.map((day, i) => {
                      const d = new Date(day + "T00:00:00");
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      if (!isWeekend) return null;
                      return (
                        <div
                          key={day}
                          className="absolute top-0 bottom-0 bg-muted/20"
                          style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                        />
                      );
                    })}
                    {/* Today line */}
                    {todayIdx >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-emerald-500/60 z-[5]"
                        style={{ left: todayIdx * DAY_WIDTH + DAY_WIDTH / 2 }}
                      />
                    )}
                    {/* Reservation bars */}
                    {vehicle.reservations.map(reservation => {
                      const startIdx = Math.max(0, dayIndex(reservation.startDate, days));
                      const endIdx = Math.min(days.length - 1, dayIndex(reservation.endDate, days));
                      if (startIdx < 0 && endIdx < 0) return null;
                      const left = startIdx * DAY_WIDTH + 2;
                      const width = Math.max((endIdx - startIdx + 1) * DAY_WIDTH - 4, 8);

                      return (
                        <div
                          key={reservation.id}
                          className={cn(
                            "absolute top-[3px] rounded-full z-[3] transition-all",
                            interactive && "cursor-pointer hover:brightness-110 hover:shadow-md"
                          )}
                          style={{
                            left,
                            width,
                            height: ROW_HEIGHT - 6,
                            backgroundColor: reservation.color,
                            opacity: reservation.status === "Completada" ? 0.6 : 0.9,
                          }}
                          onMouseEnter={(e) => handleBarMouseEnter(e, reservation)}
                          onMouseLeave={handleBarMouseLeave}
                          onClick={() => handleBarClick(reservation)}
                        >
                          {/* Show $ icon for paid reservations */}
                          {reservation.paid && reservation.paid !== "No" && reservation.paid !== "no" && width > 24 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-white/90">$</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl border p-3 min-w-[240px] max-w-[320px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {tooltip.reservation.clientName || "Sin cliente"}
                </p>
                {tooltip.reservation.externalId && (
                  <p className="text-xs text-muted-foreground">
                    Reserva #{tooltip.reservation.externalId}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-0.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tooltip.reservation.color }}
                  />
                  <span className="text-xs text-muted-foreground">{tooltip.reservation.status}</span>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {tooltip.reservation.model && (
                  <p className="font-medium text-foreground">{tooltip.reservation.vehiclePlate}</p>
                )}
                {tooltip.reservation.model && (
                  <p>{tooltip.reservation.model}</p>
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-1 text-xs">
              <div>
                <span className="text-emerald-600">→</span>{" "}
                {formatDateShort(tooltip.reservation.startDate)}
                {tooltip.reservation.pickupLocation && (
                  <p className="text-muted-foreground truncate">{tooltip.reservation.pickupLocation}</p>
                )}
              </div>
              <div>
                <span className="text-red-500">←</span>{" "}
                {formatDateShort(tooltip.reservation.endDate)}
                {tooltip.reservation.dropoffLocation && (
                  <p className="text-muted-foreground truncate">{tooltip.reservation.dropoffLocation}</p>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                ⏱ {tooltip.reservation.durationDays} día{tooltip.reservation.durationDays !== 1 ? "s" : ""}
              </span>
              {tooltip.reservation.paid && tooltip.reservation.paid !== "No" && tooltip.reservation.paid !== "no" && (
                <span className="text-emerald-600 font-medium">✓ Pagado</span>
              )}
              {tooltip.reservation.origin && (
                <span className="text-muted-foreground">{tooltip.reservation.origin}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
