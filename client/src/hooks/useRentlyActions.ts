/**
 * useRentlyActions — Frontend hook for bidirectional Rently API actions.
 *
 * Calls POST /api/rently-actions with the authenticated user's token.
 * Each action is permission-gated on the server side.
 */
import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface RentlyActionResult {
  success: boolean;
  data?: any;
  error?: string;
  rentlyResponse?: any;
  action?: string;
  label?: string;
  elapsed?: number;
}

interface RentlyActionRegistry {
  action: string;
  label: string;
  permitted: boolean;
}

export function useRentlyActions() {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [availableActions, setAvailableActions] = useState<RentlyActionRegistry[]>([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const callAction = useCallback(
    async (
      action: string,
      data?: Record<string, any>,
      params?: Record<string, any>,
      options?: { silent?: boolean }
    ): Promise<RentlyActionResult> => {
      if (!session?.access_token) {
        toast.error("Sesión no válida. Inicia sesión de nuevo.");
        return { success: false, error: "No session" };
      }

      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      setIsLoading(true);
      try {
        const response = await fetch("/api/rently-actions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action, data, params }),
          signal: abortRef.current.signal,
        });

        const result = await response.json();

        if (!result.success) {
          if (!options?.silent) {
            if (response.status === 403) {
              toast.error("No tienes permiso para esta acción en Rently");
            } else {
              toast.error(result.error || `Error al ejecutar ${action}`);
            }
          }
          return result;
        }

        if (!options?.silent) {
          toast.success(result.label || `Acción completada: ${action}`);
        }
        return result;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return { success: false, error: "Cancelado" };
        }
        const msg = err?.message || "Error de red";
        if (!options?.silent) {
          toast.error(`Error de conexión: ${msg}`);
        }
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [session?.access_token]
  );

  // ─── Convenience methods ──────────────────────────────────────────────────

  const confirmBooking = useCallback(
    (bookingId: string | number) =>
      callAction("booking.confirm", { BookingId: bookingId }),
    [callAction]
  );

  const cancelBooking = useCallback(
    (bookingId: string | number) =>
      callAction("booking.cancel", { BookingId: bookingId }),
    [callAction]
  );

  const uncancelBooking = useCallback(
    (bookingId: string | number) =>
      callAction("booking.uncancel", { BookingId: bookingId }),
    [callAction]
  );

  const updateBooking = useCallback(
    (bookingData: Record<string, any>) =>
      callAction("booking.update", bookingData),
    [callAction]
  );

  const createBooking = useCallback(
    (bookingData: Record<string, any>) =>
      callAction("booking.create", bookingData),
    [callAction]
  );

  const processDelivery = useCallback(
    (deliveryData: Record<string, any>) =>
      callAction("operations.delivery", deliveryData),
    [callAction]
  );

  const processReturn = useCallback(
    (returnData: Record<string, any>) =>
      callAction("operations.return", returnData),
    [callAction]
  );

  const createCustomer = useCallback(
    (customerData: Record<string, any>) =>
      callAction("customer.create", customerData),
    [callAction]
  );

  const updateCustomer = useCallback(
    (customerData: Record<string, any>) =>
      callAction("customer.update", customerData),
    [callAction]
  );

  const relocateCar = useCallback(
    (relocateData: Record<string, any>) =>
      callAction("cars.relocate", relocateData),
    [callAction]
  );

  // ─── Registry: fetch which actions this user can perform ──────────────────

  const loadRegistry = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const response = await fetch("/api/rently-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "registry" }),
      });
      const result = await response.json();
      if (result.success && result.actions) {
        setAvailableActions(result.actions);
        setRegistryLoaded(true);
      }
    } catch {
      // Silent failure for registry
    }
  }, [session?.access_token]);

  const canPerform = useCallback(
    (actionKey: string): boolean => {
      if (!registryLoaded) return false;
      const entry = availableActions.find((a) => a.action === actionKey);
      return entry?.permitted ?? false;
    },
    [availableActions, registryLoaded]
  );

  return {
    // State
    isLoading,
    availableActions,
    registryLoaded,

    // Generic
    callAction,
    loadRegistry,
    canPerform,

    // Booking actions
    confirmBooking,
    cancelBooking,
    uncancelBooking,
    updateBooking,
    createBooking,

    // Operations
    processDelivery,
    processReturn,

    // Customer
    createCustomer,
    updateCustomer,

    // Cars
    relocateCar,
  };
}
