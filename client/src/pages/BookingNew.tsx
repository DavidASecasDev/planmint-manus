/**
 * BookingNew — Single-page booking/quote creation form.
 *
 * Matches Rently's "Nueva Reserva" layout:
 *   - All fields visible at once (NOT a wizard)
 *   - Client is OPTIONAL (can save as quote without client data)
 *   - Header buttons: Guardar, Guardar Cotización, Enviar Cotización
 *   - Collapsible sections: Entrega/Devolución, Datos del cliente, Promoción
 *   - Right sidebar: Depósito en Garantía, Precio estimado, Extras
 *
 * Use case: agent receives a call → enters dates/category → sees price instantly
 * → gives quote to caller → if they want to book, fill in client data.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarIcon, Loader2, Car, MapPin, User, Phone, Mail, FileText,
  Euro, AlertTriangle, ArrowLeft, Package, UserPlus, Shield,
  Search, Plus, Minus, ChevronDown, ChevronUp, Save, Send,
  ClipboardCopy, Info, CheckCircle2, RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useRentlyActions } from "@/hooks/useRentlyActions";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { apiInvoke } from "@/lib/apiClient";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RentlyPlace {
  Id: number;
  Name: string;
  PlaceTypeId?: number;
  PlaceTypeName?: string;
}

interface RentlyCategory {
  Id: number;
  Name: string;
  Description?: string;
}

interface RentlyCustomer {
  Id: number;
  Firstname: string;
  Lastname: string;
  EmailAddress?: string;
  PhoneNumber?: string;
  CellPhone?: string;
  DocumentId?: string;
}

interface AvailableCar {
  Id: string;
  Brand?: string;
  Model?: string;
  CategoryName?: string;
  Color?: string;
  LicensePlate?: string;
}

interface AdditionalPriceItem {
  Id: number;
  Name: string;
  Description?: string;
  Price: number;
  DailyPrice: number;
  IsPriceByDay: boolean;
  IsDefault: boolean;
  IsRequired: boolean;
  MaxQuantityPerBooking: number;
  AvailableStock?: number;
  Type?: string;
  ImagePath?: string;
  Currency?: string;
  Order?: number;
}

interface SelectedAdditional {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  isPriceByDay: boolean;
  isRequired: boolean;
}

const PLACE_TYPE_LABELS: Record<number, string> = {
  1: "Oficinas",
  2: "Aeropuerto",
  3: "Puntos de Encuentro",
  4: "Domicilios",
};

const DOCUMENT_TYPES = [
  { id: 1, label: "DNI" },
  { id: 2, label: "Pasaporte" },
  { id: 3, label: "NIE" },
  { id: 4, label: "CIF" },
  { id: 5, label: "Otro" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?\d[\d\s\-().]{6,18}$/;

function validateEmail(email: string): string | null {
  if (!email.trim()) return null;
  if (!EMAIL_REGEX.test(email.trim())) return "Formato de email no válido";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null;
  const cleaned = phone.trim();
  if (!cleaned.startsWith("+")) return "Debe incluir prefijo (ej. +34)";
  if (!PHONE_REGEX.test(cleaned)) return "Formato no válido";
  return null;
}

const formatPrice = (value: number) => `${value.toFixed(2)} €`;

// ─── Component ──────────────────────────────────────────────────────────────

export default function BookingNew() {
  const navigate = useNavigate();
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const { session } = useAuth();
  const { createBooking, callAction, isLoading: actionLoading } = useRentlyActions();

  // Reference data
  const [places, setPlaces] = useState<RentlyPlace[]>([]);
  const [categories, setCategories] = useState<RentlyCategory[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // Section open/close
  const [deliveryOpen, setDeliveryOpen] = useState(true);
  const [clientOpen, setClientOpen] = useState(true);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // ─── Entrega / Devolución ──────────────────────────────────────────────
  const [checkAvail, setCheckAvail] = useState(true);
  const [kmType, setKmType] = useState("unlimited");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [fromTime, setFromTime] = useState("10:00");
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [toTime, setToTime] = useState("10:00");
  const [categoryId, setCategoryId] = useState<string>("");
  const [deliveryPlaceId, setDeliveryPlaceId] = useState<string>("");
  const [returnPlaceId, setReturnPlaceId] = useState<string>("");
  const [sameReturnPlace, setSameReturnPlace] = useState(true);
  const [selectedCar, setSelectedCar] = useState<string>("");

  // Availability results
  const [availableCars, setAvailableCars] = useState<AvailableCar[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [priceData, setPriceData] = useState<any>(null);
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // ─── Datos del cliente ─────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<RentlyCustomer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<RentlyCustomer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [custFirstname, setCustFirstname] = useState("");
  const [custLastname, setCustLastname] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custDocument, setCustDocument] = useState("");
  const [custDocumentTypeId, setCustDocumentTypeId] = useState<string>("1");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [custErrors, setCustErrors] = useState<{ email?: string; phone?: string }>({});
  const [customerOrigin, setCustomerOrigin] = useState("");

  // ─── Extras ────────────────────────────────────────────────────────────
  const [extras, setExtras] = useState<AdditionalPriceItem[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<SelectedAdditional[]>([]);

  // ─── Notes ─────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ─── Saving state ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ─── Load reference data ──────────────────────────────────────────────

  const loadReferenceData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingRef(true);
    try {
      const [placesRes, catsRes] = await Promise.all([
        apiInvoke<any>("rently-hub", { body: { action: "places" } }),
        apiInvoke<any>("rently-hub", { body: { action: "categories" } }),
      ]);
      if (placesRes.data?.data) setPlaces(placesRes.data.data);
      if (catsRes.data?.data) setCategories(catsRes.data.data);
    } catch (err) {
      console.error("Error loading Rently reference data:", err);
      toast.error("Error cargando datos de Rently");
    } finally {
      setLoadingRef(false);
    }
  }, [session?.access_token]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);

  // ─── Group places by type ─────────────────────────────────────────────

  const groupedPlaces = useMemo(() => {
    const groups: Record<string, RentlyPlace[]> = {};
    for (const p of places) {
      const key = p.PlaceTypeId ? (PLACE_TYPE_LABELS[p.PlaceTypeId] || `Tipo ${p.PlaceTypeId}`) : "Otros";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [places]);

  // ─── Datetime helper ──────────────────────────────────────────────────

  const buildDatetime = (date: Date, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  };

  // ─── Check availability + price ───────────────────────────────────────

  const handleCheckAvailability = useCallback(async () => {
    if (!fromDate || !toDate) {
      toast.error("Selecciona fechas de entrega y devolución");
      return;
    }
    if (!categoryId) {
      toast.error("Selecciona una categoría de vehículo");
      return;
    }
    if (!deliveryPlaceId) {
      toast.error("Selecciona un lugar de entrega");
      return;
    }
    setCheckingAvailability(true);
    setAvailableCars([]);
    setSelectedCar("");
    setPriceData(null);
    setHasChecked(false);
    try {
      const params: Record<string, any> = {
        fromDate: buildDatetime(fromDate, fromTime),
        toDate: buildDatetime(toDate, toTime),
        categoryId: Number(categoryId),
        deliveryPlaceId: Number(deliveryPlaceId),
      };
      if (!sameReturnPlace && returnPlaceId) {
        params.returnPlaceId = Number(returnPlaceId);
      } else {
        params.returnPlaceId = Number(deliveryPlaceId);
      }

      // search_availability returns cars WITH price data embedded (Price, AverageDayPrice, etc.)
      const [availRes, extrasRes] = await Promise.all([
        apiInvoke<any>("rently-hub", { body: { action: "search_availability", params } }),
        apiInvoke<any>("rently-hub", { body: { action: "additionals_price", params } }),
      ]);

      if (availRes.data?.data) {
        const rawCars = Array.isArray(availRes.data.data) ? availRes.data.data : [];
        // Map Rently search response to our AvailableCar interface
        const cars: AvailableCar[] = rawCars.map((item: any) => ({
          Id: item.Car?.Id || item.Id || "",
          Brand: item.Car?.Model?.Brand?.Name || item.Brand || "",
          Model: item.Car?.Model?.Name || item.Model || "",
          CategoryName: item.Category?.Name || "",
          Color: item.Car?.Color || "",
          LicensePlate: item.Car?.CurrentPlateId || item.Car?.Id || "",
        }));
        setAvailableCars(cars);

        // Use price from the first car result (all same category = same price)
        if (rawCars.length > 0) {
          const firstResult = rawCars[0];
          setPriceData({
            Price: firstResult.Price,
            AverageDayPrice: firstResult.AverageDayPrice,
            TotalDays: firstResult.TotalDays,
            TotalDaysString: firstResult.TotalDaysString,
            Currency: firstResult.Currency,
            Franchise: firstResult.Franchise,
            FranchiseDamage: firstResult.FranchiseDamage,
            FranchiseRollover: firstResult.FranchiseRollover,
            FranchiseTheft: firstResult.FranchiseTheft,
            FranchiseHail: firstResult.FranchiseHail,
            PriceItems: firstResult.PriceItems,
            PriceDetails: firstResult.PriceDetails,
          });
        }
      }
      setHasChecked(true);

      // Process extras
      if (extrasRes.data?.data) {
        const items: AdditionalPriceItem[] = Array.isArray(extrasRes.data.data) ? extrasRes.data.data : [];
        setExtras(items);
        const autoSelected: SelectedAdditional[] = [];
        for (const item of items) {
          if (item.IsRequired || item.IsDefault) {
            autoSelected.push({
              id: item.Id, name: item.Name, quantity: 1,
              unitPrice: item.IsPriceByDay ? item.DailyPrice : item.Price,
              isPriceByDay: item.IsPriceByDay, isRequired: item.IsRequired,
            });
          }
        }
        setSelectedExtras(autoSelected);
        if (items.length > 0) setExtrasOpen(true);
      }
    } catch (err: any) {
      console.error("Availability check error:", err);
      toast.error(err?.message || "Error consultando disponibilidad");
    } finally {
      setCheckingAvailability(false);
      setLoadingExtras(false);
    }
  }, [fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId, returnPlaceId, sameReturnPlace]);

  // ─── Customer search ──────────────────────────────────────────────────

  const searchCustomers = useCallback(async () => {
    if (!customerSearch.trim() || customerSearch.trim().length < 2) return;
    setSearchingCustomer(true);
    try {
      const res = await apiInvoke<any>("rently-hub", {
        body: { action: "search_customers", params: { query: customerSearch.trim() } },
      });
      if (res.data?.data) {
        setSearchResults(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch {
      toast.error("Error buscando clientes");
    } finally {
      setSearchingCustomer(false);
    }
  }, [customerSearch]);

  // ─── Create new customer ──────────────────────────────────────────────

  const handleCreateCustomer = useCallback(async () => {
    if (!custFirstname.trim() || !custLastname.trim()) {
      toast.error("Nombre y apellido son obligatorios");
      return;
    }
    const emailErr = validateEmail(custEmail);
    const phoneErr = validatePhone(custPhone);
    if (emailErr || phoneErr) {
      setCustErrors({ email: emailErr || undefined, phone: phoneErr || undefined });
      return;
    }
    setCustErrors({});
    setCreatingCustomer(true);
    try {
      const customerData: Record<string, any> = {
        Firstname: custFirstname.trim(),
        Lastname: custLastname.trim(),
        DocumentTypeId: Number(custDocumentTypeId),
      };
      if (custEmail.trim()) customerData.EmailAddress = custEmail.trim();
      if (custPhone.trim()) customerData.CellPhone = custPhone.trim();
      if (custDocument.trim()) customerData.DocumentId = custDocument.trim();

      const result = await callAction("customer.create", customerData, undefined, { silent: true });
      if (result.success && result.data) {
        const newCust: RentlyCustomer = {
          Id: result.data.Id || result.data.id || 0,
          Firstname: custFirstname.trim(),
          Lastname: custLastname.trim(),
          EmailAddress: custEmail.trim() || undefined,
          CellPhone: custPhone.trim() || undefined,
          DocumentId: custDocument.trim() || undefined,
        };
        setSelectedCustomer(newCust);
        setShowNewCustomerForm(false);
        toast.success(`Cliente "${custFirstname} ${custLastname}" creado en Rently`);
      } else {
        toast.error(result.error || "Error al crear cliente en Rently");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al crear cliente");
    } finally {
      setCreatingCustomer(false);
    }
  }, [custFirstname, custLastname, custEmail, custPhone, custDocument, custDocumentTypeId, callAction]);

  // ─── Extras helpers ───────────────────────────────────────────────────

  const toggleExtra = useCallback((item: AdditionalPriceItem) => {
    setSelectedExtras((prev) => {
      const existing = prev.find((e) => e.id === item.Id);
      if (existing) {
        if (item.IsRequired) return prev;
        return prev.filter((e) => e.id !== item.Id);
      }
      return [...prev, {
        id: item.Id, name: item.Name, quantity: 1,
        unitPrice: item.IsPriceByDay ? item.DailyPrice : item.Price,
        isPriceByDay: item.IsPriceByDay, isRequired: item.IsRequired,
      }];
    });
  }, []);

  const updateExtraQuantity = useCallback((itemId: number, delta: number) => {
    setSelectedExtras((prev) =>
      prev.map((e) => e.id !== itemId ? e : { ...e, quantity: Math.max(1, e.quantity + delta) })
    );
  }, []);

  // ─── Computed values ──────────────────────────────────────────────────

  const totalDays = useMemo(() => {
    if (!fromDate || !toDate) return 1;
    const diffMs = toDate.getTime() - fromDate.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [fromDate, toDate]);

  const extrasTotal = useMemo(() => {
    return selectedExtras.reduce((sum, e) => {
      const price = e.isPriceByDay ? e.unitPrice * totalDays * e.quantity : e.unitPrice * e.quantity;
      return sum + price;
    }, 0);
  }, [selectedExtras, totalDays]);

  const getBasePrice = (): number | null => {
    if (!priceData) return null;
    if (typeof priceData === "number") return priceData;
    if (priceData?.TotalPrice != null) return Number(priceData.TotalPrice);
    if (priceData?.Price != null) return Number(priceData.Price);
    return null;
  };

  const basePrice = getBasePrice();
  const estimatedTotal = basePrice != null ? basePrice + extrasTotal : null;

  const hasClient = !!(selectedCustomer || (custFirstname.trim() && custLastname.trim()));
  const canSave = !!(fromDate && toDate && categoryId);

  // ─── Submit ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async (asQuotation: boolean) => {
    if (!fromDate || !toDate || !categoryId) {
      toast.error("Selecciona fechas y categoría antes de guardar");
      return;
    }

    if (!asQuotation && !hasClient) {
      toast.error("Para guardar como reserva, introduce los datos del cliente");
      return;
    }

    setSaving(true);
    try {
      const customer: Record<string, any> = {};
      if (selectedCustomer) {
        customer.Id = selectedCustomer.Id;
        customer.Firstname = selectedCustomer.Firstname;
        customer.Lastname = selectedCustomer.Lastname;
        customer.EmailAddress = selectedCustomer.EmailAddress || "";
      } else if (hasClient) {
        customer.Firstname = custFirstname;
        customer.Lastname = custLastname;
        customer.EmailAddress = custEmail || "";
        customer.CellPhone = custPhone || "";
        customer.DocumentId = custDocument || "";
      }

      const additionals = selectedExtras.map((e) => ({
        Additional: { Id: e.id },
        Quantity: e.quantity,
      }));

      const payload: Record<string, any> = {
        Category: { Id: Number(categoryId) },
        FromDate: buildDatetime(fromDate, fromTime),
        ToDate: buildDatetime(toDate, toTime),
        DeliveryPlace: { Id: Number(deliveryPlaceId || 1) },
        ReturnPlace: { Id: Number(sameReturnPlace ? (deliveryPlaceId || 1) : (returnPlaceId || deliveryPlaceId || 1)) },
        IsQuotation: asQuotation,
        Currency: "EUR",
        Notes: notes || undefined,
      };

      // Only include customer if we have one
      if (Object.keys(customer).length > 0) {
        payload.Customer = customer;
      }

      if (additionals.length > 0) payload.Additionals = additionals;
      if (selectedCar) payload.Car = { Id: selectedCar };

      const result = await createBooking(payload);
      if (result.success) {
        toast.success(asQuotation
          ? "Cotización guardada en Rently"
          : "Reserva creada en Rently y sincronizada con PlanMint"
        );
        navigate("/bookings");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [
    fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId,
    returnPlaceId, sameReturnPlace, selectedCustomer, custFirstname,
    custLastname, custEmail, custPhone, custDocument, selectedCar,
    selectedExtras, notes, hasClient, createBooking, navigate,
  ]);

  // ─── Permission gate ──────────────────────────────────────────────────

  if (permLoading) {
    return (
      <AppLayout title="Nueva Reserva">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPermission("rently.booking_create") && !hasPermission("rently.manage")) {
    return (
      <AppLayout title="Nueva Reserva">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <h2 className="text-lg font-semibold">Sin permisos</h2>
          <p className="text-sm text-muted-foreground">No tienes permisos para crear reservas en Rently.</p>
          <Button variant="outline" onClick={() => navigate("/bookings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Volver al listado
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <AppLayout title="Nueva Reserva" fullWidth>
      <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-[1400px] mx-auto">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/bookings")}
              className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <h1 className="text-xl font-bold text-foreground">Nueva Reserva</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={!canSave || saving || actionLoading}
              onClick={() => handleSave(true)}
            >
              <FileText className="h-3.5 w-3.5" />
              Guardar Cotización
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!canSave || !hasClient || saving || actionLoading}
              onClick={() => handleSave(false)}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar Reserva
            </Button>
          </div>
        </div>

        {loadingRef ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando datos de Rently...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

            {/* ═══ LEFT: Main Form ═══ */}
            <div className="space-y-4">

              {/* ── Section 1: Entrega | Devolución ── */}
              <Card className="rounded-xl border shadow-sm">
                <Collapsible open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Entrega | Devolución</span>
                      </div>
                      {deliveryOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 pb-5 space-y-4">
                      <Separator />

                      {/* Row 1: Options */}
                      <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checkAvail}
                            onCheckedChange={(v) => setCheckAvail(!!v)}
                          />
                          Chequear Disponibilidad?
                        </label>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Kilómetros</Label>
                          <Select value={kmType} onValueChange={setKmType}>
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unlimited">Km Ilimitados</SelectItem>
                              <SelectItem value="limited">Km Limitados</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Row 2: Category */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Categoría / Grupo</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecciona categoría..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.Id} value={String(c.Id)}>
                                {c.Name}{c.Description ? ` — ${c.Description}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Row 3: Places */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Lugar de Entrega</Label>
                          <Select value={deliveryPlaceId} onValueChange={(v) => {
                            setDeliveryPlaceId(v);
                            if (sameReturnPlace) setReturnPlaceId(v);
                          }}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecciona lugar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(groupedPlaces).map(([group, items]) => (
                                <SelectGroup key={group}>
                                  <SelectLabel>{group}</SelectLabel>
                                  {items.map((p) => (
                                    <SelectItem key={p.Id} value={String(p.Id)}>{p.Name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs text-muted-foreground">Lugar de Devolución</Label>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Checkbox
                                checked={sameReturnPlace}
                                onCheckedChange={(v) => {
                                  setSameReturnPlace(!!v);
                                  if (v) setReturnPlaceId(deliveryPlaceId);
                                }}
                                className="h-3.5 w-3.5"
                              />
                              Mismo lugar
                            </label>
                          </div>
                          <Select
                            value={sameReturnPlace ? deliveryPlaceId : returnPlaceId}
                            onValueChange={setReturnPlaceId}
                            disabled={sameReturnPlace}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecciona lugar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(groupedPlaces).map(([group, items]) => (
                                <SelectGroup key={group}>
                                  <SelectLabel>{group}</SelectLabel>
                                  {items.map((p) => (
                                    <SelectItem key={p.Id} value={String(p.Id)}>{p.Name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Row 4: Dates + Times */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* From Date */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Fecha de Entrega</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left h-9 text-xs font-normal", !fromDate && "text-muted-foreground")}>
                                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                                {fromDate ? format(fromDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={fromDate} onSelect={setFromDate} locale={es} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        {/* From Time */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Desde las</Label>
                          <Select value={fromTime} onValueChange={setFromTime}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={`from-${t}`} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* To Date */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Fecha de Devolución</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left h-9 text-xs font-normal", !toDate && "text-muted-foreground")}>
                                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                                {toDate ? format(toDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={toDate} onSelect={setToDate} locale={es} disabled={(date) => fromDate ? date < fromDate : false} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        {/* To Time */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Hasta las</Label>
                          <Select value={toTime} onValueChange={setToTime}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={`to-${t}`} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Row 5: Vehicle selector (after availability check) */}
                      {availableCars.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Auto (opcional)</Label>
                          <Select value={selectedCar} onValueChange={setSelectedCar}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Asignar vehículo específico..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar (automático)</SelectItem>
                              {availableCars.map((car) => (
                                <SelectItem key={car.Id} value={String(car.Id)}>
                                  {car.LicensePlate || ""} {car.Brand || ""} {car.Model || ""} {car.Color ? `(${car.Color})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Check Availability Button */}
                      <div className="pt-1">
                        <Button
                          onClick={handleCheckAvailability}
                          disabled={!fromDate || !toDate || !categoryId || checkingAvailability}
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          {checkingAvailability
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Search className="h-4 w-4" />
                          }
                          Consultar Disponibilidad y Precio
                        </Button>

                        {hasChecked && availableCars.length === 0 && (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            No hay vehículos disponibles para esta combinación
                          </p>
                        )}
                        {hasChecked && availableCars.length > 0 && (
                          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {availableCars.length} vehículo{availableCars.length !== 1 ? "s" : ""} disponible{availableCars.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* ── Section 2: Datos del cliente ── */}
              <Card className="rounded-xl border shadow-sm">
                <Collapsible open={clientOpen} onOpenChange={setClientOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Datos del cliente</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground border-muted-foreground/30">
                          Opcional para cotización
                        </Badge>
                      </div>
                      {clientOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 pb-5 space-y-4">
                      <Separator />

                      {/* Selected customer display */}
                      {selectedCustomer && (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-emerald-900">
                              {selectedCustomer.Firstname} {selectedCustomer.Lastname}
                            </p>
                            <p className="text-xs text-emerald-700">
                              {selectedCustomer.EmailAddress || ""} {selectedCustomer.DocumentId ? `· ${selectedCustomer.DocumentId}` : ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-emerald-700 hover:text-red-600"
                            onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); setSearchResults([]); }}
                          >
                            Cambiar
                          </Button>
                        </div>
                      )}

                      {/* Search existing customer */}
                      {!selectedCustomer && !showNewCustomerForm && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <Input
                                placeholder="Buscar cliente por nombre, email o documento..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
                                className="h-9 text-sm pr-8"
                              />
                              {searchingCustomer && (
                                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            <Button size="sm" variant="outline" onClick={searchCustomers} disabled={searchingCustomer || customerSearch.trim().length < 2}>
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowNewCustomerForm(true)} className="gap-1 text-xs">
                              <UserPlus className="h-3.5 w-3.5" />
                              Nuevo
                            </Button>
                          </div>

                          {/* Search results */}
                          {searchResults.length > 0 && (
                            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                              {searchResults.map((c) => (
                                <button
                                  key={c.Id}
                                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                                  onClick={() => { setSelectedCustomer(c); setSearchResults([]); setCustomerSearch(""); }}
                                >
                                  <p className="text-sm font-medium">{c.Firstname} {c.Lastname}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {c.EmailAddress || ""} {c.DocumentId ? `· ${c.DocumentId}` : ""} {c.CellPhone || c.PhoneNumber || ""}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground mb-1 block">Origen</Label>
                              <Select value={customerOrigin} onValueChange={setCustomerOrigin}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Seleccione un origen" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="direct">Directo</SelectItem>
                                  <SelectItem value="web">Web</SelectItem>
                                  <SelectItem value="phone">Teléfono</SelectItem>
                                  <SelectItem value="agency">Agencia</SelectItem>
                                  <SelectItem value="referral">Referido</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground mb-1 block">Moneda</Label>
                              <Select defaultValue="EUR">
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EUR">Euro</SelectItem>
                                  <SelectItem value="USD">Dólar</SelectItem>
                                  <SelectItem value="GBP">Libra</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* New customer form */}
                      {!selectedCustomer && showNewCustomerForm && (
                        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium flex items-center gap-1.5">
                              <UserPlus className="h-4 w-4" />
                              Nuevo cliente
                            </h4>
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowNewCustomerForm(false)}>
                              Cancelar
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Nombre *</Label>
                              <Input className="h-8 text-sm mt-1" value={custFirstname} onChange={(e) => setCustFirstname(e.target.value)} placeholder="Nombre" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Apellido *</Label>
                              <Input className="h-8 text-sm mt-1" value={custLastname} onChange={(e) => setCustLastname(e.target.value)} placeholder="Apellido" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <Input className="h-8 text-sm mt-1" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="email@ejemplo.com" type="email" />
                              {custErrors.email && <p className="text-[10px] text-red-500 mt-0.5">{custErrors.email}</p>}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Teléfono</Label>
                              <Input className="h-8 text-sm mt-1" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+34 600 000 000" />
                              {custErrors.phone && <p className="text-[10px] text-red-500 mt-0.5">{custErrors.phone}</p>}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Tipo documento</Label>
                              <Select value={custDocumentTypeId} onValueChange={setCustDocumentTypeId}>
                                <SelectTrigger className="h-8 text-xs mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DOCUMENT_TYPES.map((dt) => (
                                    <SelectItem key={dt.id} value={String(dt.id)}>{dt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Nº Documento</Label>
                              <Input className="h-8 text-sm mt-1" value={custDocument} onChange={(e) => setCustDocument(e.target.value)} placeholder="12345678A" />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleCreateCustomer}
                            disabled={creatingCustomer || !custFirstname.trim() || !custLastname.trim()}
                          >
                            {creatingCustomer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            Crear cliente en Rently
                          </Button>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* ── Section 3: Extras / Adicionales ── */}
              {extras.length > 0 && (
                <Card className="rounded-xl border shadow-sm">
                  <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">Extras / Adicionales</span>
                          {selectedExtras.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {selectedExtras.length} seleccionado{selectedExtras.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {extrasOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-5 pb-5">
                        <Separator className="mb-4" />
                        {loadingExtras ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {extras.map((item) => {
                              const sel = selectedExtras.find((e) => e.id === item.Id);
                              const isSelected = !!sel;
                              const price = item.IsPriceByDay ? item.DailyPrice : item.Price;
                              return (
                                <div
                                  key={item.Id}
                                  className={cn(
                                    "flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition-all",
                                    isSelected ? "border-emerald-300 bg-emerald-50" : "hover:border-muted-foreground/30",
                                    item.IsRequired && "opacity-80 cursor-default"
                                  )}
                                  onClick={() => !item.IsRequired && toggleExtra(item)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Checkbox checked={isSelected} disabled={item.IsRequired} className="shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate">{item.Name}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {formatPrice(price)}{item.IsPriceByDay ? "/día" : ""}
                                        {item.IsRequired && " · Obligatorio"}
                                      </p>
                                    </div>
                                  </div>
                                  {isSelected && !item.IsRequired && item.MaxQuantityPerBooking > 1 && (
                                    <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                      <button className="p-0.5 rounded hover:bg-muted" onClick={() => updateExtraQuantity(item.Id, -1)}>
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="text-xs w-5 text-center">{sel?.quantity || 1}</span>
                                      <button className="p-0.5 rounded hover:bg-muted" onClick={() => updateExtraQuantity(item.Id, 1)}>
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

              {/* ── Section 4: Notas ── */}
              <Card className="rounded-xl border shadow-sm">
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">Notas internas</span>
                      </div>
                      {notesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 pb-5">
                      <Separator className="mb-3" />
                      <Textarea
                        placeholder="Notas internas sobre esta reserva..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>

            {/* ═══ RIGHT: Sidebar ═══ */}
            <div className="space-y-4">

              {/* Precio estimado */}
              <Card className="rounded-xl border shadow-sm sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Euro className="h-4 w-4 text-emerald-600" />
                    Precio Estimado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!hasChecked ? (
                    <div className="text-center py-4">
                      <Info className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Introduce fechas y categoría, luego pulsa "Consultar Disponibilidad" para ver el precio
                      </p>
                    </div>
                  ) : checkingPrice ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Days */}
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Duración</span>
                        <span className="font-medium">{totalDays} día{totalDays !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Base price */}
                      {basePrice != null && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Alquiler base</span>
                          <span className="font-medium">{formatPrice(basePrice)}</span>
                        </div>
                      )}

                      {/* Extras subtotal */}
                      {extrasTotal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Extras ({selectedExtras.length})</span>
                          <span className="font-medium">{formatPrice(extrasTotal)}</span>
                        </div>
                      )}

                      <Separator />

                      {/* Total */}
                      {estimatedTotal != null && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm font-semibold">TOTAL</span>
                          <span className="text-lg font-bold text-emerald-600">{formatPrice(estimatedTotal)}</span>
                        </div>
                      )}

                      {basePrice == null && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          No se pudo obtener el precio
                        </p>
                      )}

                      {/* Per day */}
                      {basePrice != null && totalDays > 0 && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          {formatPrice(basePrice / totalDays)}/día (base)
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Depósito en Garantía */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    Depósito en Garantía
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {priceData?.Franchise != null ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Franquicia por daños</span>
                        <span className="font-medium">{formatPrice(priceData.FranchiseDamage ?? priceData.Franchise)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Franquicia por vuelcos</span>
                        <span className="font-medium">{formatPrice(priceData.FranchiseRollover ?? priceData.Franchise)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Franquicia por robos</span>
                        <span className="font-medium">{formatPrice(priceData.FranchiseTheft ?? priceData.Franchise)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Franquicia por granizo</span>
                        <span className="font-medium">{formatPrice(priceData.FranchiseHail ?? priceData.Franchise)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Franquicia por daños</p>
                      <p className="text-xs text-muted-foreground">Franquicia por vuelcos</p>
                      <p className="text-xs text-muted-foreground">Franquicia por robos</p>
                      <p className="text-xs text-muted-foreground">Franquicia por granizo</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-2">
                        Los importes se calcularán según la categoría seleccionada
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Quick info */}
              <Card className="rounded-xl border shadow-sm bg-blue-50/50">
                <CardContent className="py-4 space-y-2">
                  <p className="text-xs font-medium text-blue-900 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Flujo rápido
                  </p>
                  <ul className="text-[11px] text-blue-800 space-y-1 ml-5 list-disc">
                    <li><strong>Cotización:</strong> Guarda sin datos de cliente para dar un presupuesto rápido</li>
                    <li><strong>Reserva:</strong> Requiere datos del cliente para formalizar</li>
                    <li>Puedes convertir una cotización en reserva después desde el detalle</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
