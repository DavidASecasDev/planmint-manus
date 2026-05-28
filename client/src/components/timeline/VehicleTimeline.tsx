/**
 * VehicleTimeline — Professional Gantt-style horizontal timeline for vehicle reservations.
 *
 * Features:
 * - Dynamic zoom: 1M / 3M / 6M toggle buttons
 * - Mini-map overview bar with occupancy density heatmap
 * - Scrollable view with visible horizontal scrollbar
 * - Month selector to jump to any month in the range
 * - Collapsible category sections (click header to toggle)
 * - Occupancy % indicator per category
 * - In-service vehicle indicator (wrench icon + striped background)
 * - Enhanced tooltip with full client info (phone, locations) in interactive mode
 * - Sticky vehicle labels column with category separators
 * - Month/day header with blue tint and day-of-week letters
 * - Vibrant rounded bars with $ icon for paid reservations
 * - Today marker (green vertical line)
 * - Click navigates to reservation detail (interactive mode)
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Calendar, Car, MapPin, Clock, CreditCard, ExternalLink, Phone, User, ZoomIn, Wrench } from "lucide-react";
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
  isCollaborator?: boolean;
  inService?: boolean;
  serviceType?: string | null;
  serviceNotes?: string | null;
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

export type ZoomLevel = "1M" | "3M" | "6M";

export interface VehicleTimelineProps {
  data: TimelineData | null;
  isLoading?: boolean;
  interactive?: boolean;
  onReservationClick?: (reservationId: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (value: string) => void;
  /** Called when the month selector changes — parent should update the date range */
  onMonthChange?: (year: number, month: number) => void;
  /** Called when zoom level changes — parent should update the date range */
  onZoomChange?: (zoom: ZoomLevel) => void;
  /** Current zoom level */
  zoomLevel?: ZoomLevel;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_WIDTH = 34;
const ROW_HEIGHT = 40;
const LABEL_WIDTH = 170;
const CATEGORY_HEADER_HEIGHT = 32;
const MINIMAP_HEIGHT = 36;
const DAY_NAMES_ES = ["D", "L", "M", "X", "J", "V", "S"];
const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const MONTH_NAMES_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
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

/**
 * Calculate occupancy % for a category group within the visible date range.
 */
