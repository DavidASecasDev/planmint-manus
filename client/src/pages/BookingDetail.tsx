/**
 * BookingDetail — Full-page Rently booking detail.
 *
 * Layout inspired by Rently's reservation screen but adapted to PlanMint's
 * corporate identity (navy/gold, Montserrat headings, Barlow body, warm cards).
 *
 * Structure:
 *   HEADER  — Reserva #code (Xd) · Km badge · Status badge · metadata row
 *   ALERT   — Customer balance / insurance warnings
 *   TOP ROW — Vehicle card | Customer card
 *   MAIN    — Left: Tabs (Detalles, Adicionales, Conductores, Notas)
 *             Right: Orden de Compra (pricing sidebar)
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRentlyHub } from "@/lib/rently/useRentlyHub";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Calendar, Car, Clock, Copy, CreditCard, FileText,
  Fuel, Gauge, Globe, IdCard, MapPin, Navigation, Package, Phone,
  RefreshCw, User, Users, CheckCircle2, XCircle, AlertCircle, Info,
  AlertTriangle, Mail,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatDate(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return "\u2014";
  try { return format(parseISO(dateStr), "dd/MM/yyyy hh:mm a", { locale: es }); }
  catch { return String(dateStr); }
}

function formatCurrency(amount: unknown, currency?: string): string {
  if (amount == null || amount === "") return "\u2014";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "\u2014";
  const cur = currency || "EUR";
  try { return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur }).format(num); }
  catch { return `${num.toFixed(2)} ${cur}`; }
}

function getDurationDays(from: unknown, to: unknown): number {
  if (!from || !to || typeof from !== "string" || typeof to !== "string") return 0;
  try { return differenceInDays(parseISO(to), parseISO(from)); } catch { return 0; }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copiado al portapapeles"));
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  Pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  Confirmed: { label: "Confirmada", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  Active: { label: "Entregado", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Car },
  Completed: { label: "Completada", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: CheckCircle2 },
  Cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
  NoShow: { label: "No Show", color: "bg-gray-100 text-gray-800 border-gray-300", icon: AlertCircle },
  Pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  Confirmada: { label: "Confirmada", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  Entregado: { label: "Entregado", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Car },
  "En curso": { label: "En curso", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Car },
  Completada: { label: "Completada", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: CheckCircle2 },
  Cancelada: { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-300", icon: XCircle },
};

function getStatusInfo(booking: Record<string, unknown>) {
  const statusName = safeStr(booking.StatusName) || safeStr(booking.Status) || safeStr(booking.Estado) || "Desconocido";
  return STATUS_MAP[statusName] || { label: statusName, color: "bg-gray-100 text-gray-700 border-gray-300", icon: FileText };
}

// ─── Small UI components ────────────────────────────────────────────────────

function CopyableField({ value, href, className }: { value: string; href?: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      {href ? (
        <a href={href} className="text-sm text-primary hover:underline truncate" target="_blank" rel="noopener noreferrer">{value}</a>
      ) : (
        <span className="text-sm truncate">{value}</span>
      )}
      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(value); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded">
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
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      <Navigation className="h-3 w-3" />Ver mapa
    </a>
  );
}

function BookingDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2 flex-1"><Skeleton className="h-7 w-72" /><Skeleton className="h-4 w-48" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
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
      if (result.success && result.data) { setBooking(result.data); }
      else { setError(result.error || "No se pudo cargar la reserva"); }
      try {
        const driversResult = await query<Record<string, unknown>[]>("bookings", "drivers", { id });
        if (driversResult.success && Array.isArray(driversResult.data)) setDrivers(driversResult.data);
      } catch { /* drivers optional */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally { setLoading(false); }
  }, [id, query]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  if (loading) return <AppLayout title="Reserva" fullWidth><div className="max-w-[1400px] mx-auto"><BookingDetailSkeleton /></div></AppLayout>;

  if (error || !booking) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <AlertCircle className="h-12 w-12 text-destructive/60" />
            <h2 className="text-lg font-semibold font-heading">Error al cargar la reserva</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center">{error || "No se encontr\u00f3 la reserva"}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/bookings")}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
              <Button onClick={fetchBooking}><RefreshCw className="h-4 w-4 mr-2" />Reintentar</Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Extract data ──────────────────────────────────────────────────────
  const b = booking;
  const status = getStatusInfo(b);
  const StatusIcon = status.icon;
  const code = safeStr(b.Code) || `${safeStr(b.Id)}`;
  const durationDays = getDurationDays(b.FromDate, b.ToDate);
  const customerName = [safeStr(b.CustomerFirstname) || safeStr(b.Firstname), safeStr(b.CustomerLastname) || safeStr(b.Lastname)].filter(Boolean).join(" ") || "Sin cliente";
  const email = safeStr(b.CustomerEmail) || safeStr(b.Email);
  const phone = safeStr(b.CustomerPhone) || safeStr(b.Phone);
  const customerDoc = safeStr(b.CustomerDocumentNumber) || safeStr(b.DocumentNumber);
  const customerDocType = safeStr(b.CustomerDocumentType) || safeStr(b.DocumentType);
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
  const totalPaid = b.TotalPaid;
  const source = safeStr(b.Source) || safeStr(b.SourceName);
  const isQuotation = b.IsQuotation === true;
  const notes = safeStr(b.Notes) || safeStr(b.CustomerNotes);
  const createdDate = safeStr(b.CreatedDate) || safeStr(b.CreateDate);
  const extras = Array.isArray(b.Additionals) ? b.Additionals as Record<string, unknown>[] : [];
  const priceItems = Array.isArray(b.PriceItems) ? b.PriceItems as Record<string, unknown>[] : [];
  const payments = Array.isArray(b.Payments) ? b.Payments as Record<string, unknown>[] : [];
  const carColor = safeStr(b.CarColor) || safeStr(b.Color);
  const carFuelType = safeStr(b.CarFuelType) || safeStr(b.FuelType);
  const unlimitedKm = b.UnlimitedKm ?? b.IsUnlimitedKm;
  const dailyRate = b.DailyRate ?? b.RatePerDay;
  const deliveryDriver = safeStr(b.DeliveryDriverName) || safeStr(b.DeliveryDriver);
  const returnDriver = safeStr(b.ReturnDriverName) || safeStr(b.ReturnDriver);
  const deliveryFuel = b.DeliveryFuelLevel ?? b.DeliveryFuel;
  const returnFuel = b.ReturnFuelLevel ?? b.ReturnFuel;
  const deliveryKms = b.DeliveryKms ?? b.DeliveryMileage;
  const returnKms = b.ReturnKms ?? b.ReturnMileage;
  const deposit = b.Deposit ?? b.DepositAmount;
  const depositReduction = b.DepositReduction ?? b.DepositWithReduction;
  const customerBalance = b.CustomerBalance;
  const insuranceAlert = safeStr(b.InsuranceAlert) || safeStr(b.InsuranceWarning);
  const agencyName = safeStr(b.AgencyName) || safeStr(b.Agency);
  const priceAgreement = safeStr(b.PriceAgreement) || safeStr(b.PriceAgreementName);
  const billingData = safeStr(b.BillingData) || safeStr(b.BillingDataName);

  return (
    <AppLayout title={`Reserva ${code}`} fullWidth>
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 mt-0.5 rounded-lg hover:bg-muted" onClick={() => navigate("/bookings")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold font-heading tracking-tight text-primary">Reserva #{code}</h1>
                <span className="text-base text-muted-foreground font-medium">({durationDays} D\u00edas){unlimitedKm ? " - Km Ilimitados" : ""}</span>
                <Badge className={cn("border text-xs font-semibold px-2.5 py-0.5 gap-1", status.color)}>
                  <StatusIcon className="h-3 w-3" />{status.label}
                </Badge>
                {isQuotation && <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Cotizaci\u00f3n</Badge>}
              </div>
              {createdDate && (
                <p className="text-xs text-muted-foreground mt-1">creado por <strong>{source || "SISTEMA"}</strong> el {formatDate(createdDate)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground mr-2">
              {billingData && <div><span className="block text-[10px] uppercase tracking-wider font-semibold">Facturaci\u00f3n</span><span className="text-primary font-medium">{billingData}</span></div>}
              {agencyName && <div><span className="block text-[10px] uppercase tracking-wider font-semibold">Agencia</span><span className="font-medium">{agencyName}</span></div>}
              {priceAgreement && <div><span className="block text-[10px] uppercase tracking-wider font-semibold">Acuerdo</span><span className="font-medium">{priceAgreement}</span></div>}
              {source && <div><span className="block text-[10px] uppercase tracking-wider font-semibold">Origen</span><span className="font-medium">{source}</span></div>}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchBooking} disabled={hubLoading}>
              <RefreshCw className={cn("h-3.5 w-3.5", hubLoading && "animate-spin")} />Actualizar
            </Button>
          </div>
        </div>

        {/* ═══ ALERTS ═══ */}
        {customerBalance != null && Number(customerBalance) !== 0 && (
          <div className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm",
            Number(customerBalance) > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <Info className="h-4 w-4 shrink-0" />
            <span>El cliente <strong>{customerName.split(" ")[0]}</strong>{" "}
              {Number(customerBalance) > 0
                ? `tiene saldo a favor en reservas por ${formatCurrency(customerBalance, currency)}`
                : `tiene un saldo pendiente de ${formatCurrency(Math.abs(Number(customerBalance)), currency)}`}
            </span>
          </div>
        )}
        {insuranceAlert && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-red-50 border-red-200 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" /><span>{insuranceAlert}</span>
          </div>
        )}

        {/* ═══ TOP ROW — Vehicle + Customer ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vehicle */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Car className="h-5 w-5 text-primary" /></div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {plate && <span className="font-mono text-sm font-bold">{plate}</span>}
                      <span className="text-sm">- {carName}</span>
                      {category && <span className="text-xs text-muted-foreground">({category})</span>}
                    </div>
                    {carColor && <p className="text-xs text-muted-foreground mt-0.5">{carColor}{carFuelType ? ` \u00b7 ${carFuelType}` : ""}</p>}
                  </div>
                </div>
                {(safeStr(b.CarStatus) || safeStr(b.VehicleStatus)) && (
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">{safeStr(b.CarStatus) || safeStr(b.VehicleStatus)}</Badge>
                )}
              </div>
              {insuranceAlert && <p className="text-xs text-red-600 mt-2">{insuranceAlert}</p>}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><User className="h-5 w-5 text-primary" /></div>
                <p className="text-sm font-semibold">{customerName}</p>
              </div>
              <div className="mt-3 space-y-1.5 pl-[52px]">
                {customerDoc && <CopyableField value={`${customerDocType ? customerDocType + " " : ""}${customerDoc}`} />}
                {email && <CopyableField value={email} href={`mailto:${email}`} />}
                {phone && <CopyableField value={phone} href={`tel:${phone}`} />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ MAIN — Tabs (left) + Orden de Compra (right) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">

          {/* LEFT: Tabs */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <Tabs defaultValue="detalles" className="w-full">
              <div className="border-b bg-card px-5 pt-3">
                <TabsList className="bg-transparent h-auto p-0 gap-0">
                  {["detalles", ...(extras.length > 0 ? ["adicionales"] : []), ...(drivers.length > 0 ? ["conductores"] : []), ...(notes ? ["notas"] : [])].map(tab => (
                    <TabsTrigger key={tab} value={tab} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-xs font-semibold capitalize">
                      {tab === "detalles" ? "Detalles" : tab === "adicionales" ? "Adicionales" : tab === "conductores" ? "Conductores" : "Notas"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* TAB: Detalles */}
              <TabsContent value="detalles" className="mt-0 p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Entrega */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Calendar className="h-3.5 w-3.5 text-emerald-700" /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entrega</p>
                        <p className="text-sm font-semibold">{formatDate(fromDate)}</p>
                      </div>
                    </div>
                    <div className="space-y-2.5 pl-9">
                      {deliveryPlace && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm">{deliveryPlace}</p>
                            {deliveryAddress && deliveryAddress !== deliveryPlace && <p className="text-xs text-muted-foreground">{deliveryAddress}</p>}
                            <MapsLink address={deliveryAddress || deliveryPlace} coords={deliveryCoords} />
                          </div>
                        </div>
                      )}
                      {deliveryDriver && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm">{deliveryDriver}</span></div>}
                      {deliveryFuel != null && <div className="flex items-center gap-2"><Fuel className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm">{String(deliveryFuel)}/8</span></div>}
                      {deliveryKms != null && <div className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm">{Number(deliveryKms).toLocaleString("es-ES")} km</span></div>}
                    </div>
                  </div>
                  {/* Devolucion */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center"><Calendar className="h-3.5 w-3.5 text-orange-700" /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Devoluci\u00f3n</p>
                        <p className="text-sm font-semibold">{formatDate(toDate)}</p>
                      </div>
                    </div>
                    <div className="space-y-2.5 pl-9">
                      {returnPlace && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm">{returnPlace}</p>
                            {returnAddress && returnAddress !== returnPlace && <p className="text-xs text-muted-foreground">{returnAddress}</p>}
                            <MapsLink address={returnAddress || returnPlace} coords={returnCoords} />
                          </div>
                        </div>
                      )}
                      {returnDriver && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm">{returnDriver}</span></div>}
                      {returnFuel != null && <div className="flex items-center gap-2"><Fuel className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm">{String(returnFuel)}/8</span></div>}
                      {returnKms != null && <div className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-sm">{Number(returnKms).toLocaleString("es-ES")} km</span></div>}
                      {!returnDriver && !returnFuel && !returnKms && safeStr(b.StatusName) !== "Completada" && safeStr(b.StatusName) !== "Cancelled" && (
                        <p className="text-xs text-muted-foreground italic">Todav\u00eda no se ha realizado la devoluci\u00f3n</p>
                      )}
                    </div>
                  </div>
                </div>
                {notes && (
                  <>
                    <Separator className="my-5" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notas</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{notes}</p>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* TAB: Adicionales */}
              {extras.length > 0 && (
                <TabsContent value="adicionales" className="mt-0 p-5">
                  <div className="space-y-3">
                    {extras.map((extra, i) => {
                      const name = safeStr(extra.Name) || safeStr(extra.Description) || "Extra";
                      const qty = Number(extra.Quantity ?? extra.Count ?? 1);
                      const price = extra.Price ?? extra.UnitPrice;
                      const total = extra.Total ?? extra.TotalPrice ?? (price != null ? Number(price) * qty : null);
                      const isPerDay = extra.IsPerDay === true || extra.PerDay === true;
                      return (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                          <div className="flex items-center gap-3">
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{name}</p>
                              <div className="flex gap-1.5 mt-0.5">
                                {qty > 1 && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">x{qty}</span>}
                                {isPerDay && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">por d\u00eda</span>}
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">{formatCurrency(total, currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              )}

              {/* TAB: Conductores */}
              {drivers.length > 0 && (
                <TabsContent value="conductores" className="mt-0 p-5">
                  <div className="space-y-4">
                    {drivers.map((driver, i) => (
                      <div key={i} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4 text-muted-foreground" /></div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{safeStr(driver.Firstname || driver.Name)} {safeStr(driver.Lastname)}</p>
                          {safeStr(driver.DocumentNumber) && <p className="text-xs text-muted-foreground">Doc: {safeStr(driver.DocumentNumber)}</p>}
                          {safeStr(driver.LicenseNumber) && <p className="text-xs text-muted-foreground">Carnet: {safeStr(driver.LicenseNumber)}{safeStr(driver.LicenseCountry) ? ` (${safeStr(driver.LicenseCountry)})` : ""}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* TAB: Notas */}
              {notes && (
                <TabsContent value="notas" className="mt-0 p-5">
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{notes}</p>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </Card>

          {/* RIGHT: Orden de Compra */}
          <div className="space-y-4">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold font-heading uppercase tracking-wider mb-4">Orden de Compra</h3>
                <div className="space-y-0.5 mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Precio</p>
                  {unlimitedKm != null && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-muted-foreground">Distancia total permitida</span>
                      <span className="text-xs font-medium">{unlimitedKm ? "Km Ilimitados" : "Limitados"}</span>
                    </div>
                  )}
                  {dailyRate != null && (
                    <>
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between py-1.5 bg-muted/30 rounded-lg px-3 -mx-1">
                        <div>
                          <p className="text-sm font-medium">Alquiler por {durationDays} D\u00edas</p>
                          <p className="text-[10px] text-muted-foreground">Tarifa diaria</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(Number(dailyRate) * durationDays, currency)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(dailyRate, currency)}</p>
                        </div>
                      </div>
                    </>
                  )}
                  {priceItems.map((item, i) => {
                    const desc = safeStr(item.Description) || safeStr(item.Name) || "Concepto";
                    const amount = item.Amount ?? item.Price ?? item.Total;
                    const isDiscount = Number(amount) < 0 || safeStr(item.Type)?.toLowerCase().includes("descuento") || safeStr(item.Type)?.toLowerCase().includes("discount");
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className={cn("text-sm", isDiscount && "text-emerald-600")}>{desc}</span>
                        <span className={cn("text-sm font-medium", isDiscount && "text-emerald-600")}>{isDiscount && Number(amount) > 0 ? "-" : ""}{formatCurrency(amount, currency)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  {b.SubTotal != null && (
                    <div className="flex items-center justify-between"><span className="text-sm">Sub Total</span><span className="text-sm font-medium">{formatCurrency(b.SubTotal, currency)}</span></div>
                  )}
                  {b.TaxAmount != null && (
                    <div className="flex items-center justify-between py-1.5 bg-muted/30 rounded-lg px-3 -mx-1"><span className="text-sm">Impuestos</span><span className="text-sm font-medium">{formatCurrency(b.TaxAmount, currency)}</span></div>
                  )}
                  <div className="flex items-center justify-between py-3 mt-2 border-2 border-primary/30 rounded-xl px-4 bg-primary/5">
                    <span className="text-base font-bold font-heading">Total</span>
                    <span className="text-lg font-bold font-heading">{formatCurrency(totalPrice, currency)}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {totalPaid != null && (
                    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Pagado</span><span className="text-sm font-medium">{formatCurrency(totalPaid, currency)}</span></div>
                  )}
                  {balance != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Saldo</span>
                      <span className={cn("text-sm font-semibold", Number(balance) > 0 ? "text-amber-600" : "text-emerald-600")}>{formatCurrency(balance, currency)}</span>
                    </div>
                  )}
                </div>
                {payments.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border space-y-2">
                    {payments.map((payment, i) => {
                      const date = safeStr(payment.Date) || safeStr(payment.PaymentDate);
                      const method = safeStr(payment.Method) || safeStr(payment.PaymentMethod) || safeStr(payment.Gateway);
                      const pType = safeStr(payment.Type) || safeStr(payment.PaymentType);
                      const pAmount = payment.Amount ?? payment.Total;
                      const pSource = safeStr(payment.Source);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {date && <span className="text-muted-foreground">{formatDate(date).split(",")[0]}</span>}
                            <span className="text-muted-foreground">\u25cf</span>
                            <span>{method}{pType ? ` (${pType})` : ""}{pSource ? ` (${pSource})` : ""}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(pAmount, currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {(deposit != null || depositReduction != null) && (
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold font-heading uppercase tracking-wider mb-3">Dep\u00f3sito en Garant\u00eda</h3>
                  <div className="space-y-1.5">
                    {depositReduction != null && (
                      <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Dep\u00f3sito con reducci\u00f3n</span><span className="text-sm font-medium">{formatCurrency(depositReduction, currency)}</span></div>
                    )}
                    {deposit != null && (
                      <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Saldo</span><span className="text-sm font-medium">{formatCurrency(deposit, currency)}</span></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {drivers.length > 0 && (
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold font-heading uppercase tracking-wider mb-2">Conductores adicionales</h3>
                  <div className="space-y-1">
                    {drivers.map((d, i) => <p key={i} className="text-sm">{safeStr(d.Firstname || d.Name)} {safeStr(d.Lastname)}</p>)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
