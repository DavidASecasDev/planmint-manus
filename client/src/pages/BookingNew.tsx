/**
 * BookingNew — Full-page step-by-step booking creation wizard.
 *
 * Steps:
 * 1. Datos: Fechas, categoría, lugares, cliente
 * 2. Disponibilidad: Vehículos disponibles + precio estimado
 * 3. Extras: Adicionales y accesorios
 * 4. Confirmar: Resumen y envío a Rently
 *
 * Reuses the same Rently API calls as CreateRentlyBookingDialog but in a
 * full-page layout with better UX and draft persistence.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarIcon, Plus, Minus, Search, Loader2, Car, MapPin,
  User, Phone, Mail, FileText, Euro, CheckCircle2, AlertTriangle,
  ChevronRight, ArrowLeft, Package, UserPlus, CreditCard, Shield,
  Check, Info,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, label: "Datos" },
  { id: 2, label: "Disponibilidad" },
  { id: 3, label: "Extras" },
  { id: 4, label: "Confirmar" },
];

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
  if (!cleaned.startsWith("+")) return "El teléfono debe incluir prefijo internacional (ej. +34)";
  if (!PHONE_REGEX.test(cleaned)) return "Formato de teléfono no válido";
  return null;
}

const RENTLY_IMG_BASE = "https://app.rfrently.com";

// ─── Component ──────────────────────────────────────────────────────────────

export default function BookingNew() {
  const navigate = useNavigate();
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const { session } = useAuth();
  const { createBooking, callAction, isLoading: actionLoading } = useRentlyActions();

  const [step, setStep] = useState<Step>(1);

  // Reference data
  const [places, setPlaces] = useState<RentlyPlace[]>([]);
  const [categories, setCategories] = useState<RentlyCategory[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // Step 1 — Dates & details
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [fromTime, setFromTime] = useState("10:00");
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [toTime, setToTime] = useState("10:00");
  const [categoryId, setCategoryId] = useState<string>("");
  const [deliveryPlaceId, setDeliveryPlaceId] = useState<string>("");
  const [returnPlaceId, setReturnPlaceId] = useState<string>("");
  const [sameReturnPlace, setSameReturnPlace] = useState(true);

  // Customer
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

  // Step 2 — Availability
  const [availableCars, setAvailableCars] = useState<AvailableCar[]>([]);
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [priceData, setPriceData] = useState<any>(null);
  const [checkingPrice, setCheckingPrice] = useState(false);

  // Step 3 — Extras
  const [extras, setExtras] = useState<AdditionalPriceItem[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<SelectedAdditional[]>([]);

  // Notes
  const [notes, setNotes] = useState("");
  const [isQuotation, setIsQuotation] = useState(false);

  // ─── Load reference data ────────────────────────────────────────────────

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

  // ─── Datetime helper ──────────────────────────────────────────────────

  const buildDatetime = (date: Date, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  };

  // ─── Check availability ───────────────────────────────────────────────

  const checkAvailability = useCallback(async () => {
    if (!fromDate || !toDate || !categoryId) {
      toast.error("Selecciona fechas y categoría");
      return;
    }
    setCheckingAvailability(true);
    setAvailableCars([]);
    setSelectedCar("");
    setPriceData(null);
    try {
      const params: Record<string, any> = {
        fromDate: buildDatetime(fromDate, fromTime),
        toDate: buildDatetime(toDate, toTime),
        categoryId: Number(categoryId),
      };
      if (deliveryPlaceId) params.deliveryPlaceId = Number(deliveryPlaceId);
      if (!sameReturnPlace && returnPlaceId) params.returnPlaceId = Number(returnPlaceId);

      const res = await apiInvoke<any>("rently-hub", {
        body: { action: "search_availability", params },
      });
      if (res.data?.data) {
        const cars = Array.isArray(res.data.data) ? res.data.data : [];
        setAvailableCars(cars);
        if (cars.length === 0) toast.warning("No hay vehículos disponibles para esa combinación");
      }

      // Also fetch price
      setCheckingPrice(true);
      const priceRes = await apiInvoke<any>("rently-hub", {
        body: { action: "booking_price", params },
      });
      if (priceRes.data?.data) setPriceData(priceRes.data.data);
    } catch {
      toast.error("Error consultando disponibilidad");
    } finally {
      setCheckingAvailability(false);
      setCheckingPrice(false);
    }
  }, [fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId, returnPlaceId, sameReturnPlace]);

  // ─── Load extras ──────────────────────────────────────────────────────

  const loadExtras = useCallback(async () => {
    if (!fromDate || !toDate || !categoryId) return;
    setLoadingExtras(true);
    try {
      const params: Record<string, any> = {
        fromDate: buildDatetime(fromDate, fromTime),
        toDate: buildDatetime(toDate, toTime),
        categoryId: Number(categoryId),
      };
      if (deliveryPlaceId) params.deliveryPlaceId = Number(deliveryPlaceId);
      if (!sameReturnPlace && returnPlaceId) params.returnPlaceId = Number(returnPlaceId);

      const res = await apiInvoke<any>("rently-hub", {
        body: { action: "additionals_price", params },
      });
      if (res.data?.data) {
        const items: AdditionalPriceItem[] = Array.isArray(res.data.data) ? res.data.data : [];
        setExtras(items);
        const autoSelected: SelectedAdditional[] = [];
        for (const item of items) {
          if (item.IsRequired || item.IsDefault) {
            autoSelected.push({
              id: item.Id,
              name: item.Name,
              quantity: 1,
              unitPrice: item.IsPriceByDay ? item.DailyPrice : item.Price,
              isPriceByDay: item.IsPriceByDay,
              isRequired: item.IsRequired,
            });
          }
        }
        setSelectedExtras(autoSelected);
      }
    } catch (err) {
      console.error("Error loading extras:", err);
    } finally {
      setLoadingExtras(false);
    }
  }, [fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId, returnPlaceId, sameReturnPlace]);

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

  // ─── Submit booking ───────────────────────────────────────────────────

  const handleCreateBooking = useCallback(async () => {
    if (!fromDate || !toDate || !categoryId) {
      toast.error("Faltan datos obligatorios");
      return;
    }

    const customer: Record<string, any> = {};
    if (selectedCustomer) {
      customer.Id = selectedCustomer.Id;
      customer.Firstname = selectedCustomer.Firstname;
      customer.Lastname = selectedCustomer.Lastname;
      customer.EmailAddress = selectedCustomer.EmailAddress || "";
    } else {
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
      Customer: customer,
      IsQuotation: isQuotation,
      Currency: "EUR",
      Notes: notes || undefined,
    };

    if (additionals.length > 0) payload.Additionals = additionals;
    if (selectedCar) payload.Car = { Id: selectedCar };

    const result = await createBooking(payload);
    if (result.success) {
      toast.success("Reserva creada en Rently y sincronizada con PlanMint");
      navigate("/bookings");
    }
  }, [
    fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId,
    returnPlaceId, sameReturnPlace, selectedCustomer, custFirstname,
    custLastname, custEmail, custPhone, custDocument, selectedCar,
    selectedExtras, notes, isQuotation, createBooking, navigate,
  ]);

  // ─── Validation ───────────────────────────────────────────────────────

  const canProceedToStep2 = fromDate && toDate && categoryId && deliveryPlaceId &&
    (selectedCustomer || (custFirstname && custLastname));

  // ─── Price display helper ─────────────────────────────────────────────

  const getBasePrice = (): number | null => {
    if (!priceData) return null;
    if (typeof priceData === "number") return priceData;
    if (priceData?.TotalPrice != null) return Number(priceData.TotalPrice);
    if (priceData?.Price != null) return Number(priceData.Price);
    return null;
  };

  const formatPrice = (value: number) => `${value.toFixed(2)} €`;

  // ─── Navigation helpers ───────────────────────────────────────────────

  const goBack = () => {
    if (step === 1) navigate("/bookings");
    else setStep((step - 1) as Step);
  };

  const goNext = () => {
    if (step === 1) { setStep(2); checkAvailability(); }
    else if (step === 2) { setStep(3); loadExtras(); }
    else if (step === 3) { setStep(4); }
  };

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

  if (!hasPermission("rently.booking_create")) {
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition-opacity text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {step > 1 ? "Paso anterior" : "Volver al listado"}
          </button>

          <h1 className="text-2xl font-bold mb-1 text-foreground">
            Nueva Reserva en Rently
          </h1>
          <p className="text-sm text-muted-foreground">
            Paso {step} de 4 — {STEPS[step - 1].label}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all",
                  step > s.id
                    ? "bg-emerald-500 text-white"
                    : step === s.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span className={cn("text-xs hidden sm:block", step >= s.id ? "text-foreground font-medium" : "text-muted-foreground")}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-px", step > s.id ? "bg-emerald-500" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Loading reference data */}
        {loadingRef ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando datos de Rently...</span>
          </div>
        ) : (
          <>
            {/* ═══ STEP 1: Datos ═══ */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Dates */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" /> Fechas del alquiler
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Recogida *</Label>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn("flex-1 justify-start text-left font-normal text-sm", !fromDate && "text-muted-foreground")}
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                {fromDate ? format(fromDate, "dd/MM/yyyy") : "Fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={fromDate}
                                onSelect={setFromDate}
                                locale={es}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              />
                            </PopoverContent>
                          </Popover>
                          <Input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="w-24 text-sm" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Devolución *</Label>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn("flex-1 justify-start text-left font-normal text-sm", !toDate && "text-muted-foreground")}
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                {toDate ? format(toDate, "dd/MM/yyyy") : "Fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={toDate}
                                onSelect={setToDate}
                                locale={es}
                                disabled={(date) => fromDate ? date < fromDate : date < new Date(new Date().setHours(0, 0, 0, 0))}
                              />
                            </PopoverContent>
                          </Popover>
                          <Input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} className="w-24 text-sm" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Category */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Car className="h-4 w-4" /> Categoría *
                    </h3>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Seleccionar categoría de vehículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.Id} value={String(c.Id)}>{c.Name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Places */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Lugares
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Lugar de recogida *</Label>
                        <Select value={deliveryPlaceId} onValueChange={setDeliveryPlaceId}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Seleccionar lugar" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(groupedPlaces).map(([group, items]) => (
                              <SelectGroup key={group}>
                                <SelectLabel className="text-xs font-semibold text-muted-foreground">{group}</SelectLabel>
                                {items.map((p) => (
                                  <SelectItem key={p.Id} value={String(p.Id)}>{p.Name}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sameReturn"
                          checked={sameReturnPlace}
                          onChange={(e) => setSameReturnPlace(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="sameReturn" className="text-xs text-muted-foreground cursor-pointer">
                          Mismo lugar de devolución
                        </Label>
                      </div>

                      {!sameReturnPlace && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Lugar de devolución</Label>
                          <Select value={returnPlaceId} onValueChange={setReturnPlaceId}>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Seleccionar lugar" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(groupedPlaces).map(([group, items]) => (
                                <SelectGroup key={group}>
                                  <SelectLabel className="text-xs font-semibold text-muted-foreground">{group}</SelectLabel>
                                  {items.map((p) => (
                                    <SelectItem key={p.Id} value={String(p.Id)}>{p.Name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Customer */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <User className="h-4 w-4" /> Cliente *
                    </h3>

                    {!selectedCustomer && !showNewCustomerForm && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Buscar por nombre, email o documento..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
                            className="text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={searchCustomers}
                            disabled={searchingCustomer || customerSearch.trim().length < 2}
                          >
                            {searchingCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                        </div>

                        {searchResults.length > 0 && (
                          <div className="border rounded-md max-h-48 overflow-y-auto">
                            {searchResults.map((c) => (
                              <button
                                key={c.Id}
                                className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-center justify-between border-b last:border-b-0"
                                onClick={() => { setSelectedCustomer(c); setSearchResults([]); }}
                              >
                                <span className="font-medium">{c.Firstname} {c.Lastname}</span>
                                <span className="text-xs text-muted-foreground">{c.EmailAddress || c.DocumentId || ""}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowNewCustomerForm(true)}>
                          <UserPlus className="h-3.5 w-3.5" />
                          Crear nuevo cliente
                        </Button>
                      </div>
                    )}

                    {selectedCustomer && (
                      <div className="bg-accent/50 rounded-md p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            {selectedCustomer.Firstname} {selectedCustomer.Lastname}
                          </p>
                          <p className="text-xs text-muted-foreground ml-5">
                            {[selectedCustomer.EmailAddress, selectedCustomer.CellPhone || selectedCustomer.PhoneNumber, selectedCustomer.DocumentId].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); setShowNewCustomerForm(false); }}>
                          Cambiar
                        </Button>
                      </div>
                    )}

                    {showNewCustomerForm && !selectedCustomer && (
                      <div className="space-y-4 border border-dashed border-primary/30 rounded-lg p-5 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <UserPlus className="h-4 w-4 text-primary" /> Nuevo cliente
                          </span>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setShowNewCustomerForm(false); setCustFirstname(""); setCustLastname(""); setCustEmail(""); setCustPhone(""); setCustDocument(""); setCustDocumentTypeId("1"); setCustErrors({}); }}>
                            Cancelar
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nombre *</Label>
                            <Input value={custFirstname} onChange={(e) => setCustFirstname(e.target.value)} placeholder="Nombre" className="text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Apellido *</Label>
                            <Input value={custLastname} onChange={(e) => setCustLastname(e.target.value)} placeholder="Apellido" className="text-sm" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                            <Input
                              type="email" value={custEmail}
                              onChange={(e) => { setCustEmail(e.target.value); if (custErrors.email) setCustErrors((prev) => ({ ...prev, email: undefined })); }}
                              placeholder="email@ejemplo.com"
                              className={cn("text-sm", custErrors.email && "border-destructive")}
                            />
                            {custErrors.email && <p className="text-[11px] text-destructive">{custErrors.email}</p>}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono</Label>
                            <Input
                              value={custPhone}
                              onChange={(e) => { setCustPhone(e.target.value); if (custErrors.phone) setCustErrors((prev) => ({ ...prev, phone: undefined })); }}
                              placeholder="+34 612 345 678"
                              className={cn("text-sm", custErrors.phone && "border-destructive")}
                            />
                            {custErrors.phone && <p className="text-[11px] text-destructive">{custErrors.phone}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" /> Tipo doc.</Label>
                            <Select value={custDocumentTypeId} onValueChange={setCustDocumentTypeId}>
                              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DOCUMENT_TYPES.map((dt) => (
                                  <SelectItem key={dt.id} value={String(dt.id)}>{dt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs flex items-center gap-1"><FileText className="h-3 w-3" /> N.° Documento</Label>
                            <Input value={custDocument} onChange={(e) => setCustDocument(e.target.value)} placeholder="12345678A" className="text-sm" />
                          </div>
                        </div>

                        <Button size="sm" className="w-full gap-1.5" onClick={handleCreateCustomer} disabled={creatingCustomer || !custFirstname.trim() || !custLastname.trim()}>
                          {creatingCustomer ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando en Rently...</> : <><CheckCircle2 className="h-4 w-4" /> Crear cliente en Rently</>}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Notes + Quotation */}
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales..." rows={2} className="text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isQuotation" checked={isQuotation} onChange={(e) => setIsQuotation(e.target.checked)} className="rounded" />
                      <Label htmlFor="isQuotation" className="text-xs text-muted-foreground cursor-pointer">
                        Crear como cotización (no como reserva confirmada)
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Next button */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => navigate("/bookings")}>Cancelar</Button>
                  <Button onClick={goNext} disabled={!canProceedToStep2}>
                    Siguiente: Disponibilidad
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Disponibilidad ═══ */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Price info */}
                {checkingPrice ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Consultando precio...
                  </div>
                ) : priceData && (
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <Euro className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-sm">Precio base estimado</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">
                        {getBasePrice() != null ? formatPrice(getBasePrice()!) : "Consultar"}
                      </p>
                      {priceData?.DailyPrice && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Number(priceData.DailyPrice).toFixed(2)} €/día · {totalDays} día{totalDays !== 1 ? "s" : ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Available cars */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-3">
                      Vehículos disponibles
                      {checkingAvailability && <Loader2 className="inline h-4 w-4 animate-spin ml-2" />}
                    </h3>

                    {!checkingAvailability && availableCars.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                        <p className="text-sm">No hay vehículos disponibles para esta combinación.</p>
                        <p className="text-xs mt-1">Prueba con otras fechas o categoría.</p>
                      </div>
                    )}

                    {availableCars.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <input type="checkbox" id="noCar" checked={selectedCar === ""} onChange={() => setSelectedCar("")} className="rounded" />
                          <Label htmlFor="noCar" className="text-xs text-muted-foreground cursor-pointer">
                            Sin asignar vehículo específico (Rently asignará automáticamente)
                          </Label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                          {availableCars.map((car) => (
                            <button
                              key={car.Id}
                              className={cn(
                                "w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors",
                                selectedCar === car.Id
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-accent"
                              )}
                              onClick={() => setSelectedCar(car.Id)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold">{car.Id}</span>
                                <span className="text-xs text-muted-foreground">{[car.Brand, car.Model].filter(Boolean).join(" ")}</span>
                              </div>
                              {car.Color && <span className="text-xs text-muted-foreground">{car.Color}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                  </Button>
                  <Button onClick={goNext}>
                    Siguiente: Extras
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: Extras ═══ */}
            {step === 3 && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                      <Package className="h-4 w-4" /> Extras y accesorios
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Selecciona los extras que deseas incluir. Los items obligatorios se incluyen automáticamente.
                    </p>

                    {loadingExtras ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Cargando extras disponibles...</span>
                      </div>
                    ) : extras.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No hay extras disponibles para esta configuración.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {extras
                          .sort((a, b) => (a.Order ?? 99) - (b.Order ?? 99))
                          .map((item) => {
                            const isSelected = selectedExtras.some((e) => e.id === item.Id);
                            const selectedItem = selectedExtras.find((e) => e.id === item.Id);
                            const displayPrice = item.IsPriceByDay ? item.DailyPrice : item.Price;
                            const priceLabel = item.IsPriceByDay ? "/día" : "/total";
                            const maxQty = item.MaxQuantityPerBooking || 1;

                            return (
                              <div
                                key={item.Id}
                                className={cn(
                                  "rounded-lg border p-3 transition-all",
                                  isSelected ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "hover:bg-accent/50",
                                  item.IsRequired && "border-amber-300 bg-amber-50/50"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="pt-0.5">
                                    <input type="checkbox" checked={isSelected} onChange={() => toggleExtra(item)} disabled={item.IsRequired} className="rounded" />
                                  </div>
                                  {item.ImagePath && (
                                    <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border bg-muted">
                                      <img
                                        src={item.ImagePath.startsWith("http") ? item.ImagePath : `${RENTLY_IMG_BASE}${item.ImagePath}`}
                                        alt={item.Name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium">{item.Name}</span>
                                      {item.IsRequired && (
                                        <Badge variant="outline" className="text-[10px] h-4 border-amber-400 text-amber-700">
                                          <Shield className="h-2.5 w-2.5 mr-0.5" /> Obligatorio
                                        </Badge>
                                      )}
                                      {item.IsDefault && !item.IsRequired && (
                                        <Badge variant="outline" className="text-[10px] h-4 border-blue-300 text-blue-600">Recomendado</Badge>
                                      )}
                                    </div>
                                    {item.Description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.Description}</p>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold">
                                      {displayPrice > 0 ? `${displayPrice.toFixed(2)} €` : "Incluido"}
                                      {displayPrice > 0 && <span className="text-[10px] font-normal text-muted-foreground">{priceLabel}</span>}
                                    </p>
                                    {isSelected && maxQty > 1 && (
                                      <div className="flex items-center gap-1 mt-1.5 justify-end">
                                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateExtraQuantity(item.Id, -1)} disabled={selectedItem?.quantity === 1}>
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="text-xs font-medium w-6 text-center">{selectedItem?.quantity || 1}</span>
                                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateExtraQuantity(item.Id, 1)} disabled={selectedItem?.quantity === maxQty}>
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Extras total */}
                    {selectedExtras.length > 0 && (
                      <div className="mt-4 bg-accent/50 rounded-md p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {selectedExtras.length} extra{selectedExtras.length !== 1 ? "s" : ""} seleccionado{selectedExtras.length !== 1 ? "s" : ""}
                          </span>
                          <span className="font-semibold">
                            {extrasTotal > 0 ? `+${formatPrice(extrasTotal)}` : "Incluidos"}
                          </span>
                        </div>
                        {selectedExtras.some((e) => e.isPriceByDay) && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            * Precios por día calculados para {totalDays} día{totalDays !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                  </Button>
                  <Button onClick={goNext}>
                    Siguiente: Confirmar
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: Confirmar ═══ */}
            {step === 4 && (
              <div className="space-y-6">
                <Card className="border-emerald-200">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Resumen de la reserva
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Recogida</span>
                        <p className="font-medium">{fromDate ? format(fromDate, "dd/MM/yyyy") : "-"} {fromTime}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Devolución</span>
                        <p className="font-medium">{toDate ? format(toDate, "dd/MM/yyyy") : "-"} {toTime}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Categoría</span>
                        <p className="font-medium">{categories.find((c) => String(c.Id) === categoryId)?.Name || "-"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Vehículo</span>
                        <p className="font-medium">{selectedCar || "Sin asignar"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Recogida en</span>
                        <p className="font-medium">{places.find((p) => String(p.Id) === deliveryPlaceId)?.Name || "-"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Devolución en</span>
                        <p className="font-medium">
                          {sameReturnPlace
                            ? places.find((p) => String(p.Id) === deliveryPlaceId)?.Name || "-"
                            : places.find((p) => String(p.Id) === returnPlaceId)?.Name || "-"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Cliente</span>
                        <p className="font-medium">
                          {selectedCustomer
                            ? `${selectedCustomer.Firstname} ${selectedCustomer.Lastname}`
                            : `${custFirstname} ${custLastname}`}
                        </p>
                      </div>
                    </div>

                    {/* Extras summary */}
                    {selectedExtras.length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold uppercase">Extras incluidos</span>
                          <div className="mt-2 space-y-1">
                            {selectedExtras.map((e) => (
                              <div key={e.id} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {e.name}{e.quantity > 1 && ` x${e.quantity}`}
                                  {e.isRequired && <span className="text-[10px] text-amber-600 ml-1">(obligatorio)</span>}
                                </span>
                                <span className="font-medium">
                                  {e.isPriceByDay
                                    ? formatPrice(e.unitPrice * totalDays * e.quantity)
                                    : formatPrice(e.unitPrice * e.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Price summary */}
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      {getBasePrice() != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Precio base</span>
                          <span className="font-medium">{formatPrice(getBasePrice()!)}</span>
                        </div>
                      )}
                      {extrasTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Extras</span>
                          <span className="font-medium">+{formatPrice(extrasTotal)}</span>
                        </div>
                      )}
                      {getBasePrice() != null && (
                        <div className="flex justify-between text-base font-bold pt-2 border-t">
                          <span>Total estimado</span>
                          <span className="text-emerald-700">{formatPrice((getBasePrice() || 0) + extrasTotal)}</span>
                        </div>
                      )}
                    </div>

                    {/* Quotation indicator */}
                    {isQuotation && (
                      <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                        <Info className="h-4 w-4 text-amber-600" />
                        <span className="text-xs text-amber-800">Se creará como cotización, no como reserva confirmada.</span>
                      </div>
                    )}

                    {notes && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <strong>Notas:</strong> {notes}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                  </Button>
                  <Button
                    onClick={handleCreateBooking}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {actionLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creando reserva...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Crear reserva en Rently</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
