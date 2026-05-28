/**
 * POST /api/repair-service-sync
 * 
 * Automatically creates, updates, or finishes a Rently service (type "Bloqueo Disponibilidad")
 * when a repair changes status in Garatech.
 * 
 * Actions:
 *   - status → "en_taller": Create a new Rently service (or update existing)
 *   - dates changed: Update the existing Rently service dates
 *   - status → "finalizado": Finish the Rently service (Status=2)
 *   - status → "cancelado": Cancel the Rently service (Status=3)
 * 
 * Best-effort: if Rently API fails, the repair update still succeeds.
 * The Rently service ID is stored in repairs.rently_service_id for future updates.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

const REQUEST_TIMEOUT_MS = 30000;
const SERVICE_TYPE_BLOQUEO = 11; // "Bloqueo Disponibilidad"

// Rently service statuses
const RENTLY_STATUS = {
  PROGRAMADO: 0,
  EN_EJECUCION: 1,
  FINALIZADO: 2,
  CANCELADO: 3,
} as const;

// ─── Rently API helpers (reused from rentlyActions pattern) ─────────────────

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
      throw new Error(`Auth failed (${response.status})`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout obteniendo token de Rently");
    throw error;
  }
}

async function callRentlyApi(
  host: string,
  token: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown
): Promise<{ status: number; data: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const fetchOptions: RequestInit = { method, headers, signal: controller.signal };

    if (body && (method === "POST" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`https://${host}${endpoint}`, fetchOptions);
    clearTimeout(timeoutId);

    let data: any;
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

// ─── Service payload builders ───────────────────────────────────────────────

function formatDateForRently(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString().replace("Z", "");
  // Ensure format is "YYYY-MM-DDTHH:mm:ss" without timezone
  const d = new Date(dateStr);
  return d.toISOString().replace("Z", "").split(".")[0];
}

function buildCreateServicePayload(repair: any, plate: string) {
  const fromDate = formatDateForRently(repair.started_at || repair.created_at);
  // ToDate: use scheduled_date if available, otherwise +30 days from start
  let toDate: string;
  if (repair.scheduled_date) {
    toDate = formatDateForRently(repair.scheduled_date);
  } else {
    const from = new Date(repair.started_at || repair.created_at || Date.now());
    from.setDate(from.getDate() + 30);
    toDate = from.toISOString().replace("Z", "").split(".")[0];
  }

  const notes = [
    repair.description || "",
    repair.notes || "",
    `[PlanMint Garatech - Reparación #${repair.id}]`,
  ].filter(Boolean).join(" | ");

  return {
    CarId: plate,
    ServiceTypeId: SERVICE_TYPE_BLOQUEO,
    FromDate: fromDate,
    ToDate: toDate,
    Status: RENTLY_STATUS.EN_EJECUCION as number,
    Notes: notes.substring(0, 500),
    Km: repair.km_at_repair || 0,
    Price: 0,
    IsFixed: false,
    IsLockedForEdit: false,
  };
}

function buildUpdateServicePayload(existingServiceId: number, repair: any, plate: string) {
  const payload = buildCreateServicePayload(repair, plate);
  return {
    Id: existingServiceId,
    ...payload,
  };
}

function buildFinishServicePayload(existingServiceId: number, repair: any, plate: string) {
  const payload = buildUpdateServicePayload(existingServiceId, repair, plate);
  payload.Status = RENTLY_STATUS.FINALIZADO;
  // Set ToDate to now (actual completion)
  if (repair.completed_at) {
    payload.ToDate = formatDateForRently(repair.completed_at);
  } else {
    payload.ToDate = formatDateForRently(new Date().toISOString());
  }
  return payload;
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function handleRepairServiceSync(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);

    const { repairId, action } = req.body || {};
    // action: "create" | "update" | "finish" | "cancel"

    if (!repairId) {
      return res.status(400).json({ success: false, error: "Falta repairId" });
    }

    if (!action || !["create", "update", "finish", "cancel"].includes(action)) {
      return res.status(400).json({ success: false, error: "Acción inválida. Usa: create, update, finish, cancel" });
    }

    const serviceClient = getServiceClient();

    // 1. Fetch the repair with its vehicle plate
    const { data: repair, error: repairError } = await serviceClient
      .from("repairs")
      .select("*, vehicle:fleet_vehicles!vehicle_id(id, matricula)")
      .eq("id", repairId)
      .eq("organization_id", organizationId)
      .single();

    if (repairError || !repair) {
      return res.status(404).json({ success: false, error: "Reparación no encontrada" });
    }

    const plate = repair.vehicle?.matricula;
    if (!plate) {
      return res.status(400).json({ success: false, error: "El vehículo no tiene matrícula asignada" });
    }

    // 2. Get Rently credentials and token
    const creds = await getRentlyCredentials(organizationId);
    const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);

    let result: { status: number; data: any };
    let rentlyServiceId = repair.rently_service_id;

    // 3. Execute the appropriate action
    switch (action) {
      case "create": {
        if (rentlyServiceId) {
          // Service already exists — update instead
          const payload = buildUpdateServicePayload(rentlyServiceId, repair, plate);
          result = await callRentlyApi(creds.host, token, "/api/services", "PUT", payload);
        } else {
          // Create new service
          const payload = buildCreateServicePayload(repair, plate);
          result = await callRentlyApi(creds.host, token, "/api/services", "POST", payload);

          if (result.status >= 200 && result.status < 300) {
            // Extract the new service ID from the response
            const newId = typeof result.data === "number"
              ? result.data
              : result.data?.Id || result.data?.id;

            if (newId) {
              rentlyServiceId = newId;
              // Save the Rently service ID to the repair
              await serviceClient
                .from("repairs")
                .update({ rently_service_id: newId })
                .eq("id", repairId);
            }
          }
        }
        break;
      }

      case "update": {
        if (!rentlyServiceId) {
          // No existing service — create one instead
          const payload = buildCreateServicePayload(repair, plate);
          result = await callRentlyApi(creds.host, token, "/api/services", "POST", payload);

          if (result.status >= 200 && result.status < 300) {
            const newId = typeof result.data === "number"
              ? result.data
              : result.data?.Id || result.data?.id;
            if (newId) {
              rentlyServiceId = newId;
              await serviceClient
                .from("repairs")
                .update({ rently_service_id: newId })
                .eq("id", repairId);
            }
          }
        } else {
          const payload = buildUpdateServicePayload(rentlyServiceId, repair, plate);
          result = await callRentlyApi(creds.host, token, "/api/services", "PUT", payload);
        }
        break;
      }

      case "finish": {
        if (!rentlyServiceId) {
          // Nothing to finish
          return res.json({
            success: true,
            message: "No hay servicio de Rently asociado a esta reparación",
            skipped: true,
          });
        }
        const payload = buildFinishServicePayload(rentlyServiceId, repair, plate);
        result = await callRentlyApi(creds.host, token, "/api/services", "PUT", payload);
        break;
      }

      case "cancel": {
        if (!rentlyServiceId) {
          return res.json({
            success: true,
            message: "No hay servicio de Rently asociado a esta reparación",
            skipped: true,
          });
        }
        const payload = buildUpdateServicePayload(rentlyServiceId, repair, plate);
        payload.Status = RENTLY_STATUS.CANCELADO;
        result = await callRentlyApi(creds.host, token, "/api/services", "PUT", payload);
        break;
      }

      default:
        return res.status(400).json({ success: false, error: "Acción no soportada" });
    }

    const success = result!.status >= 200 && result!.status < 300;

    // 4. Audit log
    try {
      await serviceClient.from("audit_logs").insert({
        organization_id: organizationId,
        actor_user_id: userId,
        actor_role: "user",
        action: `rently.service.${action}`,
        entity_type: "repair",
        entity_id: repairId,
        metadata_json: JSON.stringify({
          rently_service_id: rentlyServiceId,
          rently_status: result!.status,
          plate,
          repair_status: repair.status,
          success,
        }),
        ip_address: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
        user_agent: req.headers["user-agent"] || null,
      });
    } catch (auditErr) {
      console.error("[repair-service-sync] Audit log error:", auditErr);
    }

    if (!success) {
      console.error(`[repair-service-sync] Rently error (${result!.status}):`, result!.data);
      return res.status(result!.status).json({
        success: false,
        error: `Rently respondió con error ${result!.status}`,
        rentlyResponse: result!.data,
        rentlyServiceId,
      });
    }

    return res.json({
      success: true,
      action,
      rentlyServiceId,
      rentlyResponse: result!.data,
      plate,
    });
  } catch (error: any) {
    console.error("[repair-service-sync] Error:", error);

    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || "Error desconocido al sincronizar servicio con Rently",
    });
  }
}
