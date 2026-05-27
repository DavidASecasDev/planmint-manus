/**
 * BookingDetail — Full-page view for a single Rently booking.
 * Fetches booking data directly from Rently API via the hub.
 * Accessed from /bookings/:id
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRentlyHub } from "@/lib/rently/useRentlyHub";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Car,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Fuel,
  Globe,
  Hash,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Tag,
  User,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Gauge,
  Palette,
  Navigation,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Safely extract a display string from a Rently field that may be a string or an object */
function safeStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.Name === "string" && obj.Name) return obj.Name;
    if (typeof obj.BranchOfficeName === "string" && obj.BranchOfficeName) return obj.BranchOfficeName;
    if (typeof obj.Address === "string" && obj.Address) return obj.Address;
    if (typeof obj.City === "string" && obj.City) return obj.City;
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v) return v;
    }
  }
  return "";
}

/** Extract address from a place object */
function getPlaceAddress(place: unknown): string {
  if (!place || typeof place !== "object") return "";
  const obj = place as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof obj.Address === "string" && obj.Address) parts.push(obj.Address);
  if (typeof obj.City === "string" && obj.City) parts.push(obj.City);
  if (typeof obj.Country === "string" && obj.Country) parts.push(obj.Country);
  return parts.join(", ");
}

/** Extract lat/lng from a place object for Google Maps link */
function getPlaceCoords(place: unknown): { lat: number; lng: number } | null {
  if (!place || typeof place !== "object") return null;
  const obj = place as Record<string, unknown>;
  if (typeof obj.Latitude === "number" && typeof obj.Longitude === "number" && obj.Latitude !== 0) {
    return { lat: obj.Latitude, lng: obj.Longitude };
  }
  return null;
}

function formatDate(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return "—";
  try {
    return format(parseISO(dateStr), "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return String(dateStr);
  }
}

function formatDateShort(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return String(dateStr);
  }
}

function formatCurrency(amount: unknown, currency?: string): string {
  if (amount == null || amount === "") return "—";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "—";
  const cur = currency || "EUR";
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur }).format(num);
  } catch {
    return `${num.toFixed(2)} ${cur}`;
  }
}

function getDuration(from: unknown, to: unknown): string {
  if (!from || !to || typeof from !== "string" || typeof to !== "string") return "—";
  try {
    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    const days = differenceInDays(toDate, fromDate);
    const hours = differenceInHours(toDate, fromDate) % 24;
    if (days === 0) return `${hours}h`;
    if (hours === 0) return `${days}d`;
    return `${days}d ${hours}h`;
  } catch {
    return "—";
  }
}

// ─── Status mapping ─────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  Pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  Confirmed: { label: "Confirmada", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  Active: { label: "En curso", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Car },
  Completed: { label: "Completada", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: CheckCircle2 },
  Cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
  NoShow: { label: "No Show", color: "bg-gray-100 text-gray-800 border-gray-300", icon: AlertCircle },
  // Spanish variants
  Pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  Confirmada: { label: "Confirmada", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  "En curso": { label: "En curso", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Car },
  Completada: { label: "Completada", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: CheckCircle2 },
  Cancelada: { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
};

function getStatusInfo(booking: Record<string, unknown>) {
  const statusName = safeStr(booking.StatusName) || safeStr(booking.Status) || safeStr(booking.Estado) || "Desconocido";
  const mapped = STATUS_MAP[statusName];
  if (mapped) return mapped;
  return { label: statusName, color: "bg-gray-100 text-gray-700 border-gray-300", icon: FileText };
}

// ─── Section components ─────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, className }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <div className={`flex items-start gap-3 py-1.5 ${className || ""}`}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground uppercase tracking-wide">
      {children}
    </h3>
  );
}

