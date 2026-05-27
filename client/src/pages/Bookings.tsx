/**
 * Bookings — Listado de reservas desde Rently.
 *
 * Muestra las reservas reales del sistema Rently con filtros, estados,
 * y acciones rápidas. Se siente como si el usuario estuviera usando Rently
 * directamente desde PlanMint.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { format, parseISO, isToday, isTomorrow, isPast, isFuture, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  Search,
  RefreshCw,
  CalendarIcon,
  Car,
  User,
  MapPin,
  Euro,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ExternalLink,
  Plus,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiInvoke } from "@/lib/apiClient";
import { useIntegrationFlags } from "@/hooks/useIntegrationFlags";
import { CreateRentlyBookingDialog } from "@/components/reservations/CreateRentlyBookingDialog";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RentlyBooking {
  Id: number;
  Code?: string;
  StatusId?: number;
  StatusName?: string;
  StatusColor?: string;
  FromDate?: string;
  ToDate?: string;
  CustomerFirstname?: string;
  CustomerLastname?: string;
  CustomerEmail?: string;
  CustomerPhone?: string;
  CustomerId?: number;
  CarPlate?: string;
  CarBrand?: string;
  CarModel?: string;
  CategoryName?: string;
  DeliveryPlaceName?: string;
  ReturnPlaceName?: string;
  TotalPrice?: number;
  Balance?: number;
  Currency?: string;
  CreatedDate?: string;
  IsQuotation?: boolean;
  Notes?: string;
  // Additional fields from Rently API
  Firstname?: string;
  Lastname?: string;
  Email?: string;
  Phone?: string;
  Plate?: string;
  Brand?: string;
  Model?: string;
  Price?: number;
  Status?: string;
  StatusCode?: number;
  DeliveryPlace?: string | { Name?: string; BranchOfficeName?: string; Address?: string; [k: string]: unknown };
  ReturnPlace?: string | { Name?: string; BranchOfficeName?: string; Address?: string; [k: string]: unknown };
  Category?: string | { Name?: string; [k: string]: unknown };
  Source?: string | { Name?: string; [k: string]: unknown };
}

/** Safely extract a display string from a Rently field that may be a string or an object */
function safeStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Try common Rently name fields
    if (typeof obj.Name === "string" && obj.Name) return obj.Name;
    if (typeof obj.BranchOfficeName === "string" && obj.BranchOfficeName) return obj.BranchOfficeName;
    if (typeof obj.Address === "string" && obj.Address) return obj.Address;
    if (typeof obj.City === "string" && obj.City) return obj.City;
    // Fallback: first string value
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v) return v;
    }
  }
  return "";
}

type DatePreset = "today" | "tomorrow" | "week" | "month" | "all" | "custom";

// ─── Status mapping ─────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  1: { label: "Pendiente", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  2: { label: "Confirmada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
  3: { label: "En curso", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: Car },
  4: { label: "Completada", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300", icon: CheckCircle2 },
  5: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  6: { label: "No-show", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: AlertCircle },
};

function getStatusInfo(booking: RentlyBooking) {
  const statusId = booking.StatusId ?? booking.StatusCode ?? 0;
  const statusName = booking.StatusName ?? booking.Status ?? "Desconocido";
  const mapped = STATUS_MAP[statusId];
  if (mapped) return mapped;
  return { label: statusName, color: "bg-gray-100 text-gray-700", icon: FileText };
}

function getCustomerName(b: RentlyBooking): string {
  const first = safeStr(b.CustomerFirstname) || safeStr(b.Firstname);
  const last = safeStr(b.CustomerLastname) || safeStr(b.Lastname);
  return `${first} ${last}`.trim() || "Sin cliente";
}

function getCarInfo(b: RentlyBooking): string {
  const brand = safeStr(b.CarBrand) || safeStr(b.Brand);
  const model = safeStr(b.CarModel) || safeStr(b.Model);
  const plate = safeStr(b.CarPlate) || safeStr(b.Plate);
  const carName = `${brand} ${model}`.trim();
  if (carName && plate) return `${carName} (${plate})`;
  if (carName) return carName;
  if (plate) return plate;
  return "Sin asignar";
}

function getPrice(b: RentlyBooking): number | null {
  return b.TotalPrice ?? b.Price ?? null;
}

function getCurrency(b: RentlyBooking): string {
  return b.Currency || "EUR";
}

function formatPrice(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return format(parseISO(dateStr), "dd MMM yyyy", { locale: es });
  } catch {
    // Try other formats
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  }
}

