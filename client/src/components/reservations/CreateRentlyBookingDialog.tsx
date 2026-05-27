/**
 * CreateRentlyBookingDialog — Full booking creation form that sends to Rently API.
 *
 * Flow:
 * 1. User selects dates, category, pickup/return places, and customer info
 * 2. System checks availability and shows pricing
 * 3. User selects extras/accessories (optional)
 * 4. User confirms → booking is created in Rently and synced to PlanMint
 *
 * Features:
 * - Inline new customer creation form with DocumentTypeId dropdown
 * - Extras/accessories selector with prices from Rently API
 * - Customer is created in Rently before booking if new
 *
 * Permission-gated: requires rently.booking_create
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarIcon,
  Plus,
  Minus,
  Search,
  Loader2,
  Car,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Euro,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Package,
  UserPlus,
  CreditCard,
  Shield,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Id: string; // plate
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

type Step = "details" | "availability" | "extras" | "confirm";

const PLACE_TYPE_LABELS: Record<number, string> = {
  1: "Oficinas",
  2: "Aeropuerto",
  3: "Puntos de Encuentro",
  4: "Domicilios",
};

const DOCUMENT_TYPES: { id: number; label: string }[] = [
  { id: 1, label: "DNI" },
  { id: 2, label: "Pasaporte" },
  { id: 3, label: "NIE" },
  { id: 4, label: "CIF" },
  { id: 5, label: "Otro" },
];

// ─── Validation helpers ─────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?\d[\d\s\-().]{6,18}$/;

function validateEmail(email: string): string | null {
  if (!email.trim()) return null; // optional field
  if (!EMAIL_REGEX.test(email.trim())) return "Formato de email no válido";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null; // optional field
  const cleaned = phone.trim();
  if (!cleaned.startsWith("+")) return "El teléfono debe incluir prefijo internacional (ej. +34)";
  if (!PHONE_REGEX.test(cleaned)) return "Formato de teléfono no válido";
  return null;
}

/** Rently API base URL for extra images */
const RENTLY_IMG_BASE = "https://app.rfrently.com";

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateRentlyBookingDialog() {
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const { session } = useAuth();
  const { createBooking, callAction, isLoading: actionLoading } = useRentlyActions();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("details");

  // Reference data
  const [places, setPlaces] = useState<RentlyPlace[]>([]);
  const [categories, setCategories] = useState<RentlyCategory[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);

  // Form fields — Step 1
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
    } finally {
      setLoadingRef(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (open) loadReferenceData();
  }, [open, loadReferenceData]);

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

  // ─── Create new customer in Rently ────────────────────────────────────

  const handleCreateCustomer = useCallback(async () => {
    if (!custFirstname.trim() || !custLastname.trim()) {
      toast.error("Nombre y apellido son obligatorios");
      return;
    }

    // Validate email & phone before creating
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
        if (cars.length === 0) {
          toast.warning("No hay vehículos disponibles para esa combinación");
        }
      }

      // Also fetch price
      setCheckingPrice(true);
      const priceRes = await apiInvoke<any>("rently-hub", {
        body: { action: "booking_price", params },
      });
      if (priceRes.data?.data) {
        setPriceData(priceRes.data.data);
      }
    } catch (err) {
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

        // Auto-select required and default items
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
      // Non-blocking — extras are optional
    } finally {
      setLoadingExtras(false);
    }
  }, [fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId, returnPlaceId, sameReturnPlace]);

  // ─── Extras helpers ───────────────────────────────────────────────────

  const toggleExtra = useCallback((item: AdditionalPriceItem) => {
    setSelectedExtras((prev) => {
      const existing = prev.find((e) => e.id === item.Id);
      if (existing) {
        // Remove if not required
        if (item.IsRequired) return prev;
        return prev.filter((e) => e.id !== item.Id);
      }
      return [
        ...prev,
        {
          id: item.Id,
          name: item.Name,
          quantity: 1,
          unitPrice: item.IsPriceByDay ? item.DailyPrice : item.Price,
          isPriceByDay: item.IsPriceByDay,
          isRequired: item.IsRequired,
        },
      ];
    });
  }, []);

  const updateExtraQuantity = useCallback((itemId: number, delta: number) => {
    setSelectedExtras((prev) =>
      prev.map((e) => {
        if (e.id !== itemId) return e;
        const newQty = Math.max(1, e.quantity + delta);
        return { ...e, quantity: newQty };
      })
    );
  }, []);

  // Calculate total days for price-by-day extras
  const totalDays = useMemo(() => {
    if (!fromDate || !toDate) return 1;
    const diffMs = toDate.getTime() - fromDate.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
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

    // Build customer object
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

    // Build additionals array
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

    if (additionals.length > 0) {
      payload.Additionals = additionals;
    }

    if (selectedCar) {
      payload.Car = { Id: selectedCar };
    }

    const result = await createBooking(payload);

    if (result.success) {
      toast.success("Reserva creada en Rently y sincronizada con PlanMint");
      resetForm();
      setOpen(false);
    }
  }, [
    fromDate, toDate, fromTime, toTime, categoryId, deliveryPlaceId,
    returnPlaceId, sameReturnPlace, selectedCustomer, custFirstname,
    custLastname, custEmail, custPhone, custDocument, selectedCar,
    selectedExtras, notes, isQuotation, createBooking,
  ]);

  // ─── Reset ────────────────────────────────────────────────────────────

  const resetForm = () => {
    setStep("details");
    setFromDate(undefined);
    setToDate(undefined);
    setFromTime("10:00");
    setToTime("10:00");
    setCategoryId("");
    setDeliveryPlaceId("");
    setReturnPlaceId("");
    setSameReturnPlace(true);
    setCustomerSearch("");
    setSearchResults([]);
    setSelectedCustomer(null);
    setShowNewCustomerForm(false);
    setCustFirstname("");
    setCustLastname("");
    setCustEmail("");
    setCustPhone("");
    setCustDocument("");
    setCustDocumentTypeId("1");
    setCreatingCustomer(false);
    setCustErrors({});
    setAvailableCars([]);
    setSelectedCar("");
    setPriceData(null);
    setExtras([]);
    setSelectedExtras([]);
    setLoadingExtras(false);
    setNotes("");
    setIsQuotation(false);
  };

  // ─── Validation ───────────────────────────────────────────────────────

  const canProceedToAvailability = fromDate && toDate && categoryId && deliveryPlaceId &&
    (selectedCustomer || (custFirstname && custLastname));

  const canConfirm = canProceedToAvailability;

  // ─── Price display helper ─────────────────────────────────────────────

  const getBasePrice = (): number | null => {
    if (!priceData) return null;
    if (typeof priceData === "number") return priceData;
    if (priceData?.TotalPrice != null) return Number(priceData.TotalPrice);
    if (priceData?.Price != null) return Number(priceData.Price);
    return null;
  };

  const formatPrice = (value: number) => `${value.toFixed(2)} €`;

  // ─── Permission gate ──────────────────────────────────────────────────

  if (permLoading) return null;
  if (!hasPermission("rently.booking_create")) return null;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1" variant="default">
          <Plus className="h-4 w-4" />
          Nueva en Rently
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Crear reserva en Rently
          </DialogTitle>
          <DialogDescription>
            La reserva se creará directamente en el sistema de Rently y se sincronizará automáticamente con PlanMint.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="px-6 flex items-center gap-1.5 text-sm flex-wrap">
          <Badge variant={step === "details" ? "default" : "secondary"} className="text-xs">
            1. Datos
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === "availability" ? "default" : "secondary"} className="text-xs">
            2. Disponibilidad
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === "extras" ? "default" : "secondary"} className="text-xs">
            3. Extras
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === "confirm" ? "default" : "secondary"} className="text-xs">
            4. Confirmar
          </Badge>
        </div>

        <ScrollArea className="max-h-[60vh] px-6 pb-6">
          {loadingRef ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando datos de Rently...</span>
            </div>
          ) : (
            <>
              {/* ─── STEP 1: Details ─────────────────────────────────────── */}
              {step === "details" && (
                <div className="space-y-5 pt-2">
                  {/* Dates */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> Fechas
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Recogida *</Label>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "flex-1 justify-start text-left font-normal text-sm",
                                  !fromDate && "text-muted-foreground"
                                )}
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
                                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={fromTime}
                            onChange={(e) => setFromTime(e.target.value)}
                            className="w-24 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Devolución *</Label>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "flex-1 justify-start text-left font-normal text-sm",
                                  !toDate && "text-muted-foreground"
                                )}
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
                                disabled={(date) => fromDate ? date < fromDate : date < new Date(new Date().setHours(0,0,0,0))}
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={toTime}
                            onChange={(e) => setToTime(e.target.value)}
                            className="w-24 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Category */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <Car className="h-4 w-4" /> Categoría *
                    </h3>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.Id} value={String(c.Id)}>
                            {c.Name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Places */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" /> Lugares
                    </h3>
                    <div className="space-y-3">
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
                                  <SelectItem key={p.Id} value={String(p.Id)}>
                                    {p.Name}
                                  </SelectItem>
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
                                    <SelectItem key={p.Id} value={String(p.Id)}>
                                      {p.Name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Customer */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <User className="h-4 w-4" /> Cliente *
                    </h3>

                    {/* Search mode */}
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
                          <div className="border rounded-md max-h-40 overflow-y-auto">
                            {searchResults.map((c) => (
                              <button
                                key={c.Id}
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between border-b last:border-b-0"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setSearchResults([]);
                                }}
                              >
                                <span className="font-medium">{c.Firstname} {c.Lastname}</span>
                                <span className="text-xs text-muted-foreground">{c.EmailAddress || c.DocumentId || ""}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => setShowNewCustomerForm(true)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Crear nuevo cliente
                        </Button>
                      </div>
                    )}

                    {/* Selected customer display */}
                    {selectedCustomer && (
                      <div className="bg-accent/50 rounded-md p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            {selectedCustomer.Firstname} {selectedCustomer.Lastname}
                          </p>
                          <p className="text-xs text-muted-foreground ml-5">
                            {[selectedCustomer.EmailAddress, selectedCustomer.CellPhone || selectedCustomer.PhoneNumber, selectedCustomer.DocumentId]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearch("");
                            setShowNewCustomerForm(false);
                          }}
                        >
                          Cambiar
                        </Button>
                      </div>
                    )}

                    {/* New customer inline form */}
                    {showNewCustomerForm && !selectedCustomer && (
                      <div className="space-y-3 border border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <UserPlus className="h-4 w-4 text-primary" />
                            Nuevo cliente
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              setShowNewCustomerForm(false);
                              setCustFirstname("");
                              setCustLastname("");
                              setCustEmail("");
                              setCustPhone("");
                              setCustDocument("");
              setCustDocumentTypeId("1");
              setCustErrors({});
            }}
          >
            Cancelar
          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Nombre *</Label>
                            <Input
                              value={custFirstname}
                              onChange={(e) => setCustFirstname(e.target.value)}
                              placeholder="Nombre"
                              className="text-sm h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Apellido *</Label>
                            <Input
                              value={custLastname}
                              onChange={(e) => setCustLastname(e.target.value)}
                              placeholder="Apellido"
                              className="text-sm h-8"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <Mail className="h-3 w-3" /> Email
                            </Label>
                            <Input
                              type="email"
                              value={custEmail}
                              onChange={(e) => {
                                setCustEmail(e.target.value);
                                if (custErrors.email) setCustErrors((prev) => ({ ...prev, email: undefined }));
                              }}
                              placeholder="email@ejemplo.com"
                              className={cn("text-sm h-8", custErrors.email && "border-destructive focus-visible:ring-destructive")}
                            />
                            {custErrors.email && (
                              <p className="text-[11px] text-destructive">{custErrors.email}</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <Phone className="h-3 w-3" /> Teléfono
                            </Label>
                            <Input
                              value={custPhone}
                              onChange={(e) => {
                                setCustPhone(e.target.value);
                                if (custErrors.phone) setCustErrors((prev) => ({ ...prev, phone: undefined }));
                              }}
                              placeholder="+34 612 345 678"
                              className={cn("text-sm h-8", custErrors.phone && "border-destructive focus-visible:ring-destructive")}
                            />
                            {custErrors.phone && (
                              <p className="text-[11px] text-destructive">{custErrors.phone}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> Tipo doc.
                            </Label>
                            <Select value={custDocumentTypeId} onValueChange={setCustDocumentTypeId}>
                              <SelectTrigger className="text-sm h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DOCUMENT_TYPES.map((dt) => (
                                  <SelectItem key={dt.id} value={String(dt.id)}>
                                    {dt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" /> N.° Documento
                            </Label>
                            <Input
                              value={custDocument}
                              onChange={(e) => setCustDocument(e.target.value)}
                              placeholder="12345678A"
                              className="text-sm h-8"
                            />
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={handleCreateCustomer}
                          disabled={creatingCustomer || !custFirstname.trim() || !custLastname.trim()}
                        >
                          {creatingCustomer ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Creando en Rently...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Crear cliente en Rently
                            </>
                          )}
                        </Button>

                        <p className="text-[11px] text-muted-foreground text-center">
                          El cliente se creará en Rently y se asociará automáticamente a esta reserva.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas adicionales para la reserva..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Quotation toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isQuotation"
                      checked={isQuotation}
                      onChange={(e) => setIsQuotation(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="isQuotation" className="text-xs text-muted-foreground cursor-pointer">
                      Crear como cotización (no como reserva confirmada)
                    </Label>
                  </div>

                  {/* Next button */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => { setStep("availability"); checkAvailability(); }}
                      disabled={!canProceedToAvailability}
                    >
                      Siguiente: Disponibilidad
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── STEP 2: Availability ────────────────────────────────── */}
              {step === "availability" && (
                <div className="space-y-5 pt-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("details")}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Volver
                    </Button>
                  </div>

                  {/* Price info */}
                  {checkingPrice ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Consultando precio...
                    </div>
                  ) : priceData && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Euro className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-sm">Precio base estimado</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {getBasePrice() != null ? formatPrice(getBasePrice()!) : "Consultar"}
                      </p>
                      {priceData?.DailyPrice && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Number(priceData.DailyPrice).toFixed(2)} €/día
                        </p>
                      )}
                    </div>
                  )}

                  {/* Available cars */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Vehículos disponibles
                      {checkingAvailability && <Loader2 className="inline h-4 w-4 animate-spin ml-2" />}
                    </h3>

                    {!checkingAvailability && availableCars.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                        <p className="text-sm">No hay vehículos disponibles para esta combinación.</p>
                        <p className="text-xs mt-1">Prueba con otras fechas o categoría.</p>
                      </div>
                    )}

                    {availableCars.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            id="noCar"
                            checked={selectedCar === ""}
                            onChange={() => setSelectedCar("")}
                            className="rounded"
                          />
                          <Label htmlFor="noCar" className="text-xs text-muted-foreground cursor-pointer">
                            Sin asignar vehículo específico (Rently asignará automáticamente)
                          </Label>
                        </div>
                        {availableCars.map((car) => (
                          <button
                            key={car.Id}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md border text-sm transition-colors",
                              selectedCar === car.Id
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:bg-accent"
                            )}
                            onClick={() => setSelectedCar(car.Id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-medium">{car.Id}</span>
                              <span className="text-xs text-muted-foreground">
                                {[car.Brand, car.Model].filter(Boolean).join(" ")}
                              </span>
                            </div>
                            {car.Color && (
                              <span className="text-xs text-muted-foreground">{car.Color}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Next button */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setStep("details")}>
                      Volver
                    </Button>
                    <Button
                      onClick={() => { setStep("extras"); loadExtras(); }}
                      disabled={!canConfirm}
                    >
                      Siguiente: Extras
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── STEP 3: Extras / Accessories ────────────────────────── */}
              {step === "extras" && (
                <div className="space-y-5 pt-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("availability")}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Volver
                    </Button>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                      <Package className="h-4 w-4" /> Extras y accesorios
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Selecciona los extras que deseas incluir en la reserva. Los items obligatorios se incluyen automáticamente.
                    </p>

                    {loadingExtras ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Cargando extras disponibles...</span>
                      </div>
                    ) : extras.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No hay extras disponibles para esta configuración.</p>
                        <p className="text-xs mt-1">Puedes continuar sin extras.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
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
                                  isSelected
                                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                    : "hover:bg-accent/50",
                                  item.IsRequired && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Checkbox / toggle */}
                                  <div className="pt-0.5">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleExtra(item)}
                                      disabled={item.IsRequired}
                                      className="rounded"
                                    />
                                  </div>

                                  {/* Image thumbnail */}
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

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium">{item.Name}</span>
                                      {item.IsRequired && (
                                        <Badge variant="outline" className="text-[10px] h-4 border-amber-400 text-amber-700 dark:text-amber-400">
                                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                                          Obligatorio
                                        </Badge>
                                      )}
                                      {item.IsDefault && !item.IsRequired && (
                                        <Badge variant="outline" className="text-[10px] h-4 border-blue-300 text-blue-600 dark:text-blue-400">
                                          Recomendado
                                        </Badge>
                                      )}
                                      {item.Type && (
                                        <span className="text-[10px] text-muted-foreground">{item.Type}</span>
                                      )}
                                    </div>
                                    {item.Description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                        {item.Description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Price + quantity */}
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold">
                                      {displayPrice > 0 ? `${displayPrice.toFixed(2)} €` : "Incluido"}
                                      {displayPrice > 0 && (
                                        <span className="text-[10px] font-normal text-muted-foreground">{priceLabel}</span>
                                      )}
                                    </p>

                                    {/* Quantity selector (only when selected and max > 1) */}
                                    {isSelected && maxQty > 1 && (
                                      <div className="flex items-center gap-1 mt-1.5 justify-end">
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => updateExtraQuantity(item.Id, -1)}
                                          disabled={selectedItem?.quantity === 1}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="text-xs font-medium w-6 text-center">
                                          {selectedItem?.quantity || 1}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => updateExtraQuantity(item.Id, 1)}
                                          disabled={selectedItem?.quantity === maxQty}
                                        >
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
                      <div className="mt-3 bg-accent/50 rounded-md p-3">
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
                  </div>

                  {/* Next button */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setStep("availability")}>
                      Volver
                    </Button>
                    <Button onClick={() => setStep("confirm")}>
                      Siguiente: Confirmar
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── STEP 4: Confirm ─────────────────────────────────────── */}
              {step === "confirm" && (
                <div className="space-y-5 pt-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("extras")}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Volver
                    </Button>
                  </div>

                  {/* Summary */}
                  <div className="bg-accent/30 rounded-md p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Resumen de la reserva</h3>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Recogida</span>
                        <p className="font-medium">
                          {fromDate ? format(fromDate, "dd/MM/yyyy") : "-"} {fromTime}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Devolución</span>
                        <p className="font-medium">
                          {toDate ? format(toDate, "dd/MM/yyyy") : "-"} {toTime}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Categoría</span>
                        <p className="font-medium">
                          {categories.find((c) => String(c.Id) === categoryId)?.Name || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Vehículo</span>
                        <p className="font-medium">{selectedCar || "Sin asignar"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Recogida en</span>
                        <p className="font-medium">
                          {places.find((p) => String(p.Id) === deliveryPlaceId)?.Name || "-"}
                        </p>
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
                        <Separator />
                        <div>
                          <span className="text-xs text-muted-foreground">Extras incluidos</span>
                          <div className="mt-1 space-y-1">
                            {selectedExtras.map((e) => (
                              <div key={e.id} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {e.name}
                                  {e.quantity > 1 && ` x${e.quantity}`}
                                  {e.isRequired && (
                                    <span className="text-[10px] text-amber-600 ml-1">(obligatorio)</span>
                                  )}
                                </span>
                                <span className="font-medium">
                                  {e.isPriceByDay
                                    ? `${(e.unitPrice * totalDays * e.quantity).toFixed(2)} €`
                                    : `${(e.unitPrice * e.quantity).toFixed(2)} €`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Price summary */}
                    {(priceData || extrasTotal > 0) && (
                      <>
                        <Separator />
                        <div className="space-y-1">
                          {getBasePrice() != null && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Precio base</span>
                              <span className="font-medium">{formatPrice(getBasePrice()!)}</span>
                            </div>
                          )}
                          {extrasTotal > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Extras</span>
                              <span className="font-medium">+{formatPrice(extrasTotal)}</span>
                            </div>
                          )}
                          {getBasePrice() != null && (
                            <div className="flex items-center justify-between text-sm pt-1 border-t">
                              <span className="font-semibold">Total estimado</span>
                              <span className="text-lg font-bold text-emerald-600">
                                {formatPrice(getBasePrice()! + extrasTotal)}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {isQuotation && (
                      <Badge variant="outline" className="text-xs">
                        Se creará como COTIZACIÓN
                      </Badge>
                    )}

                    {notes && (
                      <div>
                        <span className="text-xs text-muted-foreground">Notas</span>
                        <p className="text-sm">{notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Warning */}
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-medium">Esta acción se ejecuta directamente en Rently</p>
                      <p className="mt-0.5">La reserva se creará en el sistema de Rently y se sincronizará automáticamente con PlanMint. Esta acción queda registrada en el log de auditoría.</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setStep("extras")}>
                      Volver
                    </Button>
                    <Button
                      onClick={handleCreateBooking}
                      disabled={actionLoading}
                      className="gap-1"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          {isQuotation ? "Crear cotización" : "Crear reserva"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
