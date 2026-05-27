import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Calendar, MapPin, Car, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useRentlyHub } from "@/lib/rently/useRentlyHub";
import { useRentlyActions } from "@/hooks/useRentlyActions";

/* ─── helpers ─── */
function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (
      (typeof o.Name === "string" ? o.Name : "") ||
      (typeof o.Description === "string" ? o.Description : "") ||
      ""
    );
  }
  return "";
}

function toDatetimeLocal(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function toISOString(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  try {
    const d = new Date(datetimeLocal);
    if (isNaN(d.getTime())) return "";
    return d.toISOString();
  } catch {
    return "";
  }
}

/* ─── types ─── */
interface Place {
  Id: number;
  Name: string;
  Address?: string;
}

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Record<string, unknown>;
  onSuccess: () => void;
}

export function EditBookingDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: EditBookingDialogProps) {
  const { callAction } = useRentlyActions();
  const { explore } = useRentlyHub();

  // ─── Extract current values ───
  const bookingId = booking.Id as number;
  const code = safeStr(booking.Code);

  const currentFrom = safeStr(booking.From);
  const currentTo = safeStr(booking.To);

  const deliveryPlace = booking.DeliveryPlace as Record<string, unknown> | null;
  const returnPlace = booking.ReturnPlace as Record<string, unknown> | null;
  const currentDeliveryPlaceId = deliveryPlace?.Id as number | undefined;
  const currentReturnPlaceId = returnPlace?.Id as number | undefined;

  const carObj = booking.Car as Record<string, unknown> | null;
  const currentCarPlate = carObj?.Id as string || "";

  const currentNotes = safeStr(booking.Notes);

  // ─── Form state ───
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deliveryPlaceId, setDeliveryPlaceId] = useState("");
  const [returnPlaceId, setReturnPlaceId] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── Places list ───
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  // Initialize form values when dialog opens
  useEffect(() => {
    if (open && booking) {
      setFromDate(toDatetimeLocal(currentFrom));
      setToDate(toDatetimeLocal(currentTo));
      setDeliveryPlaceId(currentDeliveryPlaceId?.toString() || "");
      setReturnPlaceId(currentReturnPlaceId?.toString() || "");
      setCarPlate(currentCarPlate);
      setNotes(currentNotes);
    }
  }, [open, booking]);

  // Fetch available places
  const fetchPlaces = useCallback(async () => {
    if (places.length > 0) return;
    setLoadingPlaces(true);
    try {
      const res = await explore("/api/places", "GET");
      const data = res?.data;
      const list = Array.isArray(data) ? data : (data as any)?.Results ?? [];
      setPlaces(
        list.map((p: any) => ({
          Id: p.Id,
          Name: p.Name || p.BranchOfficeName || `Lugar ${p.Id}`,
          Address: p.Address || "",
        }))
      );
    } catch {
      // silently fail — user can still type
    } finally {
      setLoadingPlaces(false);
    }
  }, [explore, places.length]);

  useEffect(() => {
    if (open) fetchPlaces();
  }, [open, fetchPlaces]);

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      toast.error("Las fechas de entrega y devolución son obligatorias");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        Id: bookingId,
        From: toISOString(fromDate),
        To: toISOString(toDate),
      };

      if (deliveryPlaceId) {
        payload.DeliveryPlaceId = parseInt(deliveryPlaceId, 10);
      }
      if (returnPlaceId) {
        payload.ReturnPlaceId = parseInt(returnPlaceId, 10);
      }
      if (carPlate && carPlate !== currentCarPlate) {
        payload.CarId = carPlate;
      }
      if (notes !== currentNotes) {
        payload.Notes = notes;
      }

      await callAction("booking.update", {
        reservationId: bookingId,
        payload,
      });

      toast.success("Reserva actualizada correctamente");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar la reserva");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Computed ───
  const hasChanges =
    fromDate !== toDatetimeLocal(currentFrom) ||
    toDate !== toDatetimeLocal(currentTo) ||
    deliveryPlaceId !== (currentDeliveryPlaceId?.toString() || "") ||
    returnPlaceId !== (currentReturnPlaceId?.toString() || "") ||
    carPlate !== currentCarPlate ||
    notes !== currentNotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Reserva #{code}
          </DialogTitle>
          <DialogDescription>
            Modifica los datos de la reserva. Los cambios se enviarán directamente a Rently.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Dates ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Fechas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fromDate" className="text-xs">Entrega</Label>
                <Input
                  id="fromDate"
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="toDate" className="text-xs">Devolución</Label>
                <Input
                  id="toDate"
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Places ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Lugares</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lugar de entrega</Label>
                {loadingPlaces ? (
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs text-muted-foreground">Cargando...</span>
                  </div>
                ) : places.length > 0 ? (
                  <Select value={deliveryPlaceId} onValueChange={setDeliveryPlaceId}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar lugar" />
                    </SelectTrigger>
                    <SelectContent>
                      {places.map((p) => (
                        <SelectItem key={p.Id} value={p.Id.toString()}>
                          {p.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={deliveryPlaceId}
                    onChange={(e) => setDeliveryPlaceId(e.target.value)}
                    placeholder="ID del lugar"
                    className="text-sm"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lugar de devolución</Label>
                {loadingPlaces ? (
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs text-muted-foreground">Cargando...</span>
                  </div>
                ) : places.length > 0 ? (
                  <Select value={returnPlaceId} onValueChange={setReturnPlaceId}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar lugar" />
                    </SelectTrigger>
                    <SelectContent>
                      {places.map((p) => (
                        <SelectItem key={p.Id} value={p.Id.toString()}>
                          {p.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={returnPlaceId}
                    onChange={(e) => setReturnPlaceId(e.target.value)}
                    placeholder="ID del lugar"
                    className="text-sm"
                  />
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Vehicle ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Car className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Vehículo</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carPlate" className="text-xs">Matrícula</Label>
              <Input
                id="carPlate"
                value={carPlate}
                onChange={(e) => setCarPlate(e.target.value.toUpperCase())}
                placeholder="Ej: 1234ABC"
                className="text-sm font-mono uppercase"
              />
              <p className="text-[10px] text-muted-foreground">
                Introduce la matrícula del vehículo asignado. Déjalo vacío para mantener el actual.
              </p>
            </div>
          </div>

          <Separator />

          {/* ── Notes ── */}
          <div className="space-y-1.5">
            <Label htmlFor="editNotes" className="text-xs font-semibold">Notas</Label>
            <Textarea
              id="editNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas de la reserva..."
              rows={3}
              className="text-sm"
            />
          </div>

          {/* ── Warning ── */}
          {hasChanges && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Los cambios se enviarán directamente a Rently y se reflejarán inmediatamente en el sistema.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !hasChanges}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