function calculateOccupancy(group: TimelineGroup, fromDate: string, toDate: string): number {
  const from = new Date(fromDate + "T00:00:00");
  const to = new Date(toDate + "T00:00:00");
  const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const totalVehicleDays = group.vehicles.length * totalDays;
  if (totalVehicleDays === 0) return 0;

  let reservedDays = 0;
  for (const vehicle of group.vehicles) {
    for (const res of vehicle.reservations) {
      if (res.status === "Cancelada") continue;
      const resStart = new Date(Math.max(new Date(res.startDate + "T00:00:00").getTime(), from.getTime()));
      const resEnd = new Date(Math.min(new Date(res.endDate + "T00:00:00").getTime(), to.getTime()));
      const days = Math.max(0, Math.ceil((resEnd.getTime() - resStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      reservedDays += days;
    }
  }

  return Math.min(100, Math.round((reservedDays / totalVehicleDays) * 100));
}

/**
 * Compute per-day occupancy density: how many vehicles have a reservation on each day.
 * Returns an array of numbers (one per day) representing the count.
 */
function computeDailyOccupancy(groups: TimelineGroup[], days: string[]): number[] {
  const counts = new Array(days.length).fill(0);
  const daySet = new Map<string, number>();
  for (let i = 0; i < days.length; i++) {
    daySet.set(days[i], i);
  }

  for (const group of groups) {
    for (const vehicle of group.vehicles) {
      for (const res of vehicle.reservations) {
        if (res.status === "Cancelada") continue;
        const startDate = new Date(res.startDate + "T00:00:00");
        const endDate = new Date(res.endDate + "T00:00:00");
        const rangeStart = new Date(days[0] + "T00:00:00");
        const rangeEnd = new Date(days[days.length - 1] + "T00:00:00");

        const effectiveStart = new Date(Math.max(startDate.getTime(), rangeStart.getTime()));
        const effectiveEnd = new Date(Math.min(endDate.getTime(), rangeEnd.getTime()));

        const current = new Date(effectiveStart);
        while (current <= effectiveEnd) {
          const key = current.toISOString().split("T")[0];
          const idx = daySet.get(key);
          if (idx !== undefined) {
            counts[idx]++;
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }
  }
  return counts;
}

/**
 * Get color for occupancy density level.
 * Uses a green → yellow → orange → red gradient.
 */
function densityColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "transparent";
  const ratio = count / maxCount;
  if (ratio <= 0.25) return "rgba(74, 222, 128, 0.5)";   // green
  if (ratio <= 0.50) return "rgba(250, 204, 21, 0.5)";   // yellow
  if (ratio <= 0.75) return "rgba(251, 146, 60, 0.55)";  // orange
  return "rgba(248, 113, 113, 0.6)";                      // red
}

// ─── Mini-map Component ──────────────────────────────────────────────────────

interface MiniMapProps {
  days: string[];
  groups: TimelineGroup[];
  statusColors: Record<string, string>;
  today: string;
  scrollLeft: number;
  viewportWidth: number;
  totalWidth: number;
  onScrollTo: (scrollLeft: number) => void;
}

function MiniMap({ days, groups, today, scrollLeft, viewportWidth, totalWidth, onScrollTo }: MiniMapProps) {
  const miniMapRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Compute per-day occupancy density for the heatmap
  const dailyOccupancy = useMemo(() => computeDailyOccupancy(groups, days), [groups, days]);
  const maxOccupancy = useMemo(() => Math.max(...dailyOccupancy, 1), [dailyOccupancy]);

  // Count total vehicles for percentage display
  const totalVehicles = useMemo(() => {
    let count = 0;
    for (const g of groups) count += g.vehicles.length;
    return count;
  }, [groups]);

  // Today position as fraction
  const todayIdx = dayIndex(today, days);
  const todayFraction = todayIdx >= 0 ? todayIdx / days.length : -1;

  // Viewport indicator as fraction of total
  const viewportStartFraction = totalWidth > 0 ? scrollLeft / totalWidth : 0;
  const viewportWidthFraction = totalWidth > 0 ? Math.min(viewportWidth / totalWidth, 1) : 1;

  // Month boundaries for mini-map labels
  const monthBoundaries = useMemo(() => {
    const boundaries: Array<{ label: string; fraction: number }> = [];
    let lastMonth = -1;
    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i] + "T00:00:00");
      const month = d.getMonth();
      if (month !== lastMonth) {
        boundaries.push({
          label: MONTH_NAMES_SHORT_ES[month],
          fraction: i / days.length,
        });
        lastMonth = month;
      }
    }
    return boundaries;
  }, [days]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!miniMapRef.current) return;
    const rect = miniMapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = clickX / rect.width;
    const targetScroll = fraction * totalWidth - viewportWidth / 2;
    onScrollTo(Math.max(0, Math.min(targetScroll, totalWidth - viewportWidth)));
  }, [totalWidth, viewportWidth, onScrollTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    handleClick(e);
  }, [handleClick]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !miniMapRef.current) return;
      const rect = miniMapRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / rect.width));
      const targetScroll = fraction * totalWidth - viewportWidth / 2;
      onScrollTo(Math.max(0, Math.min(targetScroll, totalWidth - viewportWidth)));
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [totalWidth, viewportWidth, onScrollTo]);

  return (
    <div
      ref={miniMapRef}
      className="relative cursor-pointer select-none border-b border-border bg-gray-50/80 dark:bg-gray-800/40"
      style={{ height: MINIMAP_HEIGHT, marginLeft: LABEL_WIDTH }}
      onMouseDown={handleMouseDown}
    >
      {/* Month labels */}
      {monthBoundaries.map((mb, i) => (
        <div
          key={i}
          className="absolute top-0 text-[8px] font-semibold text-muted-foreground/60 uppercase tracking-wider"
          style={{ left: `${mb.fraction * 100}%`, paddingLeft: 3, paddingTop: 1 }}
        >
          {mb.label}
        </div>
      ))}

      {/* Occupancy density heatmap */}
      <svg className="absolute inset-0 w-full" style={{ height: MINIMAP_HEIGHT }}>
        {dailyOccupancy.map((count, i) => {
          if (count === 0) return null;
          const x = (i / days.length) * 100;
          const w = (1 / days.length) * 100;
          const barHeight = Math.max(4, (count / maxOccupancy) * (MINIMAP_HEIGHT - 14));
          return (
            <rect
              key={i}
              x={`${x}%`}
              y={MINIMAP_HEIGHT - barHeight - 2}
              width={`${Math.max(w, 0.2)}%`}
              height={barHeight}
              fill={densityColor(count, maxOccupancy)}
              rx={1}
            />
          );
        })}
        {/* Today marker */}
        {todayFraction >= 0 && (
          <line
            x1={`${todayFraction * 100}%`}
            y1={0}
            x2={`${todayFraction * 100}%`}
            y2={MINIMAP_HEIGHT}
            stroke="#10b981"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}
      </svg>

      {/* Density legend (small text on the right) */}
      <div className="absolute top-0 right-1 text-[7px] font-semibold text-muted-foreground/50 leading-none" style={{ paddingTop: 2 }}>
        max: {maxOccupancy}/{totalVehicles}
      </div>

      {/* Viewport indicator */}
      <div
        className="absolute top-0 bottom-0 border border-primary/60 bg-primary/10 rounded-sm transition-[left,width] duration-75"
        style={{
          left: `${viewportStartFraction * 100}%`,
          width: `${viewportWidthFraction * 100}%`,
          minWidth: 8,
        }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VehicleTimeline({
  data,
  isLoading = false,
  interactive = false,
  onReservationClick,
  categoryFilter,
  onCategoryFilterChange,
  onMonthChange,
  onZoomChange,
  zoomLevel = "3M",
}: VehicleTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<{
    reservation: TimelineReservation;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("timeline-collapsed-categories");
      if (stored) return new Set(JSON.parse(stored));
    } catch { /* ignore */ }
    return new Set();
  });

  // Scroll tracking for mini-map
  const [scrollState, setScrollState] = useState({ scrollLeft: 0, viewportWidth: 0 });

  // Toggle category collapse
  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("timeline-collapsed-categories", JSON.stringify(Array.from(collapsedCategories)));
    } catch { /* ignore */ }
  }, [collapsedCategories]);

  // Compute days array
  const days = useMemo(() => {
    if (!data) return [];
    return getDaysBetween(data.fromDate, data.toDate);
  }, [data]);

  // Get categories for filter
  const categories = useMemo(() => {
    if (!data) return [];
    return data.groups.map(g => g.category);
  }, [data]);

  // Filter groups by category
  const filteredGroups = useMemo(() => {
    if (!data) return [];
    if (!categoryFilter || categoryFilter === "all") return data.groups;
    return data.groups.filter(g => g.category === categoryFilter);
  }, [data, categoryFilter]);

  // Build list of months available in the range for the month selector
  const availableMonths = useMemo(() => {
    if (!data) return [];
    const months: Array<{ year: number; month: number; label: string; dayIdx: number }> = [];
    let lastKey = "";
    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i] + "T00:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== lastKey) {
        months.push({
          year: d.getFullYear(),
          month: d.getMonth(),
          label: `${MONTH_NAMES_SHORT_ES[d.getMonth()]} ${d.getFullYear()}`,
          dayIdx: i,
        });
        lastKey = key;
      }
    }
    return months;
  }, [data, days]);

  // Determine which month is currently visible (based on scroll position)
  const [currentMonthKey, setCurrentMonthKey] = useState<string>("");

  const updateCurrentMonth = useCallback(() => {
    if (!scrollRef.current || availableMonths.length === 0) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const centerX = scrollLeft + scrollRef.current.clientWidth / 3;
    const dayAtCenter = Math.floor(centerX / DAY_WIDTH);
    // Find which month this day belongs to
    let found = availableMonths[0];
    for (const m of availableMonths) {
      if (m.dayIdx <= dayAtCenter) found = m;
      else break;
    }
    setCurrentMonthKey(`${found.year}-${found.month}`);
  }, [availableMonths]);

  // Scroll to today on mount
  useEffect(() => {
    if (!data || !scrollRef.current || days.length === 0) return;
    const todayIdx = dayIndex(data.today, days);
    if (todayIdx > 0) {
      const scrollTo = Math.max(0, (todayIdx - 4) * DAY_WIDTH);
      scrollRef.current.scrollLeft = scrollTo;
    }
    // Initialize current month indicator and scroll state
    setTimeout(() => {
      updateCurrentMonth();
      if (scrollRef.current) {
        setScrollState({
          scrollLeft: scrollRef.current.scrollLeft,
          viewportWidth: scrollRef.current.clientWidth,
        });
      }
    }, 50);
  }, [data, days]);

  // Sync vertical scroll between labels and grid + track current month + update minimap
  const handleGridScroll = useCallback(() => {
    if (scrollRef.current && labelsRef.current) {
      labelsRef.current.scrollTop = scrollRef.current.scrollTop;
    }
    updateCurrentMonth();
    if (scrollRef.current) {
      setScrollState({
        scrollLeft: scrollRef.current.scrollLeft,
        viewportWidth: scrollRef.current.clientWidth,
      });
    }
  }, [updateCurrentMonth]);

  // Scroll to a specific month
  const scrollToMonth = useCallback((year: number, month: number) => {
    if (!scrollRef.current) return;
    const target = availableMonths.find(m => m.year === year && m.month === month);
    if (target) {
      scrollRef.current.scrollTo({
        left: target.dayIdx * DAY_WIDTH,
        behavior: "smooth",
      });
    }
  }, [availableMonths]);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (!data || !scrollRef.current || days.length === 0) return;
    const todayIdx = dayIndex(data.today, days);
    if (todayIdx >= 0) {
      const scrollTo = Math.max(0, (todayIdx - 4) * DAY_WIDTH);
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  }, [data, days]);

  // Handle month selector change
  const handleMonthSelect = useCallback((value: string) => {
    const [yearStr, monthStr] = value.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    scrollToMonth(year, month);
    if (onMonthChange) {
      onMonthChange(year, month);
    }
  }, [scrollToMonth, onMonthChange]);

  // Handle mini-map scroll
  const handleMiniMapScroll = useCallback((targetScrollLeft: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
  }, []);

  // Tooltip handlers
  const handleBarMouseEnter = useCallback((e: React.MouseEvent, reservation: TimelineReservation) => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      reservation,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 250);
  }, []);

  const handleBarClick = useCallback((reservation: TimelineReservation) => {
    if (interactive && onReservationClick) {
      onReservationClick(reservation.id);
    }
  }, [interactive, onReservationClick]);

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-white dark:bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-center h-72">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <Calendar className="relative h-8 w-8 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Cargando timeline...</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (!data || filteredGroups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white dark:bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-center h-72">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Calendar className="h-10 w-10 opacity-40" />
            <span className="text-sm">No hay datos para mostrar</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Build month headers ────────────────────────────────────────────────────
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

  // Count total visible vehicles for height calculation
  let totalVisibleVehicles = 0;
  let totalCategoryHeaders = 0;
  for (const g of filteredGroups) {
    totalCategoryHeaders++;
    if (!collapsedCategories.has(g.category)) {
      totalVisibleVehicles += g.vehicles.length;
    }
  }
  const gridHeight = Math.min(
    (totalVisibleVehicles * ROW_HEIGHT) + (totalCategoryHeaders * CATEGORY_HEADER_HEIGHT) + 56,
    900
  );

  // Count in-service vehicles for the legend
  const inServiceCount = data.groups.reduce((acc, g) => acc + g.vehicles.filter(v => v.inService).length, 0);

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-gray-900/50 overflow-hidden shadow-sm">
      {/* ─── Top Controls Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-gray-50/80 dark:bg-gray-800/30 flex-wrap">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 bg-gray-200/60 dark:bg-gray-700/40 rounded-lg p-0.5">
          <ZoomIn className="h-3 w-3 text-muted-foreground ml-1.5 mr-0.5" />
          {(["1M", "3M", "6M"] as ZoomLevel[]).map(level => (
            <Button
              key={level}
              variant={zoomLevel === level ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-6 px-2.5 rounded-md text-[10px] font-bold tracking-wide transition-all",
                zoomLevel === level
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-gray-300/50 dark:hover:bg-gray-600/40"
              )}
              onClick={() => onZoomChange?.(level)}
            >
              {level}
            </Button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-border/60" />

        {/* Month selector */}
        <div className="flex items-center gap-1.5">
          <Select value={currentMonthKey} onValueChange={handleMonthSelect}>
            <SelectTrigger className="w-[130px] h-7 text-xs rounded-md border-border font-medium">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map(m => (
                <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 rounded-md text-xs font-medium"
            onClick={scrollToToday}
            title="Ir a hoy"
          >
            Hoy
          </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-border/60" />

        {/* Category filter */}
        {categories.length > 1 && onCategoryFilterChange && (
          <Select value={categoryFilter || "all"} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-[160px] h-7 text-xs rounded-md border-border">
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

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {Object.entries(data.statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-5 rounded-full"
                style={{ backgroundColor: color, opacity: status === "Completada" ? 0.5 : 0.9 }}
              />
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{status}</span>
            </div>
          ))}
          {/* In-service legend item */}
          {inServiceCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-5 rounded-full bg-amber-500/80 flex items-center justify-center">
                <Wrench className="h-2 w-2 text-white" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                En servicio ({inServiceCount})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Mini-map Overview Bar with Density Heatmap ──────────────────── */}
      <MiniMap
        days={days}
        groups={data.groups}
        statusColors={data.statusColors}
        today={data.today}
        scrollLeft={scrollState.scrollLeft}
        viewportWidth={scrollState.viewportWidth}
        totalWidth={totalWidth}
        onScrollTo={handleMiniMapScroll}
      />

      {/* ─── Timeline Grid ────────────────────────────────────────────────── */}
      <div className="flex" style={{ height: gridHeight }}>
        {/* ─── Left: Vehicle Labels (sticky) ──────────────────────────────── */}
        <div
          ref={labelsRef}
          className="flex-shrink-0 border-r border-border bg-gray-50/50 dark:bg-gray-800/20 overflow-hidden"
          style={{ width: LABEL_WIDTH }}
        >
          {/* Header spacer */}
          <div className="h-[56px] border-b border-border flex items-end px-3 pb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[1.5px] font-[var(--font-heading)]">
              Vehículo
            </span>
          </div>
          {/* Vehicle labels */}
          <div className="overflow-hidden">
            {filteredGroups.map(group => {
              const isCollapsed = collapsedCategories.has(group.category);
              const occupancy = calculateOccupancy(group, data.fromDate, data.toDate);
              return (
                <div key={group.category}>
                  {/* Category header - clickable to collapse */}
                  <div
                    className="flex items-center px-2 bg-blue-100/80 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800/40 cursor-pointer hover:bg-blue-200/80 dark:hover:bg-blue-900/40 transition-colors select-none"
                    style={{ height: CATEGORY_HEADER_HEIGHT }}
                    onClick={() => toggleCategory(group.category)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3 text-blue-600 dark:text-blue-300 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-blue-600 dark:text-blue-300 shrink-0" />
                    )}
                    <span className="text-[10px] font-bold text-blue-800 dark:text-blue-200 uppercase tracking-[0.5px] truncate ml-1">
                      {group.category}
                    </span>
                    <span
                      className={cn(
                        "ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                        occupancy >= 80
                          ? "bg-red-200/80 text-red-700 dark:bg-red-800/50 dark:text-red-300"
                          : occupancy >= 50
                          ? "bg-amber-200/80 text-amber-700 dark:bg-amber-800/50 dark:text-amber-300"
                          : "bg-blue-200/80 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300"
                      )}
                    >
                      {occupancy}%
                    </span>
                    <span className="text-[9px] bg-blue-200/60 dark:bg-blue-800/40 text-blue-600 dark:text-blue-400 font-medium px-1 py-0.5 rounded-full ml-1 shrink-0">
                      {group.vehicles.length}
                    </span>
                  </div>
                  {/* Vehicle rows (hidden when collapsed) */}
                  {!isCollapsed && group.vehicles.map((vehicle, vIdx) => (
                    <div
                      key={vehicle.plate}
                      className={cn(
                        "flex flex-col justify-center px-3 border-b border-border/50 transition-colors",
                        vehicle.inService
                          ? "bg-amber-50/80 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30"
                          : vehicle.isCollaborator
                          ? "bg-purple-50/60 dark:bg-purple-950/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30"
                          : vIdx % 2 === 0
                            ? "bg-white dark:bg-transparent hover:bg-gray-100/60 dark:hover:bg-gray-700/20"
                            : "bg-gray-50/30 dark:bg-gray-800/10 hover:bg-gray-100/60 dark:hover:bg-gray-700/20"
                      )}
                      style={{ height: ROW_HEIGHT }}
                      title={vehicle.inService ? `En servicio: ${vehicle.serviceNotes || "Sin detalles"}` : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {vehicle.model && (
                          <span className="text-[9px] text-muted-foreground truncate leading-tight">
                            {vehicle.model}
                          </span>
                        )}
                        {vehicle.inService && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 px-1 py-0.5 rounded leading-none whitespace-nowrap" title={vehicle.serviceNotes || "En servicio"}>
                            <Wrench className="h-2 w-2" />
                            Taller
                          </span>
                        )}
                        {vehicle.isCollaborator && !vehicle.inService && (
                          <span className="text-[8px] font-semibold bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 px-1 py-0.5 rounded leading-none whitespace-nowrap">
                            Colab.
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-[11px] font-mono font-semibold tracking-wide leading-tight",
                        vehicle.inService ? "text-amber-700 dark:text-amber-300" :
                        vehicle.isCollaborator ? "text-purple-700 dark:text-purple-300" : "text-foreground"
                      )}>
                        {vehicle.plate}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Right: Scrollable Timeline ─────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto timeline-scroll"
          onScroll={handleGridScroll}
          style={{
            /* Make scrollbar always visible */
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(156,163,175,0.5) transparent",
          }}
        >
          <div style={{ width: totalWidth, position: "relative", minHeight: "100%" }}>
            {/* ─── Date Header (sticky top) ─────────────────────────────────── */}
            <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-border" style={{ height: 56 }}>
              {/* Month row */}
              <div className="flex" style={{ height: 24 }}>
                {monthHeaders.map((mh, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/30"
                    style={{
                      width: mh.span * DAY_WIDTH,
                      position: "absolute",
                      left: mh.startIdx * DAY_WIDTH,
                      top: 0,
                      height: 24,
                    }}
                  >
                    {mh.label}
                  </div>
                ))}
              </div>
              {/* Day row */}
              <div className="flex" style={{ height: 32, marginTop: 24 }}>
                {days.map((day) => {
                  const d = new Date(day + "T00:00:00");
                  const dayOfWeek = d.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isToday = day === data.today;
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex flex-col items-center justify-center border-r border-border/30",
                        isWeekend && "bg-gray-100/60 dark:bg-gray-800/30",
                        isToday && "bg-emerald-50 dark:bg-emerald-950/30"
                      )}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      <span className={cn(
                        "text-[9px] font-semibold leading-none",
                        isToday ? "text-emerald-600 dark:text-emerald-400" :
                        isWeekend ? "text-rose-400 dark:text-rose-500" :
                        "text-muted-foreground"
                      )}>
                        {DAY_NAMES_ES[dayOfWeek]}
                      </span>
                      <span className={cn(
                        "text-[11px] font-bold leading-none mt-0.5",
                        isToday ? "text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-800/50 rounded-full w-5 h-5 flex items-center justify-center" :
                        isWeekend ? "text-rose-500/80 dark:text-rose-400/60" :
                        "text-foreground/80"
                      )}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Vehicle Rows with Bars ────────────────────────────────────── */}
            <div className="relative">
              {filteredGroups.map(group => {
                const isCollapsed = collapsedCategories.has(group.category);
                return (
                  <div key={group.category}>
                    {/* Category separator row */}
                    <div
                      className="bg-blue-50/50 dark:bg-blue-950/10 border-b border-blue-100 dark:border-blue-900/20"
                      style={{ height: CATEGORY_HEADER_HEIGHT }}
                    />
                    {/* Vehicle rows (hidden when collapsed) */}
                    {!isCollapsed && group.vehicles.map((vehicle, vIdx) => (
                      <div
                        key={vehicle.plate}
                        className={cn(
                          "relative border-b border-border/30",
                          vehicle.inService
                            ? "bg-amber-50/40 dark:bg-amber-950/10"
                            : vIdx % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-gray-50/20 dark:bg-gray-800/5"
                        )}
                        style={{
                          height: ROW_HEIGHT,
                          backgroundImage: vehicle.inService
                            ? "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(245,158,11,0.06) 8px, rgba(245,158,11,0.06) 16px)"
                            : undefined,
                        }}
                      >
                        {/* Weekend column stripes */}
                        {days.map((day, i) => {
                          const d = new Date(day + "T00:00:00");
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          if (!isWeekend) return null;
                          return (
                            <div
                              key={day}
                              className="absolute top-0 bottom-0 bg-gray-100/40 dark:bg-gray-800/20"
                              style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                            />
                          );
                        })}

                        {/* Today marker line */}
                        {todayIdx >= 0 && (
                          <div
                            className="absolute top-0 bottom-0 z-[5]"
                            style={{ left: todayIdx * DAY_WIDTH + DAY_WIDTH / 2 - 1, width: 2 }}
                          >
                            <div className="w-full h-full bg-emerald-400/50 dark:bg-emerald-500/40" />
                          </div>
                        )}

                        {/* Reservation bars */}
                        {vehicle.reservations.map(reservation => {
                          const rawStartIdx = dayIndex(reservation.startDate, days);
                          const rawEndIdx = dayIndex(reservation.endDate, days);
                          const startIdx = rawStartIdx === -1 ? 0 : Math.max(0, rawStartIdx);
                          const endIdx = rawEndIdx === -1 ? days.length - 1 : Math.min(days.length - 1, rawEndIdx);
                          if (startIdx > days.length - 1 || endIdx < 0) return null;
                          const left = startIdx * DAY_WIDTH + 2;
                          const width = Math.max((endIdx - startIdx + 1) * DAY_WIDTH - 4, 10);
                          const isPast = reservation.status === "Completada";
                          const isCancelled = reservation.status === "Cancelada";
                          const overflowsRight = rawEndIdx === -1;
                          const overflowsLeft = rawStartIdx === -1;

                          return (
                            <div
                              key={reservation.id}
                              className={cn(
                                "absolute top-[6px] z-[3] transition-all duration-150",
                                overflowsRight ? "rounded-l-full rounded-r-none" : overflowsLeft ? "rounded-r-full rounded-l-none" : "rounded-full",
                                interactive && "cursor-pointer hover:brightness-110 hover:scale-y-110 hover:shadow-lg",
                                isCancelled && "opacity-70"
                              )}
                              style={{
                                left,
                                width,
                                height: ROW_HEIGHT - 12,
                                backgroundColor: reservation.color,
                                opacity: isPast ? 0.45 : isCancelled ? 0.6 : 0.88,
                                backgroundImage: isCancelled
                                  ? "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)"
                                  : undefined,
                                boxShadow: !isPast && !isCancelled
                                  ? `0 1px 3px ${reservation.color}40`
                                  : undefined,
                              }}
                              onMouseEnter={(e) => handleBarMouseEnter(e, reservation)}
                              onMouseLeave={handleBarMouseLeave}
                              onClick={() => handleBarClick(reservation)}
                            >
                              {/* $ icon for paid reservations */}
                              {reservation.paid && reservation.paid !== "No" && reservation.paid !== "no" && width > 28 && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[10px] font-black text-white/90 drop-shadow-sm">$</span>
                                </div>
                              )}
                              {/* Arrow indicator for bars extending beyond visible range */}
                              {overflowsRight && (
                                <div className="absolute right-0 top-0 bottom-0 flex items-center pr-0.5">
                                  <svg width="8" height="12" viewBox="0 0 8 12" className="text-white/90 drop-shadow-sm">
                                    <path d="M1 1 L6 6 L1 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}
                              {overflowsLeft && (
                                <div className="absolute left-0 top-0 bottom-0 flex items-center pl-0.5">
                                  <svg width="8" height="12" viewBox="0 0 8 12" className="text-white/90 drop-shadow-sm">
                                    <path d="M7 1 L2 6 L7 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Enhanced Tooltip ─────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 360),
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-border/60 overflow-hidden min-w-[300px] max-w-[380px]">
            {/* Tooltip header */}
            <div className="px-4 py-3 bg-gray-50/80 dark:bg-zinc-700/30 border-b border-border/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-sm font-bold text-foreground truncate">
                      {tooltip.reservation.clientName || "Sin cliente"}
                    </p>
                  </div>
                  {interactive && tooltip.reservation.clientPhone && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {tooltip.reservation.clientPhone}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {tooltip.reservation.externalId && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        #{tooltip.reservation.externalId}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: tooltip.reservation.color }}
                    >
                      {tooltip.reservation.status}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs text-foreground font-semibold">
                    <Car className="h-3 w-3 text-muted-foreground" />
                    {tooltip.reservation.vehiclePlate}
                  </div>
                  {tooltip.reservation.model && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                      {tooltip.reservation.model}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tooltip body */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-1.5">
                  <span className="text-emerald-500 text-sm font-bold mt-px">→</span>
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">
                      {formatDateShort(tooltip.reservation.startDate)}
                    </p>
                    {tooltip.reservation.pickupLocation && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                          {tooltip.reservation.pickupLocation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-red-400 text-sm font-bold mt-px">←</span>
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">
                      {formatDateShort(tooltip.reservation.endDate)}
                    </p>
                    {tooltip.reservation.dropoffLocation && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                          {tooltip.reservation.dropoffLocation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">
                    {tooltip.reservation.durationDays} día{tooltip.reservation.durationDays !== 1 ? "s" : ""}
                  </span>
                </div>
                {tooltip.reservation.paid && tooltip.reservation.paid !== "No" && tooltip.reservation.paid !== "no" && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CreditCard className="h-3 w-3" />
                    Pagado
                  </div>
                )}
                {tooltip.reservation.origin && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ExternalLink className="h-2.5 w-2.5" />
                    <span className="font-medium">{tooltip.reservation.origin}</span>
                  </div>
                )}
              </div>

              {interactive && (
                <div className="pt-1 border-t border-border/20">
                  <p className="text-[9px] text-muted-foreground/60 text-center italic">
                    Clic para ver detalle de reserva
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
