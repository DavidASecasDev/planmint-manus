/**
 * POST /api/rently-actions
 * Bidirectional Rently API — write operations with granular permission checks.
 *
 * Each action maps to a Rently API write endpoint and requires a specific permission key.
 * The permission is checked via the standard resolution chain (role defaults → role_permissions → user_permissions).
 *
 * Supported actions:
 *   booking.confirm     → POST /api/booking/confirm
 *   booking.cancel      → POST /api/booking/cancel
 *   booking.uncancel    → POST /api/booking/uncancel
 *   booking.update      → PUT  /api/booking/update
 *   booking.create      → POST /api/booking
 *   operations.delivery → POST /api/operations/delivery
 *   operations.return   → POST /api/operations/return
 *   customer.create     → POST /api/customer
 *   customer.update     → PUT  /api/customer
 *   cars.relocate       → POST /api/cars/relocate
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { requirePermission } from "./permissionHelper";
import {
  fetchBookingDetail,
  fetchBookingDrivers,
  mapBookingToReservation,
  enrichReservationWithDetail,
  STATUS_MAP,
} from "./syncRently";

const REQUEST_TIMEOUT_MS = 30000;

// ─── Action → Permission + Rently endpoint mapping ──────────────────────────

interface ActionConfig {
  permissionKey: string;
  rentlyMethod: "GET" | "POST" | "PUT" | "DELETE";
  rentlyPath: string | ((params: Record<string, any>) => string);
  label: string;
  /** If true, the body is forwarded as JSON to Rently */
  forwardBody?: boolean;
}

const ACTION_MAP: Record<string, ActionConfig> = {
  "booking.confirm": {
    permissionKey: "rently.booking_confirm",
    rentlyMethod: "POST",
    rentlyPath: "/api/booking/confirm",
    label: "Confirmar reserva",
    forwardBody: true,
  },
  "booking.cancel": {
    permissionKey: "rently.booking_cancel",
    rentlyMethod: "POST",
    rentlyPath: "/api/booking/cancel",
    label: "Cancelar reserva",
    forwardBody: true,
  },
  "booking.uncancel": {
    permissionKey: "rently.booking_uncancel",
    rentlyMethod: "POST",
    rentlyPath: "/api/booking/uncancel",
    label: "Reactivar reserva",
    forwardBody: true,
  },
  "booking.update": {
    permissionKey: "rently.booking_update",
    rentlyMethod: "PUT",
    rentlyPath: "/api/booking/update",
    label: "Actualizar reserva",
    forwardBody: true,
  },
  "booking.create": {
    permissionKey: "rently.booking_create",
    rentlyMethod: "POST",
    rentlyPath: "/api/booking",
    label: "Crear reserva",
    forwardBody: true,
  },
  "booking.assign_driver": {
    permissionKey: "rently.booking_update",
    rentlyMethod: "PUT",
    rentlyPath: (params) => `/api/booking/${params.bookingId}/driver/${params.customerId}`,
    label: "Asignar conductor",
  },
  "operations.delivery": {
    permissionKey: "rently.operations_delivery",
    rentlyMethod: "POST",
    rentlyPath: "/api/operations/delivery",
    label: "Procesar entrega",
    forwardBody: true,
  },
  "operations.return": {
    permissionKey: "rently.operations_return",
    rentlyMethod: "POST",
    rentlyPath: "/api/operations/return",
    label: "Procesar devolución",
    forwardBody: true,
  },
  "customer.create": {
    permissionKey: "rently.customer_manage",
    rentlyMethod: "POST",
    rentlyPath: "/api/customer",
    label: "Crear cliente",
    forwardBody: true,
  },
  "customer.update": {
    permissionKey: "rently.customer_manage",
    rentlyMethod: "PUT",
    rentlyPath: "/api/customer",
    label: "Actualizar cliente",
    forwardBody: true,
  },
  "customer.create_or_update": {
    permissionKey: "rently.customer_manage",
    rentlyMethod: "POST",
    rentlyPath: "/api/customer/createorupdate",
    label: "Crear o actualizar cliente",
    forwardBody: true,
  },
  "cars.relocate": {
    permissionKey: "rently.cars_relocate",
    rentlyMethod: "POST",
    rentlyPath: "/api/cars/relocate",
    label: "Reubicar vehículo",
    forwardBody: true,
  },
  "cars.transfer": {
    permissionKey: "rently.cars_relocate",
    rentlyMethod: "POST",
    rentlyPath: "/api/cars/transfer",
    label: "Transferir vehículo",
    forwardBody: true,
  },
  "booking.add_payment": {
    permissionKey: "rently.booking_update",
    rentlyMethod: "POST",
    rentlyPath: "/api/booking/payment",
    label: "Registrar pago",
    forwardBody: true,
  },
  "service.create": {
    permissionKey: "rently.service_manage",
    rentlyMethod: "POST",
    rentlyPath: "/api/services",
    label: "Crear servicio (bloqueo taller)",
    forwardBody: true,
  },
  "service.update": {
    permissionKey: "rently.service_manage",
    rentlyMethod: "PUT",
    rentlyPath: "/api/services",
    label: "Actualizar servicio",
    forwardBody: true,
  },
  "service.finish": {
    permissionKey: "rently.service_manage",
    rentlyMethod: "PUT",
    rentlyPath: "/api/services",
    label: "Finalizar servicio",
    forwardBody: true,
  },
};

