/**
 * BookingDetail — Full-page Rently booking detail.
 *
 * Layout is a faithful replica of Rently's reservation screen:
 *   Header: "Reserva #ID (X Días) - Km Ilimitados" + badge + action buttons
 *   Top row: Vehicle card | Customer card (with copy buttons)
 *   Center: Tabs (Detalles, Adicionales, Historial, Archivos)
 *   Right sidebar: Orden de Compra with full price breakdown, payments inline, deposit, gastos
 *
 * All text in Spanish. Payments are shown directly in the sidebar (not hidden in a dialog).
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

import { cn } from "@/lib/utils";
import {
  ArrowLeft, Bell, Car, Clock, Copy, CreditCard, FileText,
  Fuel, Gauge, MapPin, Navigation, Package,
  Pencil, Phone, RefreshCw, ScrollText, User, CheckCircle2,
  XCircle, AlertCircle, AlertTriangle, Mail, IdCard,
  Truck, CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { EditBookingDialog } from "@/components/reservations/EditBookingDialog";
import { BookingPaymentsDialog } from "@/components/reservations/BookingPaymentsDialog";
import { apiInvoke } from "@/lib/apiClient";

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

function fmtDateShort(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: es });
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

// ─── Status mapping (CurrentStatus is a number 0-6) ────────────────────────

const STATUS_MAP: Record<number, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  0: { label: "Borrador", color: "text-gray-700", bgColor: "bg-gray-100 border-gray-300", icon: FileText },
  1: { label: "Pendiente", color: "text-amber-700", bgColor: "bg-amber-100 border-amber-300", icon: Clock },
  2: { label: "Confirmada", color: "text-blue-700", bgColor: "bg-blue-100 border-blue-300", icon: CheckCircle2 },
  3: { label: "Entregado", color: "text-emerald-700", bgColor: "bg-emerald-100 border-emerald-300", icon: Car },
  4: { label: "Completada", color: "text-indigo-700", bgColor: "bg-indigo-100 border-indigo-300", icon: CheckCircle2 },
  5: { label: "Cancelada", color: "text-red-700", bgColor: "bg-red-100 border-red-300", icon: XCircle },
  6: { label: "No Show", color: "text-orange-700", bgColor: "bg-orange-100 border-orange-300", icon: AlertCircle },
};

function getStatusInfo(statusNum: unknown) {
  const id = typeof statusNum === "number" ? statusNum : 0;
  return STATUS_MAP[id] ?? { label: `Estado ${id}`, color: "text-gray-700", bgColor: "bg-gray-100 border-gray-300", icon: FileText };
}

// ─── Small UI components ────────────────────────────────────────────────────

function CopyableField({ value, href, icon: Icon, label }: {
  value: string; href?: string; icon?: typeof Mail; label?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between group py-1.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          {label && <p className="text-[10px] text-muted-foreground">{label}</p>}
          {href ? (
            <a href={href} className="text-sm text-blue-600 hover:underline truncate block">{value}</a>
          ) : (
            <span className="text-sm text-foreground truncate block">{value}</span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); copyToClipboard(value); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded shrink-0 ml-2"
        title="Copiar"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
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
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
      <Navigation className="h-3 w-3" />Ver en mapa
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
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Contract PDF download ──────────────────────────────────────────────────

async function downloadContractPdf(bookingId: string | number) {
  try {
    toast.info("Generando contrato...");

    const { data, error } = await apiInvoke<{
      success: boolean;
      data?: unknown;
      error?: string;
    }>("rently-hub", {
      body: {
        action: "explore",
        endpoint: `/api/booking/${bookingId}/contract`,
        httpMethod: "GET",
      },
    });

    if (error) {
      throw new Error(error.message || "Error al conectar con Rently");
    }

    if (!data?.success) {
      throw new Error(data?.error || "Error al generar contrato");
    }

    // The Rently contract endpoint may return a URL or base64 content
    const contractData = data.data;

    if (typeof contractData === "string" && contractData.startsWith("http")) {
      window.open(contractData, "_blank");
      toast.success("Contrato descargado");
    } else if (typeof contractData === "object" && contractData !== null) {
      const url = (contractData as any).Url || (contractData as any).url || (contractData as any).FileUrl || (contractData as any).DownloadUrl;
      if (url) {
        window.open(url, "_blank");
        toast.success("Contrato descargado");
      } else if ((contractData as any).Content || (contractData as any).content) {
        const base64 = (contractData as any).Content || (contractData as any).content;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `Contrato_${bookingId}.pdf`;
        link.click();
        URL.revokeObjectURL(blobUrl);
        toast.success("Contrato descargado");
      } else {
        toast.warning("Formato de contrato no reconocido. Revisa la consola.");
        console.log("[Contract] Response data:", contractData);
      }
    } else {
      toast.error("No se pudo obtener el contrato");
    }
  } catch (err: any) {
    console.error("[Contract] Error:", err);
    toast.error(err?.message || "Error al generar contrato");
  }
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { query } = useRentlyHub();

  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [drivers, setDrivers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);

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

  // ─── Handle contract download ─────────────────────────────────────────
  const handleDownloadContract = async () => {
    if (!id) return;
    setContractLoading(true);
    await downloadContractPdf(id);
    setContractLoading(false);
  };

  // ─── Loading / Error states ───────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-[1440px] mx-auto px-4">
          <BookingDetailSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (error || !booking) {
    return (
      <AppLayout title="Reserva" fullWidth>
        <div className="max-w-[1440px] mx-auto px-4">
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <AlertCircle className="h-12 w-12 text-destructive/60" />
            <h2 className="text-lg font-semibold">Error al cargar la reserva</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center">{error || "No se encontró la reserva"}</p>
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
  const totalDays = (b.TotalDays as number) ?? 0;
  const totalDaysStr = safeStr(b.TotalDaysString) || `${totalDays} Días`;
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

  // Payments
  const rawPayments = Array.isArray(b.Payments) ? b.Payments as Record<string, unknown>[] : [];
  const payments = rawPayments.map((p) => ({
    date: safeStr(p.Date) || safeStr(p.CreationDate),
    amount: (p.Amount as number) ?? 0,
    gateway: safeStr(p.Gateway) || safeStr(p.PaymentMethod) || safeStr(p.Type),
    reference: safeStr(p.Reference) || safeStr(p.TransactionId),
    notes: safeStr(p.Notes) || safeStr(p.Description),
    origin: safeStr(p.Origin) || safeStr(p.Source),
  }));

  // Delivery/Return details
  const deliveryFuel = b.DeliveryFuelLevel as number | null ?? null;
  const returnFuel = b.ReturnFuelLevel as number | null ?? null;
  const deliveryKms = b.DeliveryKms as number | null ?? null;
  const returnKms = b.ReturnKms as number | null ?? null;
  const deliveryDriverId = b.DeliveryDriverId;
  const returnDriverId = b.ReturnDriverId;

  // Notes
  const notes = safeStr(b.Notes);

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <AppLayout title={`Reserva #${bookingId}`} fullWidth>
      <div className="max-w-[1440px] mx-auto px-4 space-y-4">

        {/* ═══ HEADER ═══ */}
        <div className="space-y-2">
          {/* Row 1: Title + Status */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => navigate("/bookings")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-blue-700">
                  Reserva #{bookingId}
                </h1>
                <span className="text-sm text-muted-foreground font-medium">
                  ({totalDaysStr}){unlimitedKm ? " - Km Ilimitados" : ""}
                </span>
                <Badge className={cn("border text-xs font-semibold px-2 py-0.5", status.bgColor, status.color)}>
                  {status.label}
                </Badge>
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />Editar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setPaymentsOpen(true)}>
                <CreditCard className="h-3.5 w-3.5" />Pagos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleDownloadContract}
                disabled={contractLoading}
              >
                <ScrollText className={cn("h-3.5 w-3.5", contractLoading && "animate-pulse")} />
                Generar Contrato
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => toast.info("Enviar notificación: próximamente")}>
                <Bell className="h-3.5 w-3.5" />Notificar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={fetchBooking} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Subline: creation info */}
          <p className="text-xs text-muted-foreground ml-11">
            {originName ? `creado por ${originName}` : ""}
            {creationDate ? ` el ${fmtDate(creationDate)}` : ""}
            {agencyName ? ` · Agencia: ${agencyName}` : ""}
          </p>
        </div>

        {/* ═══ ALERTS ═══ */}
        {isCustomerBlocked && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800">
              <strong>Cliente bloqueado</strong> en el sistema
            </p>
          </div>
        )}

        {/* ═══ TOP ROW: Vehicle + Customer ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle Card */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {plate && (
                      <span className="font-mono font-bold text-sm">{plate}</span>
                    )}
                    {plate && carFullName !== "Sin asignar" && <span className="text-sm text-muted-foreground">-</span>}
                    <span className="text-sm font-medium">{carFullName}</span>
                    {categoryName && (
                      <span className="text-xs text-muted-foreground">{categoryName}</span>
                    )}
                    {plate && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50">
                        Activo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Card */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold mb-1">{customerName}</p>
                  {customerDocDisplay && (
                    <CopyableField value={customerDocDisplay} />
                  )}
                  {customerEmail && (
                    <CopyableField value={customerEmail} href={`mailto:${customerEmail}`} />
                  )}
                  {customerPhone && (
                    <CopyableField value={customerPhone} href={`tel:${customerPhone}`} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ MAIN: Tabs + Pricing Sidebar ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

          {/* LEFT: Tabs */}
          <Card className="rounded-xl border shadow-sm overflow-hidden">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 px-2 pt-1 h-auto gap-0 flex-wrap">
                {[
                  { value: "details", label: "Detalles" },
                  { value: "additionals", label: "Adicionales" },
                  { value: "history", label: "Historial" },
                  { value: "invoices", label: "Facturas" },
                  { value: "files", label: "Archivos" },
                  { value: "infraction", label: "Infracción" },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-background data-[state=active]:shadow-none px-3 pb-2 pt-2 text-xs font-medium"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ── Details Tab ── */}
              <TabsContent value="details" className="p-5 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Entrega */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-md bg-emerald-100">
                        <Truck className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div>
                        <span className="text-sm font-bold">Entrega</span>
                        <span className="text-sm text-muted-foreground ml-2">{fmtDate(fromDate)}</span>
                      </div>
                    </div>
                    <div className="ml-9 space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm">{deliveryPlaceName || "\u2014"}</p>
                          {deliveryAddress && deliveryAddress !== deliveryPlaceName && (
                            <p className="text-xs text-muted-foreground">{deliveryAddress}</p>
                          )}
                          <MapsLink address={deliveryAddress || deliveryPlaceName} coords={deliveryCoords} />
                        </div>
                      </div>
                      {deliveryFuel != null && (
                        <div className="flex items-center gap-2">
                          <Fuel className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{deliveryFuel}/8</span>
                        </div>
                      )}
                      {deliveryKms != null && (
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{Number(deliveryKms).toLocaleString("es-ES")}</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="mt-5 ml-9">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notas</p>
                      <p className="text-sm text-muted-foreground">{notes || "No hay notas"}</p>
                    </div>
                  </div>

                  {/* Devolución */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-md bg-blue-100">
                        <Truck className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <span className="text-sm font-bold">Devolución</span>
                        <span className="text-sm text-muted-foreground ml-2">{fmtDate(toDate)}</span>
                      </div>
                    </div>
                    <div className="ml-9 space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm">{returnPlaceName || "\u2014"}</p>
                          {returnAddress && returnAddress !== returnPlaceName && (
                            <p className="text-xs text-muted-foreground">{returnAddress}</p>
                          )}
                          <MapsLink address={returnAddress || returnPlaceName} coords={returnCoords} />
                        </div>
                      </div>
                      {returnFuel != null && (
                        <div className="flex items-center gap-2">
                          <Fuel className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{returnFuel}/8</span>
                        </div>
                      )}
                      {returnKms != null && (
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{Number(returnKms).toLocaleString("es-ES")}</span>
                        </div>
                      )}
                      {(b.CurrentStatus as number) < 4 && !returnFuel && !returnKms && (
                        <p className="text-sm text-muted-foreground italic">
                          Todavía no se ha realizado la devolución
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conductores adicionales section */}
                {drivers.length > 0 && (
                  <>
                    <Separator className="my-5" />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Conductores adicionales</h3>
                      <div className="space-y-2">
                        {drivers.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{safeStr(d.Firstname) || safeStr(d.Name)} {safeStr(d.Lastname)}</span>
                            {safeStr(d.DocumentId) && (
                              <span className="text-xs text-muted-foreground ml-auto">{safeStr(d.DocumentId)}</span>
                            )}
                          </div>
                        ))}
                      </div>
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
                  <div className="space-y-2">
                    {additionals.map((item, idx) => {
                      const addl = (item.Additional && typeof item.Additional === "object") ? item.Additional as Record<string, unknown> : null;
                      const name = addl ? safeStr(addl.Name) : safeStr(item.Name) || `Adicional ${idx + 1}`;
                      const desc = addl ? safeStr(addl.Description) : safeStr(item.Description);
                      const qty = (item.Quantity as number) ?? 1;
                      const price = (item.Price as number) ?? (item.TotalPrice as number) ?? null;

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{name}</p>
                            {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            {qty > 1 && <p className="text-xs text-muted-foreground">x{qty}</p>}
                            {price != null && <p className="text-sm font-semibold">{fmtCurrency(price, currency)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── History Tab ── */}
              <TabsContent value="history" className="p-5 mt-0">
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Historial de cambios no disponible desde la API</p>
                </div>
              </TabsContent>

              {/* ── Invoices Tab ── */}
              <TabsContent value="invoices" className="p-5 mt-0">
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin facturas disponibles</p>
                </div>
              </TabsContent>

              {/* ── Files Tab ── */}
              <TabsContent value="files" className="p-5 mt-0">
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin archivos adjuntos</p>
                </div>
              </TabsContent>

              {/* ── Infraction Tab ── */}
              <TabsContent value="infraction" className="p-5 mt-0">
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin infracciones registradas</p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* RIGHT: Pricing Sidebar — "Orden de Compra" */}
          <div className="space-y-4">
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold">Orden de Compra</h3>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setEditOpen(true)} />
                </div>

                {/* ── Precio section ── */}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Precio</p>

                {/* Distance info */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Distancia total permitida</span>
                    <span className="text-xs font-medium">{unlimitedKm ? "Km Ilimitados" : (b.MaxAllowedDistance ? `${b.MaxAllowedDistance} km` : "\u2014")}</span>
                  </div>
                  {unlimitedKm && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Distancia diaria</span>
                      <span className="text-xs font-medium">Km Ilimitados</span>
                    </div>
                  )}
                </div>

                <Separator className="my-2" />

                {/* Price items breakdown */}
                {priceItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {priceItems.map((item, idx) => {
                      const desc = safeStr(item.Description);
                      const price = item.Price as number;
                      const isDiscount = price < 0;
                      const unitPrice = item.UnitPrice as number | undefined;

                      return (
                        <div key={idx} className="flex justify-between items-start py-1 gap-2">
                          <div className="flex-1 min-w-0">
                            <span className={cn("text-xs", isDiscount ? "text-emerald-600 font-medium" : "")}>
                              {desc}
                            </span>
                            {unitPrice != null && !isDiscount && (
                              <p className="text-[10px] text-muted-foreground">Tarifa diaria: {fmtCurrency(unitPrice, currency)}</p>
                            )}
                          </div>
                          <span className={cn("text-xs font-semibold shrink-0", isDiscount ? "text-emerald-600" : "")}>
                            {fmtCurrency(price, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    {dailyRate != null && (
                      <div className="flex justify-between items-start py-1.5">
                        <div>
                          <span className="text-xs">Alquiler por {totalDays} Días</span>
                          <p className="text-[10px] text-muted-foreground">Tarifa diaria: {fmtCurrency(dailyRate, currency)}</p>
                        </div>
                        <span className="text-xs font-semibold">{fmtCurrency(totalPrice ?? customerPrice, currency)}</span>
                      </div>
                    )}
                  </>
                )}

                <Separator className="my-2" />

                {/* Sub Total */}
                {priceItems.length > 0 && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-xs font-medium">Sub Total</span>
                    <span className="text-xs font-semibold">{fmtCurrency(totalPrice ?? customerPrice, currency)}</span>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center py-2.5 px-3 mt-2 rounded-md border-2 border-emerald-200 bg-emerald-50/50">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-base font-bold text-emerald-700">
                    {fmtCurrency(totalPrice ?? customerPrice, currency)}
                  </span>
                </div>

                {/* Paid / Balance */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Pagado</span>
                    <span className="text-xs font-medium">{fmtCurrency(totalPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Saldo</span>
                    <span className={cn("text-xs font-semibold", (balance ?? 0) < 0 ? "text-red-600" : "text-muted-foreground")}>
                      {fmtCurrency(balance ?? 0, currency)}
                    </span>
                  </div>
                </div>

                {/* ── Payments list ── */}
                {payments.length > 0 && (
                  <div className="mt-4">
                    <Separator className="mb-3" />
                    <div className="space-y-2">
                      {payments.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CircleDot className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                            <span className="text-muted-foreground">{fmtDateShort(p.date)}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="truncate">
                              {p.gateway}{p.notes ? ` (${p.notes})` : ""}{p.origin ? ` (${p.origin})` : ""}
                            </span>
                          </div>
                          <span className="font-medium shrink-0 ml-2">{fmtCurrency(p.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Depósito en Garantía */}
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold mb-3">Depósito en Garantía</h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Franquicia por daños</span>
                    <span className="text-xs">{fmtCurrency(franchiseDamage ?? 0, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Franquicia por vuelcos</span>
                    <span className="text-xs">{fmtCurrency(franchiseRollover ?? 0, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Franquicia por robos</span>
                    <span className="text-xs">{fmtCurrency(franchiseTheft ?? 0, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Franquicia por granizo</span>
                    <span className="text-xs">{fmtCurrency(franchiseHail ?? 0, currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gastos */}
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold mb-3">Gastos</h3>
                <p className="text-xs text-muted-foreground">Sin gastos registrados</p>
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
