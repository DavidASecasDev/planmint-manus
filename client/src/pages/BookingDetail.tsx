/**
 * BookingDetail — Full-page Rently booking detail.
 *
 * Layout inspired by Rently's reservation screen but adapted to PlanMint's
 * corporate identity (navy/gold, Montserrat headings, Barlow body, warm cards).
 *
 * REAL Rently API field mapping verified via debug endpoint:
 *   Customer: { Firstname, Lastname, Name, EmailAddress, CellPhone, DocumentId, DocumentTypeId }
 *   Car: { Id: "plate", Model: { Description, ImagePath, Brand: { Name } } }
 *   CurrentStatus: number (0-5)
 *   DeliveryPlace/ReturnPlace: { Name, Address, City, Country, Latitude, Longitude }
 *   PriceItems: [{ Description, Price, IsBookingPrice, UnitPrice, Quantity }]
 *   Additionals: [{ Additional: { Name, Description, ImagePath }, Quantity, Price }]
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRentlyHub } from "@/lib/rently/useRentlyHub";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Bell, Calendar, Car, Clock, Copy, CreditCard, FileText,
  Fuel, Gauge, Globe, IdCard, MapPin, MoreVertical, Navigation, Package,
  Pencil, Phone, RefreshCw, ScrollText, User, Users, CheckCircle2,
  XCircle, AlertCircle, AlertTriangle, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { EditBookingDialog } from "@/components/reservations/EditBookingDialog";
import { BookingPaymentsDialog } from "@/components/reservations/BookingPaymentsDialog";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Safely extract a string from any value (handles Rently nested objects) */
function safeStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.Name === "string" && obj.Name) return obj.Name;
    if (typeof obj.Description === "string" && obj.Description) return obj.Description;
    if (typeof obj.BranchOfficeName === "string" && obj.BranchOfficeName) return obj.BranchOfficeName;
    if (typeof obj.Address === "string" && obj.Address) return obj.Address;
    if (typeof obj.City === "string" && obj.City) return obj.City;
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v) return v;
    }
  }
  return "";
}

function getPlaceAddress(place: unknown): string {
  if (!place || typeof place !== "object") return "";
  const obj = place as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof obj.Address === "string" && obj.Address) parts.push(obj.Address);
  if (typeof obj.City === "string" && obj.City) parts.push(obj.City);
  if (typeof obj.Country === "string" && obj.Country) parts.push(obj.Country);
  return parts.join(", ");
}

function getPlaceCoords(place: unknown): { lat: number; lng: number } | null {
  if (!place || typeof place !== "object") return null;
  const obj = place as Record<string, unknown>;
  if (typeof obj.Latitude === "number" && typeof obj.Longitude === "number" && obj.Latitude !== 0) {
    return { lat: obj.Latitude, lng: obj.Longitude };
  }
  return null;
}

function fmtDate(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return "\u2014";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy hh:mm a", { locale: es });
  } catch {
    return String(dateStr);
  }
}

function fmtCurrency(amount: unknown, currency?: string): string {
  if (amount == null || amount === "") return "\u2014";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "\u2014";
  const cur = currency || "EUR";
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur }).format(num);
  } catch {
    return `${num.toFixed(2)} ${cur}`;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copiado al portapapeles"));
}

// ─── Status mapping (CurrentStatus is a number 0-5) ────────────────────────