// ─── Rently API helpers ─────────────────────────────────────────────────────

async function getRentlyCredentials(organizationId: string) {
  const serviceClient = getServiceClient();
  const { data: settings, error } = await serviceClient
    .from("integration_settings")
    .select("rently_api_host, rently_client_id, rently_client_secret")
    .eq("organization_id", organizationId)
    .single();

  if (error || !settings?.rently_client_id || !settings?.rently_client_secret) {
    throw new Error("Rently no está configurado para esta organización");
  }

  return {
    host: settings.rently_api_host || "azul.rently.com.ar",
    clientId: settings.rently_client_id,
    clientSecret: settings.rently_client_secret,
  };
}

async function getRentlyToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout obteniendo token de Rently");
    throw error;
  }
}

async function callRentlyWriteApi(
  host: string,
  token: string,
  endpoint: string,
  method: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`https://${host}${endpoint}`, fetchOptions);
    clearTimeout(timeoutId);

    let data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { status: response.status, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout calling Rently API");
    throw error;
  }
}

// ─── Audit log helper ───────────────────────────────────────────────────────

async function logRentlyAction(
  organizationId: string,
  userId: string,
  action: string,
  label: string,
  success: boolean,
  details?: Record<string, unknown>,
  req?: Request
) {
  try {
    const serviceClient = getServiceClient();
    await serviceClient.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: userId,
      actor_role: "user",
      action: `rently.${action}`,
      entity_type: "rently_action",
      entity_id: null,
      metadata_json: JSON.stringify({
        rently_action: action,
        label,
        success,
        ...details,
      }),
      ip_address: req?.ip || req?.headers["x-forwarded-for"]?.toString() || null,
      user_agent: req?.headers["user-agent"] || null,
    });
  } catch (err) {
    // Non-blocking — don't fail the request if audit logging fails
    console.error("[rently-actions] Audit log error:", err);
  }
}

// ─── Post-action single-booking sync ────────────────────────────────────────

/**
 * Re-fetch a single booking from Rently and update the corresponding reservation
 * in PlanMint. This runs after a successful write action so the UI reflects
 * the new state immediately without waiting for the 5-minute sync cycle.
 */