function formatDateTimeFull(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Bookings() {
  const { hasRently } = useIntegrationFlags();

  // Data
  const [bookings, setBookings] = useState<RentlyBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // ─── Fetch bookings from Rently ────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    if (!hasRently) return;

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {};

      // Date filters
      if (datePreset === "today") {
        params.fromDate = format(new Date(), "yyyy-MM-dd");
        params.toDate = format(new Date(), "yyyy-MM-dd");
      } else if (datePreset === "tomorrow") {
        const tomorrow = addDays(new Date(), 1);
        params.fromDate = format(tomorrow, "yyyy-MM-dd");
        params.toDate = format(tomorrow, "yyyy-MM-dd");
      } else if (datePreset === "week") {
        params.fromDate = format(subDays(new Date(), 1), "yyyy-MM-dd");
        params.toDate = format(addDays(new Date(), 7), "yyyy-MM-dd");
      } else if (datePreset === "month") {
        params.fromDate = format(subDays(new Date(), 1), "yyyy-MM-dd");
        params.toDate = format(addDays(new Date(), 30), "yyyy-MM-dd");
      } else if (datePreset === "custom" && customDateRange?.from) {
        params.fromDate = format(customDateRange.from, "yyyy-MM-dd");
        if (customDateRange.to) {
          params.toDate = format(customDateRange.to, "yyyy-MM-dd");
        }
      }

      // Search
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const result = await apiInvoke<{ success: boolean; data: RentlyBooking[] | Record<string, RentlyBooking[]> }>(
        "rently-hub",
        {
          body: {
            action: "query",
            domain: "bookings",
            method: "list",
            params,
          },
        }
      );

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // The API may return an array or an object with arrays
      let bookingsList: RentlyBooking[] = [];
      const rawData = result.data?.data;

      if (Array.isArray(rawData)) {
        bookingsList = rawData;
      } else if (rawData && typeof rawData === "object") {
        // Some Rently APIs return { Items: [...] } or similar structures
        const values = Object.values(rawData);
        for (const val of values) {
          if (Array.isArray(val)) {
            bookingsList = [...bookingsList, ...val];
          }
        }
      }

      // Sort by date descending (newest first)
      bookingsList.sort((a, b) => {
        const dateA = a.FromDate || a.CreatedDate || "";
        const dateB = b.FromDate || b.CreatedDate || "";
        return dateB.localeCompare(dateA);
      });

      setBookings(bookingsList);
      setLastRefresh(new Date());
      setPage(1);
    } catch (err: any) {
      setError(err?.message || "Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  }, [hasRently, datePreset, customDateRange, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ─── Filtered & paginated data ─────────────────────────────────────────

  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];

    // Status filter
    if (statusFilter !== "all") {
      const statusId = parseInt(statusFilter, 10);
      filtered = filtered.filter((b) => (b.StatusId ?? b.StatusCode) === statusId);
    }

    // Text search (client-side for already loaded data)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((b) => {
        const name = getCustomerName(b).toLowerCase();
        const car = getCarInfo(b).toLowerCase();
        const code = (b.Code || String(b.Id)).toLowerCase();
        return name.includes(q) || car.includes(q) || code.includes(q);
      });
    }

    return filtered;
  }, [bookings, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = filteredBookings.slice((page - 1) * pageSize, page * pageSize);

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: bookings.length };
    for (const b of bookings) {
      const sid = String(b.StatusId ?? b.StatusCode ?? 0);
      counts[sid] = (counts[sid] || 0) + 1;
    }
    return counts;
  }, [bookings]);

  // ─── Render ────────────────────────────────────────────────────────────

  if (!hasRently) {
    return (
      <AppLayout title="Reservas" fullWidth>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Rently no configurado</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Para ver las reservas necesitas tener la integración con Rently configurada.
            Contacta con el administrador para activarla.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reservas" fullWidth>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0">
          <PageHeader
            title="Reservas"
            description="Gestión de reservas desde Rently"
            actions={
              <div className="flex items-center gap-2">
                <CreateRentlyBookingDialog />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchBookings}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  Actualizar
                </Button>
              </div>
            }
          />
        </div>

        {/* Filters bar */}
        <div className="shrink-0 mt-5 space-y-3">
          {/* Date presets + search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date preset pills */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {([
                { key: "all", label: "Todas" },
                { key: "today", label: "Hoy" },
                { key: "tomorrow", label: "Mañana" },
                { key: "week", label: "7 días" },
                { key: "month", label: "30 días" },
              ] as { key: DatePreset; label: string }[]).map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setDatePreset(preset.key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    datePreset === preset.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}

              {/* Custom date range */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                      datePreset === "custom"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {datePreset === "custom" && customDateRange?.from
                      ? `${format(customDateRange.from, "dd/MM")}${customDateRange.to ? ` - ${format(customDateRange.to, "dd/MM")}` : ""}`
                      : "Rango"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={(range) => {
                      setCustomDateRange(range);
                      setDatePreset("custom");
                    }}
                    locale={es}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Todos ({statusCounts.all || 0})
                </SelectItem>
                {Object.entries(STATUS_MAP).map(([id, info]) => (
                  <SelectItem key={id} value={id}>
                    {info.label} ({statusCounts[id] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, vehículo o código..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Last refresh indicator */}
            {lastRefresh && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Actualizado: {format(lastRefresh, "HH:mm:ss")}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 mt-4">
          {loading && bookings.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
              <h3 className="text-sm font-semibold text-foreground">Error al cargar reservas</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchBookings} className="mt-4 gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-semibold text-foreground">Sin reservas</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {bookings.length > 0
                  ? "No hay reservas que coincidan con los filtros aplicados."
                  : "No se encontraron reservas en Rently para el período seleccionado."}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[90px] text-[11px] font-semibold uppercase tracking-wider">Código</TableHead>
                    <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider">Estado</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Vehículo</TableHead>
                    <TableHead className="w-[110px] text-[11px] font-semibold uppercase tracking-wider">Recogida</TableHead>
                    <TableHead className="w-[110px] text-[11px] font-semibold uppercase tracking-wider">Devolución</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Lugar Recogida</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Lugar Devolución</TableHead>
                    <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider text-right">Precio</TableHead>
                    <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider text-right">Saldo</TableHead>
                    <TableHead className="w-[90px] text-[11px] font-semibold uppercase tracking-wider">Origen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBookings.map((booking) => {
                    const status = getStatusInfo(booking);
                    const StatusIcon = status.icon;
                    const price = getPrice(booking);
                    const currency = getCurrency(booking);

                    return (
                      <TableRow
                        key={booking.Id}
                        className="group hover:bg-muted/20 transition-colors cursor-default"
                      >
                        {/* Code */}
                        <TableCell className="font-mono text-xs font-medium">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-primary hover:underline cursor-pointer">
                                  {booking.Code || `#${booking.Id}`}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>ID: {booking.Id}</p>
                                {booking.Code && <p>Código: {booking.Code}</p>}
                                {booking.IsQuotation && <p className="text-amber-500">Cotización</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {booking.IsQuotation && (
                            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">
                              COT
                            </Badge>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] font-medium gap-1 px-2 py-0.5", status.color)}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>

                        {/* Customer */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium truncate max-w-[150px]">
                              {getCustomerName(booking)}
                            </span>
                          </div>
                          {(safeStr(booking.CustomerEmail) || safeStr(booking.Email)) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">
                              {safeStr(booking.CustomerEmail) || safeStr(booking.Email)}
                            </p>
                          )}
                        </TableCell>

                        {/* Vehicle */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate max-w-[140px]">
                              {getCarInfo(booking)}
                            </span>
                          </div>
                          {(safeStr(booking.CategoryName) || safeStr(booking.Category)) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {safeStr(booking.CategoryName) || safeStr(booking.Category)}
                            </p>
                          )}
                        </TableCell>

                        {/* From Date */}
                        <TableCell className="text-xs">
                          {formatDateTimeFull(booking.FromDate)}
                        </TableCell>

                        {/* To Date */}
                        <TableCell className="text-xs">
                          {formatDateTimeFull(booking.ToDate)}
                        </TableCell>

                        {/* Delivery Place */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate max-w-[120px]">
                              {safeStr(booking.DeliveryPlaceName) || safeStr(booking.DeliveryPlace) || "-"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Return Place */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate max-w-[120px]">
                              {safeStr(booking.ReturnPlaceName) || safeStr(booking.ReturnPlace) || "-"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Price */}
                        <TableCell className="text-right">
                          {price != null ? (
                            <span className="text-xs font-semibold">
                              {formatPrice(price, currency)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Balance */}
                        <TableCell className="text-right">
                          {booking.Balance != null ? (
                            <span
                              className={cn(
                                "text-xs font-medium",
                                booking.Balance > 0 ? "text-amber-600" : "text-emerald-600"
                              )}
                            >
                              {formatPrice(booking.Balance, currency)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          {safeStr(booking.Source) ? (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {safeStr(booking.Source)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>

        {/* Pagination */}
        {filteredBookings.length > 0 && (
          <div className="shrink-0 flex items-center justify-between py-3 px-1 border-t mt-2">
            <p className="text-xs text-muted-foreground">
              {filteredBookings.length} reserva{filteredBookings.length !== 1 ? "s" : ""}
              {statusFilter !== "all" && ` (filtrado de ${bookings.length})`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Pág. {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