const STATUS_MAP: Record<number, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  0: { label: "Borrador", color: "bg-gray-100 text-gray-700 border-gray-300", icon: FileText },
  1: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  2: { label: "Confirmada", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  3: { label: "Entregado", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Car },
  4: { label: "Completada", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: CheckCircle2 },
  5: { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
  6: { label: "No Show", color: "bg-orange-100 text-orange-800 border-orange-300", icon: AlertCircle },
};

function getStatusInfo(statusNum: unknown) {
  const id = typeof statusNum === "number" ? statusNum : 0;
  return STATUS_MAP[id] ?? { label: `Estado ${id}`, color: "bg-gray-100 text-gray-700 border-gray-300", icon: FileText };
}

// ─── Small UI components ────────────────────────────────────────────────────

function CopyableField({ value, href, icon: Icon, label, className }: {
  value: string; href?: string; icon?: typeof Mail; label?: string; className?: string;
}) {
  if (!value) return null;
  return (
    <div className={cn("flex items-center gap-2 group py-1", className)}>
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0 flex-1">
        {label && <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>}
        {href ? (
          <a href={href} className="text-sm text-primary hover:underline truncate block" target="_blank" rel="noopener noreferrer">{value}</a>
        ) : (
          <span className="text-sm truncate block">{value}</span>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); copyToClipboard(value); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded shrink-0"
      >
        <Copy className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

function MapsLink({ address, coords }: { address?: string; coords?: { lat: number; lng: number } | null }) {
  const url = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
    : address ? `https://www.google.com/maps/search/${encodeURIComponent(address)}` : null;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
      <Navigation className="h-3 w-3" />Ver mapa
    </a>
  );
}

function BookingDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { query, loading: hubLoading } = useRentlyHub();

  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [drivers, setDrivers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await query<Record<string, unknown>>("bookings", "get", { id });
      if (result.success && result.data) {
        setBooking(result.data);
      } else {
        setError(result.error || "No se pudo cargar la reserva");
      }
      // Try to load drivers (optional)
      try {
        const driversResult = await query<Record<string, unknown>[]>("bookings", "drivers", { id });
        if (driversResult.success && Array.isArray(driversResult.data)) setDrivers(driversResult.data);
      } catch { /* drivers optional */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [id, query]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  // ─── Loading / Error states ───────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-[1400px] mx-auto">
          <BookingDetailSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (error || !booking) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <AlertCircle className="h-12 w-12 text-destructive/60" />
            <h2 className="text-lg font-semibold font-heading">Error al cargar la reserva</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center">{error || "No se encontr\u00f3 la reserva"}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/bookings")}>
                <ArrowLeft className="h-4 w-4 mr-2" />Volver
              </Button>
              <Button onClick={fetchBooking}>
                <RefreshCw className="h-4 w-4 mr-2" />Reintentar
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Extract data from REAL Rently API fields ─────────────────────────
  const b = booking;

  // Status
  const status = getStatusInfo(b.CurrentStatus);
  const StatusIcon = status.icon;

  // Basic info
  const bookingId = String(b.Id ?? id);
  const code = safeStr(b.Code) || bookingId;
  const totalDays = (b.TotalDays as number) ?? 0;
  const totalDaysStr = safeStr(b.TotalDaysString) || `${totalDays} D\u00edas`;
  const unlimitedKm = b.IlimitedKm === true;

  // Customer (nested object)
  const cust = (b.Customer && typeof b.Customer === "object") ? b.Customer as Record<string, unknown> : null;
  const customerName = cust
    ? (`${safeStr(cust.Firstname)} ${safeStr(cust.Lastname)}`.trim() || safeStr(cust.Name) || "Sin cliente")
    : "Sin cliente";
  const customerEmail = cust ? (safeStr(cust.EmailAddress) || safeStr(cust.Email)) : "";
  const customerPhone = cust ? (safeStr(cust.CellPhone) || safeStr(cust.Phone)) : "";
  const customerDocId = cust ? safeStr(cust.DocumentId) : "";
  const customerDocTypeId = cust ? (cust.DocumentTypeId as number) : null;
  const docTypeLabel = customerDocTypeId === 1 ? "DNI" : customerDocTypeId === 2 ? "Pasaporte" : customerDocTypeId === 3 ? "NIE" : customerDocTypeId === 4 ? "CIF" : "";
  const customerDocDisplay = [docTypeLabel, customerDocId].filter(Boolean).join(" ");
  const isCustomerBlocked = b.IsCustomerBlocked === true;

  // Car (nested object)
  const car = (b.Car && typeof b.Car === "object") ? b.Car as Record<string, unknown> : null;
  const plate = car ? safeStr(car.Id) : "";
  const carModelObj = (car?.Model && typeof car.Model === "object") ? car.Model as Record<string, unknown> : null;
  const carModelName = carModelObj ? safeStr(carModelObj.Description) : (safeStr(b.Model));
  const carBrandObj = (carModelObj?.Brand && typeof carModelObj.Brand === "object") ? carModelObj.Brand as Record<string, unknown> : null;
  const carBrand = carBrandObj ? safeStr(carBrandObj.Name) : "";
  const carImageUrl = carModelObj ? safeStr(carModelObj.ImagePath) : "";
  const carFullName = [carBrand, carModelName].filter(Boolean).join(" ") || "Sin asignar";

  // Category
  const catObj = (b.Category && typeof b.Category === "object") ? b.Category as Record<string, unknown> : null;
  const categoryName = catObj ? safeStr(catObj.Name) : "";

  // Dates
  const fromDate = safeStr(b.FromDate);
  const toDate = safeStr(b.ToDate);

  // Places
  const deliveryPlaceObj = b.DeliveryPlace;
  const returnPlaceObj = b.ReturnPlace;
  const deliveryPlaceName = safeStr(deliveryPlaceObj);
  const returnPlaceName = safeStr(returnPlaceObj);
  const deliveryAddress = getPlaceAddress(deliveryPlaceObj);
  const returnAddress = getPlaceAddress(returnPlaceObj);
  const deliveryCoords = getPlaceCoords(deliveryPlaceObj);
  const returnCoords = getPlaceCoords(returnPlaceObj);

  // Pricing
  const currency = safeStr(b.Currency) || "EUR";
  const totalPrice = (b.Price as number) ?? null;
  const customerPrice = (b.CustomerPrice as number) ?? null;
  const dailyRate = (b.DailyRate as number) ?? null;
  const avgDayPrice = (b.AverageDayPrice as number) ?? null;
  const balance = (b.Balance as number) ?? null;
  const payedByCustomer = (b.PayedByCustomer as number) ?? 0;
  const payedByAgency = (b.PayedByAgency as number) ?? 0;
  const totalPaid = payedByCustomer + payedByAgency;

  // Franchise / Deposit
  const franchise = (b.Franchise as number) ?? null;
  const franchiseDamage = (b.FranchiseDamage as number) ?? null;
  const franchiseRollover = (b.FranchiseRollover as number) ?? null;
  const franchiseTheft = (b.FranchiseTheft as number) ?? null;
  const franchiseHail = (b.FranchiseHail as number) ?? null;

  // Origin
  const originObj = (b.Origin && typeof b.Origin === "object") ? b.Origin as Record<string, unknown> : null;
  const originName = originObj ? safeStr(originObj.Name) : "";

  // Agency
  const agencyObj = (b.Agency && typeof b.Agency === "object") ? b.Agency as Record<string, unknown> : null;
  const agencyName = agencyObj ? safeStr(agencyObj.Name) : "";

  // Creation date
  const creationDate = safeStr(b.CreationDate);

  // PriceItems breakdown
  const priceItems = Array.isArray(b.PriceItems) ? b.PriceItems as Record<string, unknown>[] : [];

  // Additionals (extras)
  const additionals = Array.isArray(b.Additionals) ? b.Additionals as Record<string, unknown>[] : [];

  // Delivery/Return details
  const deliveryFuel = b.DeliveryFuelLevel as number | null ?? null;
  const returnFuel = b.ReturnFuelLevel as number | null ?? null;
  const deliveryKms = b.DeliveryKms as number | null ?? null;
  const returnKms = b.ReturnKms as number | null ?? null;

  // Notes
  const notes = safeStr(b.Notes);

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <AppLayout title={`Reserva ${code}`} fullWidth>
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col gap-3">
          {/* Row 1: Back + Title + Status + Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 mt-0.5 rounded-lg hover:bg-muted" onClick={() => navigate("/bookings")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold font-heading tracking-tight text-primary">
                    Reserva #{code}
                  </h1>
                  <span className="text-base text-muted-foreground font-medium">
                    ({totalDaysStr}){unlimitedKm ? " - Km Ilimitados" : ""}
                  </span>
                  <Badge className={cn("border text-xs font-semibold px-2.5 py-0.5", status.color)}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {creationDate ? `Creada el ${fmtDate(creationDate)}` : ""}
                  {originName ? ` \u00b7 Origen: ${originName}` : ""}
                  {agencyName ? ` \u00b7 Agencia: ${agencyName}` : ""}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />Editar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setPaymentsOpen(true)}>
                  <CreditCard className="h-3.5 w-3.5" />Pagos
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs hidden lg:flex" onClick={() => toast.info("Generar contrato: pr\u00f3ximamente")}>
                  <ScrollText className="h-3.5 w-3.5" />Contrato
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs hidden lg:flex" onClick={() => toast.info("Enviar notificaci\u00f3n: pr\u00f3ximamente")}>
                  <Bell className="h-3.5 w-3.5" />Notificar
                </Button>
              </div>

              {/* Overflow menu for smaller screens */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 lg:hidden">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)} className="sm:hidden">
                    <Pencil className="h-4 w-4 mr-2" />Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPaymentsOpen(true)} className="sm:hidden">
                    <CreditCard className="h-4 w-4 mr-2" />Pagos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Generar contrato: pr\u00f3ximamente")}>
                    <ScrollText className="h-4 w-4 mr-2" />Generar Contrato
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Enviar notificaci\u00f3n: pr\u00f3ximamente")}>
                    <Bell className="h-4 w-4 mr-2" />Enviar Notificaci\u00f3n
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchBooking} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ CUSTOMER BALANCE ALERT ═══ */}
        {balance != null && balance < 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Saldo pendiente de <strong>{fmtCurrency(Math.abs(balance), currency)}</strong>
            </p>
          </div>
        )}

        {isCustomerBlocked && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>Cliente bloqueado</strong> en el sistema
            </p>
          </div>
        )}

        {/* ═══ TOP ROW: Vehicle + Customer ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-primary/5 shrink-0">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {plate && (
                      <span className="font-mono font-bold text-sm bg-muted px-2 py-0.5 rounded">{plate}</span>
                    )}
                    <span className="text-sm font-medium">{carFullName}</span>
                  </div>
                  {categoryName && (
                    <p className="text-xs text-muted-foreground mt-1">{categoryName}</p>
                  )}
                  {carImageUrl && (
                    <img
                      src={carImageUrl}
                      alt={carFullName}
                      className="mt-3 h-20 object-contain rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-primary/5 shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold">{customerName}</p>
                  {customerDocDisplay && (
                    <CopyableField value={customerDocDisplay} icon={IdCard} />
                  )}
                  {customerEmail && (
                    <CopyableField value={customerEmail} href={`mailto:${customerEmail}`} icon={Mail} />
                  )}
                  {customerPhone && (
                    <CopyableField value={customerPhone} href={`tel:${customerPhone}`} icon={Phone} />
                  )}
                  {!customerDocDisplay && !customerEmail && !customerPhone && (
                    <p className="text-xs text-muted-foreground">Sin datos de contacto</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ MAIN: Tabs + Pricing Sidebar ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">

          {/* LEFT: Tabs */}
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-2 h-auto gap-0">
                <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-xs font-medium">
                  Detalles
                </TabsTrigger>
                <TabsTrigger value="additionals" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-xs font-medium">
                  Adicionales
                </TabsTrigger>
                <TabsTrigger value="drivers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 text-xs font-medium">
                  Conductores
                </TabsTrigger>
              </TabsList>

              {/* ── Details Tab ── */}
              <TabsContent value="details" className="p-5 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Delivery */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <Calendar className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Entrega</p>
                        <p className="text-sm font-medium">{fmtDate(fromDate)}</p>
                      </div>
                    </div>
                    <div className="ml-9 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm">{deliveryPlaceName || "\u2014"}</p>
                          {deliveryAddress && deliveryAddress !== deliveryPlaceName && (
                            <p className="text-xs text-muted-foreground mt-0.5">{deliveryAddress}</p>
                          )}
                          <MapsLink address={deliveryAddress || deliveryPlaceName} coords={deliveryCoords} />
                        </div>
                      </div>
                      {deliveryFuel != null && (
                        <div className="flex items-center gap-2">
                          <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{deliveryFuel}/8</span>
                        </div>
                      )}
                      {deliveryKms != null && (
                        <div className="flex items-center gap-2">
                          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{Number(deliveryKms).toLocaleString("es-ES")} km</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Return */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Devoluci\u00f3n</p>
                        <p className="text-sm font-medium">{fmtDate(toDate)}</p>
                      </div>
                    </div>
                    <div className="ml-9 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm">{returnPlaceName || "\u2014"}</p>
                          {returnAddress && returnAddress !== returnPlaceName && (
                            <p className="text-xs text-muted-foreground mt-0.5">{returnAddress}</p>
                          )}
                          <MapsLink address={returnAddress || returnPlaceName} coords={returnCoords} />
                        </div>
                      </div>
                      {returnFuel != null && (
                        <div className="flex items-center gap-2">
                          <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{returnFuel}/8</span>
                        </div>
                      )}
                      {returnKms != null && (
                        <div className="flex items-center gap-2">
                          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{Number(returnKms).toLocaleString("es-ES")} km</span>
                        </div>
                      )}
                      {(b.CurrentStatus as number) < 4 && (
                        <p className="text-xs text-muted-foreground italic mt-2">
                          Todav\u00eda no se ha realizado la devoluci\u00f3n
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes section */}
                {notes && (
                  <>
                    <Separator className="my-5" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Notas</h3>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{notes}</p>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── Additionals Tab ── */}
              <TabsContent value="additionals" className="p-5 mt-0">
                {additionals.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Sin adicionales contratados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {additionals.map((item, idx) => {
                      const addl = (item.Additional && typeof item.Additional === "object") ? item.Additional as Record<string, unknown> : null;
                      const name = addl ? safeStr(addl.Name) : safeStr(item.Name) || `Adicional ${idx + 1}`;
                      const desc = addl ? safeStr(addl.Description) : safeStr(item.Description);
                      const imgPath = addl ? safeStr(addl.ImagePath) : safeStr(item.ImagePath);
                      const qty = (item.Quantity as number) ?? 1;
                      const price = (item.Price as number) ?? (item.TotalPrice as number) ?? null;

                      return (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border">
                          {imgPath && (
                            <img
                              src={imgPath}
                              alt={name}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{name}</p>
                            {desc && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            {qty > 1 && <p className="text-xs text-muted-foreground">x{qty}</p>}
                            {price != null && <p className="text-sm font-semibold">{fmtCurrency(price, currency)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── Drivers Tab ── */}
              <TabsContent value="drivers" className="p-5 mt-0">
                {drivers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Sin conductores adicionales</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drivers.map((driver, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border">
                        <div className="p-2 rounded-lg bg-primary/5">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {safeStr(driver.Firstname) || safeStr(driver.Name)} {safeStr(driver.Lastname)}
                          </p>
                          {safeStr(driver.DocumentId) && (
                            <p className="text-xs text-muted-foreground">{safeStr(driver.DocumentId)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          {/* RIGHT: Pricing Sidebar */}
          <div className="space-y-4">
            {/* Order Card */}
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Orden de Compra</h3>

                {/* Price section header */}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Precio</p>

                {/* Unlimited km */}
                {unlimitedKm && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-xs text-muted-foreground">Distancia total permitida</span>
                    <span className="text-xs font-medium">Km Ilimitados</span>
                  </div>
                )}

                <Separator className="my-2" />

                {/* Price items breakdown */}
                {priceItems.length > 0 ? (
                  <div className="space-y-1">
                    {priceItems.map((item, idx) => {
                      const desc = safeStr(item.Description);
                      const price = item.Price as number;
                      const isDiscount = price < 0;

                      return (
                        <div key={idx} className="flex justify-between items-start py-1.5 gap-2">
                          <span className={cn("text-xs flex-1", isDiscount ? "text-emerald-600 font-medium" : "")}>
                            {desc}
                          </span>
                          <span className={cn("text-xs font-semibold shrink-0", isDiscount ? "text-emerald-600" : "")}>
                            {fmtCurrency(price, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    {/* Fallback: show basic price info */}
                    {dailyRate != null && (
                      <div className="flex justify-between items-center py-1.5">
                        <div>
                          <span className="text-xs">Alquiler por {totalDays} D\u00edas</span>
                          <p className="text-[10px] text-muted-foreground">Tarifa diaria</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold">{fmtCurrency(totalPrice ?? customerPrice, currency)}</span>
                          <p className="text-[10px] text-muted-foreground">{fmtCurrency(dailyRate, currency)}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Separator className="my-3" />

                {/* Total */}
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-primary/5 border border-primary/10">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-lg font-bold text-primary">
                    {fmtCurrency(totalPrice ?? customerPrice, currency)}
                  </span>
                </div>

                {/* Paid / Balance */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Pagado</span>
                    <span className="text-xs font-medium">{fmtCurrency(totalPaid, currency)}</span>
                  </div>
                  {balance != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Saldo</span>
                      <span className={cn("text-xs font-semibold", balance < 0 ? "text-red-600" : balance > 0 ? "text-emerald-600" : "")}>
                        {fmtCurrency(balance, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Franchise / Deposit Card */}
            {franchise != null && franchise > 0 && (
              <Card className="rounded-2xl border shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Dep\u00f3sito en Garant\u00eda</h3>
                  <div className="space-y-1.5">
                    {franchiseDamage != null && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Franquicia por da\u00f1os</span>
                        <span className="text-xs">{fmtCurrency(franchiseDamage, currency)}</span>
                      </div>
                    )}
                    {franchiseRollover != null && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Franquicia por vuelcos</span>
                        <span className="text-xs">{fmtCurrency(franchiseRollover, currency)}</span>
                      </div>
                    )}
                    {franchiseTheft != null && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Franquicia por robos</span>
                        <span className="text-xs">{fmtCurrency(franchiseTheft, currency)}</span>
                      </div>
                    )}
                    {franchiseHail != null && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Franquicia por granizo</span>
                        <span className="text-xs">{fmtCurrency(franchiseHail, currency)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Drivers Card */}
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Conductores adicionales</h3>
                {drivers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin conductores adicionales</p>
                ) : (
                  <div className="space-y-2">
                    {drivers.map((d, i) => (
                      <p key={i} className="text-sm">{safeStr(d.Firstname) || safeStr(d.Name)} {safeStr(d.Lastname)}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {/* ── Dialogs ── */}
      {booking && (
        <>
          <EditBookingDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            booking={booking}
            onSuccess={fetchBooking}
          />
          <BookingPaymentsDialog
            open={paymentsOpen}
            onOpenChange={setPaymentsOpen}
            booking={booking}
            onSuccess={fetchBooking}
          />
        </>
      )}
    </AppLayout>
  );
}