async function syncSingleBooking(
  host: string,
  token: string,
  bookingId: number,
  organizationId: string,
  userId: string
): Promise<{ synced: boolean; newStatus?: string }> {
  // 1. Fetch the updated booking detail from Rently
  const detail = await fetchBookingDetail(host, token, bookingId);
  if (!detail) {
    return { synced: false };
  }

  const drivers = await fetchBookingDrivers(host, token, bookingId);

  // 2. Map to our reservation format
  const baseReservation = mapBookingToReservation(detail, organizationId, userId);
  const enriched = enrichReservationWithDetail(baseReservation, detail, drivers);
  const newStatus = STATUS_MAP[detail.CurrentStatus] || `Status ${detail.CurrentStatus}`;

  // 3. Check if the reservation exists in our DB
  const serviceClient = getServiceClient();
  const extId = String(bookingId);
  const { data: existing } = await serviceClient
    .from("reservations")
    .select("id, estado")
    .eq("organization_id", organizationId)
    .eq("external_reservation_id", extId)
    .single();

  if (!existing) {
    // Reservation doesn't exist yet — insert it
    await serviceClient.from("reservations").insert(enriched);
    return { synced: true, newStatus };
  }

  // 4. Build update payload (protect user-editable fields, same as full sync)
  const updateData: Record<string, unknown> = { ...enriched, estado: newStatus };
  delete updateData.organization_id;
  delete updateData.imported_by;
  delete updateData.external_reservation_id;
  delete updateData.confirmed_entrega_datetime;
  delete updateData.confirmed_devolucion_datetime;

  // Protect user-editable location fields (same as full sync)
  updateData.rently_lugar_entrega = updateData.lugar_entrega ?? null;
  updateData.rently_lugar_devolucion = updateData.lugar_devolucion ?? null;
  updateData.rently_lugar_entrega_direccion = updateData.lugar_entrega_direccion ?? null;
  updateData.rently_lugar_devolucion_direccion = updateData.lugar_devolucion_direccion ?? null;
  delete updateData.lugar_entrega;
  delete updateData.lugar_devolucion;
  delete updateData.lugar_entrega_direccion;
  delete updateData.lugar_devolucion_direccion;
  delete updateData.lugar_entrega_ciudad;
  delete updateData.lugar_devolucion_ciudad;

  // Protect operational fields (Programación) - same as full sync
  delete updateData.checkin;
  delete updateData.checkin_entrega;
  delete updateData.checkin_devolucion;
  delete updateData.pagado;
  delete updateData.pagado_entrega;
  delete updateData.pagado_devolucion;
  delete updateData.hosp;
  delete updateData.hosp_entrega;
  delete updateData.hosp_devolucion;
  delete updateData.contacto;
  delete updateData.contacto_entrega;
  delete updateData.contacto_devolucion;
  delete updateData.notas;
  delete updateData.notas_entrega;
  delete updateData.notas_devolucion;

  if (newStatus === "Completada") {
    updateData.estado_terminada_at = new Date().toISOString();
  }
  if (newStatus === "Cancelada") {
    updateData.estado_entrega = "Cancelada";
    updateData.estado_devolucion = "Cancelada";
  }
  // Undo cancellation side-effects when reactivated
  if (existing.estado === "Cancelada" && newStatus !== "Cancelada") {
    updateData.estado_entrega = null;
    updateData.estado_devolucion = null;
  }

  // 5. Log status change if it changed
  if (existing.estado !== newStatus) {
    try {
      await serviceClient.from("reservation_status_history").insert({
        organization_id: organizationId,
        reservation_id: existing.id,
        external_reservation_id: extId,
        old_status: existing.estado,
        new_status: newStatus,
        change_type: "sync_rently",
        changed_by_name: "Sistema (Post-Action Sync)",
        notes: `Sync inmediato tras acción en Rently: ${existing.estado || "(nuevo)"} → ${newStatus}`,
      });
    } catch (logErr) {
      console.error("[rently-actions] Failed to log status change:", logErr);
    }
  }

  // 6. Apply update
  await serviceClient.from("reservations").update(updateData).eq("id", existing.id);

  return { synced: true, newStatus };
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function handleRentlyActions(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { action, data: actionData, params } = req.body || {};

    if (!action) {
      return res.status(400).json({ success: false, error: "Falta el campo 'action'" });
    }

    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Falta el campo 'organizationId' en el token" });
    }

    // ─── Registry action: return available actions for the user ────────────
    if (action === "registry") {
      const serviceClient = getServiceClient();
      const availableActions: Array<{ action: string; label: string; permitted: boolean }> = [];

      for (const [actionKey, config] of Object.entries(ACTION_MAP)) {
        let permitted = false;
        try {
          // Check rently.manage first (super permission)
          const { allowed: manageAllowed } = await (await import("./permissionHelper")).checkUserPermission(
            serviceClient,
            organizationId,
            userId,
            "rently.manage"
          );
          if (manageAllowed) {
            permitted = true;
          } else {
            const { allowed } = await (await import("./permissionHelper")).checkUserPermission(
              serviceClient,
              organizationId,
              userId,
              config.permissionKey
            );
            permitted = allowed;
          }
        } catch {
          permitted = false;
        }

        availableActions.push({
          action: actionKey,
          label: config.label,
          permitted,
        });
      }

      return res.json({ success: true, actions: availableActions });
    }

    // ─── Execute action ───────────────────────────────────────────────────
    const config = ACTION_MAP[action];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Acción no reconocida: ${action}`,
        availableActions: Object.keys(ACTION_MAP),
      });
    }

    // Check permission (rently.manage grants all)
    const serviceClient = getServiceClient();
    const { allowed: manageAll } = await (await import("./permissionHelper")).checkUserPermission(
      serviceClient,
      organizationId,
      userId,
      "rently.manage"
    );

    if (!manageAll) {
      await requirePermission(serviceClient, organizationId, userId, config.permissionKey);
    }

    // Get Rently credentials and token
    const creds = await getRentlyCredentials(organizationId);
    const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);

    // Resolve endpoint path
    const endpoint = typeof config.rentlyPath === "function"
      ? config.rentlyPath(params || {})
      : config.rentlyPath;

    // Call Rently API
    const startTime = Date.now();
    const result = await callRentlyWriteApi(
      creds.host,
      token,
      endpoint,
      config.rentlyMethod,
      config.forwardBody ? actionData : undefined
    );
    const elapsed = Date.now() - startTime;

    const success = result.status >= 200 && result.status < 300;

    // Audit log
    await logRentlyAction(organizationId, userId, action, config.label, success, {
      rentlyStatus: result.status,
      elapsed,
      requestData: actionData ? { ...actionData, _redacted: true } : undefined,
    }, req);

    if (!success) {
      return res.status(result.status).json({
        success: false,
        error: `Rently respondió con error ${result.status}`,
        rentlyResponse: result.data,
        action,
        elapsed,
      });
    }

    // ─── POST-ACTION SYNC ────────────────────────────────────────────────
    // After a successful Rently write, re-fetch the booking detail and update PlanMint
    let syncResult: { synced: boolean; newStatus?: string } = { synced: false };
    // For booking.create, the new booking ID comes from the Rently response
    let bookingId = actionData?.Id || actionData?.BookingId || params?.bookingId;
    if (!bookingId && action === "booking.create" && result.data) {
      // Rently returns the new booking ID in the response (could be .Id, .BookingId, or the data itself if numeric)
      const rd = result.data as any;
      bookingId = rd?.Id || rd?.BookingId || (typeof rd === "number" ? rd : null);
    }
    if (bookingId) {
      try {
        syncResult = await syncSingleBooking(
          creds.host,
          token,
          Number(bookingId),
          organizationId,
          userId
        );
        console.log(`[rently-actions] Post-action sync for booking ${bookingId}: ${syncResult.synced ? 'OK' : 'skipped'}`);
      } catch (syncErr: any) {
        console.error(`[rently-actions] Post-action sync error for booking ${bookingId}:`, syncErr?.message);
        // Non-blocking — the Rently action itself succeeded
      }
    }

    return res.json({
      success: true,
      data: result.data,
      action,
      label: config.label,
      elapsed,
      sync: syncResult,
    });
  } catch (error: any) {
    console.error("[rently-actions] Error:", error);

    if (error?.code === "PERMISSION_DENIED") {
      return res.status(403).json({
        success: false,
        error: "No tienes permiso para realizar esta acción en Rently",
        details: error.message,
      });
    }

    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || "Error desconocido al ejecutar acción en Rently",
    });
  }
}
