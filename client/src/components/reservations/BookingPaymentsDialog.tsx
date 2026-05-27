import { useState, useEffect } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CreditCard,
  Euro,
  Calendar,
  Receipt,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { useRentlyActions } from "@/hooks/useRentlyActions";

/* ─── helpers ─── */
function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (typeof o.Name === "string" ? o.Name : "") || "";
  }
  return "";
}

function fmtCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm");
  } catch {
    return dateStr;
  }
}

/* ─── types ─── */
type PaymentGateway = "cash" | "card" | "transfer" | "redsys" | "stripe" | "other";

interface PaymentRecord {
  Date: string;
  Amount: number;
  Gateway?: string;
  Reference?: string;
  Notes?: string;
}

interface BookingPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Record<string, unknown>;
  onSuccess: () => void;
}

export function BookingPaymentsDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: BookingPaymentsDialogProps) {
  const { callAction } = useRentlyActions();

  // ─── Extract booking financial data ───
  const bookingId = booking.Id as number;
  const code = safeStr(booking.Code);
  const currency = safeStr(booking.Currency) || "EUR";
  const totalPrice = (booking.Price as number) ?? (booking.CustomerPrice as number) ?? 0;
  const totalPaid = (booking.PayedByCustomer as number) ?? 0;
  const balance = (booking.Balance as number) ?? totalPaid - totalPrice;

  // Extract existing payments
  const rawPayments = Array.isArray(booking.Payments) ? booking.Payments as Record<string, unknown>[] : [];
  const payments: PaymentRecord[] = rawPayments.map((p) => ({
    Date: safeStr(p.Date) || safeStr(p.CreationDate),
    Amount: (p.Amount as number) ?? 0,
    Gateway: safeStr(p.Gateway) || safeStr(p.PaymentMethod) || safeStr(p.Type),
    Reference: safeStr(p.Reference) || safeStr(p.TransactionId),
    Notes: safeStr(p.Notes) || safeStr(p.Description),
  }));

  // ─── New payment form state ───
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [gateway, setGateway] = useState<PaymentGateway | "">("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const pending = Math.abs(balance);
      setAmount(pending > 0 ? pending.toFixed(2) : "");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setGateway("");
      setReference("");
      setNotes("");
    }
  }, [open, balance]);

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Introduce un monto válido mayor que 0");
      return;
    }
    if (!gateway) {
      toast.error("Selecciona un método de pago");
      return;
    }

    setSubmitting(true);
    try {
      await callAction("booking.add_payment", {
        reservationId: bookingId,
        payload: {
          BookingId: bookingId,
          Amount: parsedAmount,
          Date: new Date(date).toISOString(),
          Gateway: gateway,
          Reference: reference.trim() || undefined,
          Notes: notes.trim() || undefined,
        },
      });

      toast.success(`Pago de ${fmtCurrency(parsedAmount, currency)} registrado correctamente`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Error al registrar el pago");
    } finally {
      setSubmitting(false);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const newBalance = balance + parsedAmount;

  const GATEWAYS: { value: PaymentGateway; label: string }[] = [
    { value: "cash", label: "Efectivo" },
    { value: "card", label: "Tarjeta" },
    { value: "transfer", label: "Transfer." },
    { value: "redsys", label: "Redsys" },
    { value: "stripe", label: "Stripe" },
    { value: "other", label: "Otro" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagos — Reserva #{code}
          </DialogTitle>
          <DialogDescription>
            Consulta los pagos registrados y añade nuevos cobros.
          </DialogDescription>
        </DialogHeader>

        {/* ── Financial Summary ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
            <p className="text-sm font-bold mt-0.5">{fmtCurrency(totalPrice, currency)}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-center">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium">Pagado</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{fmtCurrency(totalPaid, currency)}</p>
          </div>
          <div className={`p-3 rounded-lg text-center ${balance < 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/50"}`}>
            <p className={`text-[10px] uppercase tracking-wider font-medium ${balance < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>Saldo</p>
            <p className={`text-sm font-bold mt-0.5 ${balance < 0 ? "text-red-700 dark:text-red-400" : ""}`}>{fmtCurrency(balance, currency)}</p>
          </div>
        </div>

        {/* ── Existing Payments ── */}
        {payments.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Historial de pagos ({payments.length})
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border text-sm">
                  <CircleDot className="h-3 w-3 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fmtCurrency(p.Amount, currency)}</span>
                      {p.Gateway && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {p.Gateway}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtDate(p.Date)}
                      {p.Reference ? ` · ${p.Reference}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* ── New Payment Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Registrar nuevo pago
          </p>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="payAmount" className="text-xs flex items-center gap-1.5">
              <Euro className="h-3 w-3" />Monto
            </Label>
            <Input
              id="payAmount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono text-sm"
            />
            {parsedAmount > 0 && (
              <p className={`text-[10px] ${newBalance >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {newBalance >= 0
                  ? `Saldo tras pago: ${fmtCurrency(newBalance, currency)}`
                  : `Quedarán pendientes: ${fmtCurrency(Math.abs(newBalance), currency)}`}
              </p>
            )}
          </div>

          {/* Gateway */}
          <div className="space-y-1.5">
            <Label className="text-xs">Método de pago</Label>
            <ToggleGroup
              type="single"
              value={gateway}
              onValueChange={(val) => { if (val) setGateway(val as PaymentGateway); }}
              className="justify-start flex-wrap"
            >
              {GATEWAYS.map((g) => (
                <ToggleGroupItem
                  key={g.value}
                  value={g.value}
                  className="px-3 py-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {g.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Reference */}
          {gateway && gateway !== "cash" && (
            <div className="space-y-1.5">
              <Label htmlFor="payRef" className="text-xs flex items-center gap-1.5">
                <Receipt className="h-3 w-3" />Referencia
              </Label>
              <Input
                id="payRef"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={
                  gateway === "stripe"
                    ? "pi_3Abc123..."
                    : gateway === "redsys"
                    ? "Código de autorización"
                    : gateway === "transfer"
                    ? "Concepto o referencia bancaria"
                    : "Referencia del pago"
                }
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="payDate" className="text-xs flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />Fecha del cobro
            </Label>
            <Input
              id="payDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="payNotes" className="text-xs">Notas (opcional)</Label>
            <Textarea
              id="payNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones del pago..."
              rows={2}
              className="text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={submitting || !gateway || parsedAmount <= 0}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Registrando...
                </>
              ) : (
                "Registrar Pago"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
