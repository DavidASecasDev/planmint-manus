/**
 * POST /api/repair-rently-poll
 * 
 * Polls Rently for changes to services linked to repairs.
 * Detects:
 *   - Status changes (Finalizado, Cancelado) in Rently → update repair status
 *   - Date changes in Rently → update repair dates
 * 
 * This endpoint is called periodically (e.g., every 15 min) or on-demand.
 * It queries all repairs with a rently_service_id and checks for discrepancies.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

const REQUEST_TIMEOUT_MS = 30000;

// Rently service statuses
const RENTLY_STATUS = {
  PROGRAMADO: 0,
  EN_EJECUCION: 1,
  FINALIZADO: 2,
  CANCELADO: 3,
} as const;

// Map Rently status → Garatech repair status
const RENTLY_TO_GARATECH_STATUS: Record<number, string> = {
  [RENTLY_STATUS.FINALIZADO]: "finalizado",
  [RENTLY_STATUS.CANCELADO]: "finalizado", // Cancelled in Rently = finished in Garatech
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

    if (!response.ok) throw new Error(`Auth failed (${response.status})`);
    const data = await response.json();
    return data.access_token;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout obteniendo token de Rently");
    throw error;
  }
}

interface RentlyService {
  Id: number;
  CarId: string;
  Km: number;
  ServiceType: { Id: number; Name: string } | null;
  Notes: string | null;
  FromDate: string;
  ToDate: string;
  Status: number;
  Provider: string | null;
  Price: number;
  IsFixed: boolean;
  IsLockedForEdit: boolean;
}

async function getRentlyService(host: string, token: string, serviceId: number): Promise<RentlyService | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/api/services/${serviceId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Rently GET service failed (${response.status})`);

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout fetching Rently service");
    throw error;
  }
}

// ─── Sync log helper ────────────────────────────────────────────────────────

async function logSyncEvent(params: {
  repairId: string;
  organizationId: string;
  action: string;
  direction: "outbound" | "inbound";
  rentlyServiceId?: number | null;
  status?: string | null;
  details?: Record<string, any>;
  error?: string | null;
  success: boolean;
  createdBy?: string | null;
}) {
  const serviceClient = getServiceClient();
  try {
    await serviceClient.from("repair_sync_log").insert({
      repair_id: params.repairId,
      organization_id: params.organizationId,
      action: params.action,
      direction: params.direction,
      rently_service_id: params.rentlyServiceId || null,
      status: params.status || null,
      details: params.details || {},
      error: params.error || null,
      success: params.success,
      created_by: params.createdBy || null,
    });
  } catch (err) {
    console.error("[repair-sync-log] Failed to write log:", err);
  }
}

// ─── Main polling handler ───────────────────────────────────────────────────

export async function handleRepairRentlyPoll(req: Request, res: Response) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);

    const serviceClient = getServiceClient();

    // 1. Get all repairs with a linked Rently service that are NOT finalized
    const { data: linkedRepairs, error: repairsError } = await serviceClient
      .from("repairs")
      .select("id, status, started_at, scheduled_date, completed_at, rently_service_id, vehicle_id, notes")
      .eq("organization_id", organizationId)
      .not("rently_service_id", "is", null)
      .not("status", "eq", "finalizado");

    if (repairsError) {
      console.error("[repair-rently-poll] Error fetching repairs:", repairsError);
      return res.status(500).json({ success: false, error: "Error consultando reparaciones" });
    }

    if (!linkedRepairs || linkedRepairs.length === 0) {
      return res.json({ success: true, message: "No hay reparaciones vinculadas a Rently pendientes", checked: 0, updated: 0 });
    }

    // 2. Get Rently credentials and token
    const creds = await getRentlyCredentials(organizationId);
    const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);

    // 3. Check each linked repair against Rently
    const results: Array<{ repairId: string; action: string; success: boolean; details?: any }> = [];
    let updatedCount = 0;

    for (const repair of linkedRepairs) {
      const rentlyServiceId = repair.rently_service_id as number;

      try {
        const rentlyService = await getRentlyService(creds.host, token, rentlyServiceId);

        if (!rentlyService) {
          // Service deleted in Rently — log it but don't change repair status
          await logSyncEvent({
            repairId: repair.id,
            organizationId,
            action: "rently_deleted",
            direction: "inbound",
            rentlyServiceId,
            status: "deleted",
            details: { message: "Servicio eliminado en Rently" },
            success: true,
            createdBy: null,
          });
          results.push({ repairId: repair.id, action: "rently_deleted", success: true });
          continue;
        }

        // Check for status changes
        const rentlyStatus = rentlyService.Status;
        const garatechTargetStatus = RENTLY_TO_GARATECH_STATUS[rentlyStatus];

        if (garatechTargetStatus && repair.status !== garatechTargetStatus) {
          // Rently service was finished or cancelled → update repair
          const updates: Record<string, any> = { status: garatechTargetStatus };
          if (garatechTargetStatus === "finalizado" && !repair.completed_at) {
            updates.completed_at = rentlyService.ToDate
              ? new Date(rentlyService.ToDate).toISOString()
              : new Date().toISOString();
          }

          const { error: updateError } = await serviceClient
            .from("repairs")
            .update(updates)
            .eq("id", repair.id);

          if (!updateError) {
            updatedCount++;
            await logSyncEvent({
              repairId: repair.id,
              organizationId,
              action: rentlyStatus === RENTLY_STATUS.CANCELADO ? "rently_cancel" : "rently_finish",
              direction: "inbound",
              rentlyServiceId,
              status: garatechTargetStatus,
              details: {
                rently_status: rentlyStatus,
                rently_from: rentlyService.FromDate,
                rently_to: rentlyService.ToDate,
                previous_status: repair.status,
              },
              success: true,
              createdBy: null,
            });
            results.push({ repairId: repair.id, action: `status→${garatechTargetStatus}`, success: true });
          } else {
            await logSyncEvent({
              repairId: repair.id,
              organizationId,
              action: "rently_update",
              direction: "inbound",
              rentlyServiceId,
              error: updateError.message,
              success: false,
              createdBy: null,
            });
            results.push({ repairId: repair.id, action: "update_failed", success: false, details: updateError.message });
          }
          continue;
        }

        // Check for date changes (Rently dates differ from Garatech dates)
        const rentlyFrom = rentlyService.FromDate ? new Date(rentlyService.FromDate).toISOString() : null;
        const rentlyTo = rentlyService.ToDate ? new Date(rentlyService.ToDate).toISOString() : null;
        const garatechFrom = repair.started_at ? new Date(repair.started_at).toISOString() : null;
        const garatechTo = repair.scheduled_date ? new Date(repair.scheduled_date).toISOString() : null;

        // Compare dates (with 1-hour tolerance to avoid timezone drift issues)
        const datesDiffer = (a: string | null, b: string | null): boolean => {
          if (!a && !b) return false;
          if (!a || !b) return true;
          return Math.abs(new Date(a).getTime() - new Date(b).getTime()) > 3600000; // 1 hour
        };

        if (datesDiffer(rentlyFrom, garatechFrom) || datesDiffer(rentlyTo, garatechTo)) {
          const dateUpdates: Record<string, any> = {};
          if (datesDiffer(rentlyFrom, garatechFrom) && rentlyFrom) {
            dateUpdates.started_at = rentlyFrom;
          }
          if (datesDiffer(rentlyTo, garatechTo) && rentlyTo) {
            dateUpdates.scheduled_date = rentlyTo;
          }

          if (Object.keys(dateUpdates).length > 0) {
            const { error: updateError } = await serviceClient
              .from("repairs")
              .update(dateUpdates)
              .eq("id", repair.id);

            if (!updateError) {
              updatedCount++;
              await logSyncEvent({
                repairId: repair.id,
                organizationId,
                action: "rently_update",
                direction: "inbound",
                rentlyServiceId,
                status: repair.status,
                details: {
                  dates_updated: dateUpdates,
                  rently_from: rentlyService.FromDate,
                  rently_to: rentlyService.ToDate,
                  previous_from: repair.started_at,
                  previous_to: repair.scheduled_date,
                },
                success: true,
                createdBy: null,
              });
              results.push({ repairId: repair.id, action: "dates_updated", success: true });
            } else {
              results.push({ repairId: repair.id, action: "date_update_failed", success: false });
            }
          }
        }

        // No changes detected
        if (!results.find(r => r.repairId === repair.id)) {
          results.push({ repairId: repair.id, action: "no_change", success: true });
        }
      } catch (err: any) {
        console.error(`[repair-rently-poll] Error checking repair ${repair.id}:`, err);
        await logSyncEvent({
          repairId: repair.id,
          organizationId,
          action: "rently_update",
          direction: "inbound",
          rentlyServiceId,
          error: err?.message || "Unknown error",
          success: false,
          createdBy: null,
        });
        results.push({ repairId: repair.id, action: "error", success: false, details: err?.message });
      }
    }

    return res.json({
      success: true,
      checked: linkedRepairs.length,
      updated: updatedCount,
      results,
    });
  } catch (error: any) {
    console.error("[repair-rently-poll] Error:", error);

    if (error instanceof AuthError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || "Error desconocido al sincronizar con Rently",
    });
  }
}

// ─── Export the logSyncEvent for use in repairServiceSync.ts ────────────────
export { logSyncEvent };
