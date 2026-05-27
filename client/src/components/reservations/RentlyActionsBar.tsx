/**
 * RentlyActionsBar — Permission-gated action buttons for Rently write operations.
 *
 * Renders contextual action buttons based on the current reservation status
 * and the user's Rently permissions. Placed inside ReservationDetailSheet.
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Truck,
  ArrowDownToLine,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useRentlyActions } from "@/hooks/useRentlyActions";
import { usePermissions } from "@/hooks/usePermissions";
import type { Reservation } from "@/types/reservations";

interface RentlyActionsBarProps {
  reservation: Reservation;
  onActionComplete?: () => void;
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  action: (() => Promise<void>) | null;
  variant: "default" | "destructive";
}

export function RentlyActionsBar({ reservation, onActionComplete }: RentlyActionsBarProps) {
  const { hasPermission } = usePermissions();
  const {
    isLoading,
    confirmBooking,
    cancelBooking,
    uncancelBooking,
    processDelivery,
    processReturn,
  } = useRentlyActions();

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    action: null,
    variant: "default",
  });

  const r = reservation;
  const bookingId = r.external_reservation_id;
  const status = r.estado?.toLowerCase() || "";

  // Check if user has the master permission or individual ones
  const hasManage = hasPermission("rently.manage");
  const canConfirm = hasManage || hasPermission("rently.booking_confirm");
  const canCancel = hasManage || hasPermission("rently.booking_cancel");
  const canUncancel = hasManage || hasPermission("rently.booking_uncancel");
  const canDelivery = hasManage || hasPermission("rently.operations_delivery");
  const canReturn = hasManage || hasPermission("rently.operations_return");

  // Determine which actions are contextually valid based on status
  const isPendiente = status === "pendiente";
  const isConfirmada = status === "confirmada";
  const isEnCurso = status === "en curso";
  const isCancelada = status === "cancelada";
  const isCompletada = status === "completada";

  const showConfirm = canConfirm && isPendiente;
  const showCancel = canCancel && (isPendiente || isConfirmada);
  const showUncancel = canUncancel && isCancelada;
  const showDelivery = canDelivery && isConfirmada;
  const showReturn = canReturn && isEnCurso;

  const hasAnyAction = showConfirm || showCancel || showUncancel || showDelivery || showReturn;

  if (!hasAnyAction) return null;

  const openConfirmDialog = (
    title: string,
    description: string,
    action: () => Promise<void>,
    variant: "default" | "destructive" = "default"
  ) => {
    setConfirmDialog({ open: true, title, description, action, variant });
  };

  const executeAndClose = async () => {
    if (confirmDialog.action) {
      await confirmDialog.action();
      onActionComplete?.();
    }
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  };

  return (
    <>
      <div className="border-t bg-muted/20 px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Acciones Rently
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50">
            Bidireccional
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {showConfirm && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-green-300 text-green-700 hover:bg-green-50"
              disabled={isLoading}
              onClick={() =>
                openConfirmDialog(
                  "Confirmar reserva en Rently",
                  `¿Confirmar la reserva #${bookingId}? Esto cambiará el estado en Rently a "Confirmada".`,
                  () => confirmBooking(bookingId).then(() => {}),
                )
              }
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Confirmar
            </Button>
          )}

          {showDelivery && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
              disabled={isLoading}
              onClick={() =>
                openConfirmDialog(
                  "Procesar entrega en Rently",
                  `¿Registrar la entrega del vehículo para la reserva #${bookingId}? Esto cambiará el estado en Rently a "Entregado".`,
                  () => processDelivery({ BookingId: bookingId }).then(() => {}),
                )
              }
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Truck className="h-3.5 w-3.5 mr-1" />}
              Registrar Entrega
            </Button>
          )}

          {showReturn && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              disabled={isLoading}
              onClick={() =>
                openConfirmDialog(
                  "Procesar devolución en Rently",
                  `¿Registrar la devolución del vehículo para la reserva #${bookingId}? Esto cambiará el estado en Rently a "Terminada".`,
                  () => processReturn({ BookingId: bookingId }).then(() => {}),
                )
              }
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />}
              Registrar Devolución
            </Button>
          )}

          {showCancel && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-red-300 text-red-700 hover:bg-red-50"
              disabled={isLoading}
              onClick={() =>
                openConfirmDialog(
                  "Cancelar reserva en Rently",
                  `¿Cancelar la reserva #${bookingId}? Esta acción se reflejará inmediatamente en Rently. Podrás reactivarla después si es necesario.`,
                  () => cancelBooking(bookingId).then(() => {}),
                  "destructive"
                )
              }
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
              Cancelar
            </Button>
          )}

          {showUncancel && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              disabled={isLoading}
              onClick={() =>
                openConfirmDialog(
                  "Reactivar reserva en Rently",
                  `¿Reactivar la reserva cancelada #${bookingId}? Esto restaurará la reserva en Rently.`,
                  () => uncancelBooking(bookingId).then(() => {}),
                )
              }
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
              Reactivar
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <strong>Importante:</strong> Esta acción se ejecutará directamente en el sistema de Rently y se registrará en el log de auditoría.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAndClose}
              disabled={isLoading}
              className={
                confirmDialog.variant === "destructive"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar acción
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