function GoogleMapsButton({ address, coords }: { address?: string; coords?: { lat: number; lng: number } | null }) {
  const url = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
    : address
      ? `https://www.google.com/maps/search/${encodeURIComponent(address)}`
      : null;
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
    >
      <Navigation className="h-3 w-3" />
      Ver en Google Maps
    </a>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function BookingDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
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

      // Also fetch drivers
      try {
        const driversResult = await query<Record<string, unknown>[]>("bookings", "drivers", { id });
        if (driversResult.success && Array.isArray(driversResult.data)) {
          setDrivers(driversResult.data);
        }
      } catch {
        // Drivers are optional
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [id, query]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-6xl mx-auto">
          <BookingDetailSkeleton />
        </div>
      </AppLayout>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (error || !booking) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <AlertCircle className="h-12 w-12 text-destructive/60" />
            <h2 className="text-lg font-semibold">Error al cargar la reserva</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center">
              {error || "No se encontró la reserva en Rently"}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/bookings")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Reservas
              </Button>
              <Button onClick={fetchBooking}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Extract booking data ───────────────────────────────────────────────

  const b = booking;
  const status = getStatusInfo(b);
  const StatusIcon = status.icon;
  const code = safeStr(b.Code) || `#${safeStr(b.Id)}`;
  const customerName = [safeStr(b.CustomerFirstname) || safeStr(b.Firstname), safeStr(b.CustomerLastname) || safeStr(b.Lastname)].filter(Boolean).join(" ") || "Sin cliente";
  const email = safeStr(b.CustomerEmail) || safeStr(b.Email);
  const phone = safeStr(b.CustomerPhone) || safeStr(b.Phone);
  const brand = safeStr(b.CarBrand) || safeStr(b.Brand);
  const model = safeStr(b.CarModel) || safeStr(b.Model);
  const plate = safeStr(b.CarPlate) || safeStr(b.Plate);
  const carName = `${brand} ${model}`.trim() || "Sin asignar";
  const category = safeStr(b.CategoryName) || safeStr(b.Category);
  const fromDate = safeStr(b.FromDate);
  const toDate = safeStr(b.ToDate);
  const deliveryPlace = safeStr(b.DeliveryPlaceName) || safeStr(b.DeliveryPlace);
  const returnPlace = safeStr(b.ReturnPlaceName) || safeStr(b.ReturnPlace);
  const deliveryAddress = getPlaceAddress(b.DeliveryPlace);
  const returnAddress = getPlaceAddress(b.ReturnPlace);
  const deliveryCoords = getPlaceCoords(b.DeliveryPlace);
  const returnCoords = getPlaceCoords(b.ReturnPlace);
  const currency = safeStr(b.Currency) || "EUR";
  const totalPrice = b.TotalPrice ?? b.Price;
  const balance = b.Balance;
  const source = safeStr(b.Source) || safeStr(b.SourceName);
  const isQuotation = b.IsQuotation === true;
  const notes = safeStr(b.Notes) || safeStr(b.CustomerNotes);
  const createdDate = safeStr(b.CreatedDate) || safeStr(b.CreateDate);

  // Extras
  const extras = Array.isArray(b.Additionals) ? b.Additionals as Record<string, unknown>[] : [];
  // Price breakdown
  const priceItems = Array.isArray(b.PriceItems) ? b.PriceItems as Record<string, unknown>[] : [];

  // Vehicle details
  const carYear = b.CarYear ?? b.Year;
  const carColor = safeStr(b.CarColor) || safeStr(b.Color);
  const carKms = b.CarKms ?? b.Kms;
  const carFuel = b.CarFuelLevel ?? b.FuelLevel;
  const carFuelType = safeStr(b.CarFuelType) || safeStr(b.FuelType);
  const carChassis = safeStr(b.CarChassis) || safeStr(b.Chassis);

  // Rates
  const dailyRate = b.DailyRate ?? b.RatePerDay;
  const hourlyRate = b.HourlyRate ?? b.RatePerHour;
  const unlimitedKm = b.UnlimitedKm ?? b.IsUnlimitedKm;

  // Customer details
  const customerDoc = safeStr(b.CustomerDocumentNumber) || safeStr(b.DocumentNumber);
  const customerDocType = safeStr(b.CustomerDocumentType) || safeStr(b.DocumentType);
  const customerAddress = safeStr(b.CustomerAddress);
  const customerCity = safeStr(b.CustomerCity);
  const customerCountry = safeStr(b.CustomerCountry);

  // Payments
  const totalPaid = b.TotalPaid;
  const prepaid = b.Prepaid ?? b.PrepaidAmount;
  const agencyPaid = b.AgencyPaid ?? b.PaidByAgency;
  const customerPaid = b.CustomerPaid ?? b.PaidByCustomer;

  return (
    <AppLayout title={`Reserva ${code}`} fullWidth>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ─── Back button + Header ────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 mt-0.5"
              onClick={() => navigate("/bookings")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold font-heading">Reserva {code}</h1>
                <Badge className={`${status.color} border text-sm font-medium px-3 py-1 gap-1.5`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </Badge>
                {isQuotation && (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                    Cotización
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {customerName} · {carName}{plate ? ` (${plate})` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={fetchBooking}
            disabled={hubLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${hubLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {/* ─── Summary cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Dates card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Recogida</p>
                <p className="text-sm font-medium">{formatDate(fromDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Devolución</p>
                <p className="text-sm font-medium">{formatDate(toDate)}</p>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Duración: <strong>{getDuration(fromDate, toDate)}</strong></span>
              </div>
              {createdDate && (
                <p className="text-[10px] text-muted-foreground">
                  Creada: {formatDateShort(createdDate)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Places card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Lugares
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">Entrega</p>
                </div>
                <p className="text-sm font-medium ml-4">{deliveryPlace || "—"}</p>
                {deliveryAddress && deliveryAddress !== deliveryPlace && (
                  <p className="text-xs text-muted-foreground ml-4">{deliveryAddress}</p>
                )}
                <div className="ml-4">
                  <GoogleMapsButton address={deliveryAddress || deliveryPlace} coords={deliveryCoords} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">Devolución</p>
                </div>
                <p className="text-sm font-medium ml-4">{returnPlace || "—"}</p>
                {returnAddress && returnAddress !== returnPlace && (
                  <p className="text-xs text-muted-foreground ml-4">{returnAddress}</p>
                )}
                <div className="ml-4">
                  <GoogleMapsButton address={returnAddress || returnPlace} coords={returnCoords} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial summary card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Precio total</span>
                <span className="text-lg font-bold">{formatCurrency(totalPrice, currency)}</span>
              </div>
              <Separator />
              {balance != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Saldo pendiente</span>
                  <span className={`text-sm font-semibold ${Number(balance) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {formatCurrency(balance, currency)}
                  </span>
                </div>
              )}
              {totalPaid != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total pagado</span>
                  <span className="text-sm font-medium">{formatCurrency(totalPaid, currency)}</span>
                </div>
              )}
              {source && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Origen</span>
                  <Badge variant="outline" className="text-[10px]">{source}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Detailed tabs ───────────────────────────────────────── */}
        <Card>
          <Tabs defaultValue="cliente" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 pt-3 h-auto gap-1 flex-wrap">
              <TabsTrigger value="cliente" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                <User className="h-3.5 w-3.5 mr-1.5" />
                Cliente
              </TabsTrigger>
              <TabsTrigger value="vehiculo" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                <Car className="h-3.5 w-3.5 mr-1.5" />
                Vehículo
              </TabsTrigger>
              <TabsTrigger value="financiero" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                Pagos
              </TabsTrigger>
              {extras.length > 0 && (
                <TabsTrigger value="extras" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Extras ({extras.length})
                </TabsTrigger>
              )}
              {drivers.length > 0 && (
                <TabsTrigger value="conductores" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Conductores ({drivers.length})
                </TabsTrigger>
              )}
              {notes && (
                <TabsTrigger value="notas" className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Notas
                </TabsTrigger>
              )}
            </TabsList>

            {/* === TAB: Cliente === */}
            <TabsContent value="cliente" className="px-6 py-5 space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SectionTitle>
                    <User className="h-4 w-4" /> Datos personales
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={User} label="Nombre completo" value={customerName !== "Sin cliente" ? customerName : null} />
                    <InfoRow icon={Mail} label="Email" value={email} />
                    <InfoRow icon={Phone} label="Teléfono" value={phone} />
                    <InfoRow icon={IdCard} label="Documento" value={
                      customerDoc ? `${customerDocType ? customerDocType + " " : ""}${customerDoc}` : null
                    } />
                  </div>
                </div>
                <div>
                  <SectionTitle>
                    <MapPin className="h-4 w-4" /> Dirección
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={MapPin} label="Dirección" value={customerAddress} />
                    <InfoRow icon={MapPin} label="Ciudad" value={customerCity} />
                    <InfoRow icon={Globe} label="País" value={customerCountry} />
                  </div>
                  {!customerAddress && !customerCity && !customerCountry && (
                    <p className="text-xs text-muted-foreground mt-2 italic">Sin datos de dirección disponibles</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* === TAB: Vehículo === */}
            <TabsContent value="vehiculo" className="px-6 py-5 space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SectionTitle>
                    <Car className="h-4 w-4" /> Datos del vehículo
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={Car} label="Marca y modelo" value={carName !== "Sin asignar" ? carName : null} />
                    <InfoRow icon={Hash} label="Matrícula" value={plate} />
                    <InfoRow icon={Tag} label="Categoría" value={category} />
                    {carYear != null && <InfoRow icon={Calendar} label="Año" value={String(carYear)} />}
                    <InfoRow icon={Palette} label="Color" value={carColor} />
                    <InfoRow icon={Hash} label="Chasis" value={carChassis} />
                    <InfoRow icon={Fuel} label="Tipo combustible" value={carFuelType} />
                  </div>
                </div>
                <div>
                  <SectionTitle>
                    <DollarSign className="h-4 w-4" /> Tarifas
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={DollarSign} label="Tarifa diaria" value={dailyRate != null ? formatCurrency(dailyRate, currency) : null} />
                    <InfoRow icon={DollarSign} label="Tarifa por hora" value={hourlyRate != null ? formatCurrency(hourlyRate, currency) : null} />
                    {unlimitedKm != null && (
                      <InfoRow icon={Gauge} label="Km ilimitados" value={
                        unlimitedKm ? (
                          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Sí</span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600"><XCircle className="h-3.5 w-3.5" /> No</span>
                        )
                      } />
                    )}
                  </div>
                  {carKms != null && (
                    <div className="mt-4">
                      <SectionTitle>
                        <Gauge className="h-4 w-4" /> Indicadores
                      </SectionTitle>
                      <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                        <InfoRow icon={Gauge} label="Kilómetros" value={`${Number(carKms).toLocaleString("es-ES")} km`} />
                        {carFuel != null && (
                          <InfoRow icon={Fuel} label="Nivel combustible" value={`${carFuel}%`} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* === TAB: Financiero === */}
            <TabsContent value="financiero" className="px-6 py-5 space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SectionTitle>
                    <CreditCard className="h-4 w-4" /> Detalle de pagos
                  </SectionTitle>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={DollarSign} label="Precio total" value={formatCurrency(totalPrice, currency)} />
                    <InfoRow icon={CreditCard} label="Total pagado" value={totalPaid != null ? formatCurrency(totalPaid, currency) : null} />
                    {balance != null && (
                      <InfoRow icon={CreditCard} label="Saldo" value={
                        <span className={Number(balance) > 0 ? "text-amber-600 font-semibold" : "text-emerald-600"}>
                          {formatCurrency(balance, currency)}
                        </span>
                      } />
                    )}
                    <InfoRow icon={CreditCard} label="Prepago" value={prepaid != null ? formatCurrency(prepaid, currency) : null} />
                    <InfoRow icon={CreditCard} label="Pagado por agencia" value={agencyPaid != null ? formatCurrency(agencyPaid, currency) : null} />
                    <InfoRow icon={CreditCard} label="Pagado por cliente" value={customerPaid != null ? formatCurrency(customerPaid, currency) : null} />
                  </div>
                </div>

                {/* Price breakdown */}
                {priceItems.length > 0 && (
                  <div>
                    <SectionTitle>
                      <FileText className="h-4 w-4" /> Desglose de precios
                    </SectionTitle>
                    <div className="bg-muted/30 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Concepto</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceItems.map((item, i) => (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-sm">{safeStr(item.Description) || safeStr(item.Name) || "—"}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium">
                                {formatCurrency(item.Amount ?? item.Price ?? item.Total, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* === TAB: Extras === */}
            {extras.length > 0 && (
              <TabsContent value="extras" className="px-6 py-5 mt-0">
                <SectionTitle>
                  <Package className="h-4 w-4" /> Extras contratados
                </SectionTitle>
                <div className="bg-muted/30 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Extra</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Cant.</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Precio</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extras.map((extra, i) => {
                        const name = safeStr(extra.Name) || safeStr(extra.Description) || "—";
                        const qty = Number(extra.Quantity ?? extra.Count ?? 1);
                        const price = extra.Price ?? extra.UnitPrice;
                        const total = extra.Total ?? extra.TotalPrice ?? (price != null ? Number(price) * qty : null);
                        const isPerDay = extra.IsPerDay === true || extra.PerDay === true;
                        const extraType = safeStr(extra.Type) || safeStr(extra.Category);
                        return (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2">
                              <div className="text-sm">{name}</div>
                              <div className="flex gap-1.5 mt-0.5">
                                {isPerDay && (
                                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">por día</span>
                                )}
                                {extraType && (
                                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{extraType}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm text-center">{qty}</td>
                            <td className="px-3 py-2 text-sm text-right">{formatCurrency(price, currency)}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(total, currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}

            {/* === TAB: Conductores === */}
            {drivers.length > 0 && (
              <TabsContent value="conductores" className="px-6 py-5 mt-0">
                <SectionTitle>
                  <Users className="h-4 w-4" /> Conductores
                </SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {drivers.map((driver, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-4 space-y-1">
                      <InfoRow icon={User} label="Nombre" value={safeStr(driver.Firstname || driver.Name) + " " + safeStr(driver.Lastname)} />
                      <InfoRow icon={IdCard} label="Documento" value={safeStr(driver.DocumentNumber)} />
                      <InfoRow icon={IdCard} label="Carnet" value={safeStr(driver.LicenseNumber)} />
                      <InfoRow icon={Globe} label="País carnet" value={safeStr(driver.LicenseCountry)} />
                      <InfoRow icon={Calendar} label="Expiración" value={safeStr(driver.LicenseExpiration)} />
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* === TAB: Notas === */}
            {notes && (
              <TabsContent value="notas" className="px-6 py-5 mt-0">
                <SectionTitle>
                  <FileText className="h-4 w-4" /> Notas
                </SectionTitle>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{notes}</p>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
}
