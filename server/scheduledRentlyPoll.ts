/**
 * Scheduled handler: Rently Service Poll (Bidirectional Sync)
 * 
 * Runs every 15 minutes. Checks all active repairs with a linked Rently service
 * and detects status/date changes from Rently, updating repairs in Garatech.
 * 
 * Path: POST /api/scheduled/rently-poll
 * Auth: Manus Heartbeat cron identity (validated via x-manus-cron-task-uid header)
 */
import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";

const REQUEST_TIMEOUT_MS = 25000; // 25s to stay within 2min handler timeout

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
  [RENTLY_STATUS.CANCELADO]: "finalizado",
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
  ServiceType: { Id: number; Name: string } | null;
  Notes: string | null;
  FromDate: string;
  ToDate: string;
  Status: number;
  Provider: string | null;
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
      created_by: null, // cron has no user
    });
  } catch (err) {
    console.error("[scheduled-rently-poll] Failed to write sync log:", err);
  }
}

// ─── Main scheduled handler ─────────────────────────────────────────────────

export async function handleScheduledRentlyPoll(req: Request, res: Response) {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;

  try {
    // Validate this is a cron call via the platform header
    if (!taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const serviceClient = getServiceClient();

    // 1. Get all organizations with Rently configured
    const { data: orgs, error: orgsError } = await serviceClient
      .from("integration_settings")
      .select("organization_id")
      .not("rently_client_id", "is", null)
      .not("rently_client_secret", "is", null);

    if (orgsError || !orgs || orgs.length === 0) {
      return res.json({
        ok: true,
        message: "No organizations with Rently configured",
        checked: 0,
        updated: 0,
      });
    }

    let totalChecked = 0;
    let totalUpdated = 0;
    const orgResults: Array<{ orgId: string; checked: number; updated: number; errors: number }> = [];

    // 2. Process each organization
    for (const org of orgs) {
      const orgId = org.organization_id;
      let orgChecked = 0;
      let orgUpdated = 0;
      let orgErrors = 0;

      try {
        // Get repairs with linked Rently services that are NOT finalized
        const { data: linkedRepairs, error: repairsError } = await serviceClient
          .from("repairs")
          .select("id, status, started_at, scheduled_date, completed_at, rently_service_id, vehicle_id, notes")
          .eq("organization_id", orgId)
          .not("rently_service_id", "is", null)
          .not("status", "eq", "finalizado");

        if (repairsError || !linkedRepairs || linkedRepairs.length === 0) {
          orgResults.push({ orgId, checked: 0, updated: 0, errors: repairsError ? 1 : 0 });
          continue;
        }

        // Get Rently credentials and token for this org
        const creds = await getRentlyCredentials(orgId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);

        // Check each linked repair against Rently
        for (const repair of linkedRepairs) {
          orgChecked++;
          const rentlyServiceId = repair.rently_service_id as number;

          try {
            const rentlyService = await getRentlyService(creds.host, token, rentlyServiceId);

            if (!rentlyService) {
              // Service deleted in Rently
              await logSyncEvent({
                repairId: repair.id,
                organizationId: orgId,
                action: "rently_deleted",
                direction: "inbound",
                rentlyServiceId,
                status: "deleted",
                details: { message: "Servicio eliminado en Rently" },
                success: true,
              });
              continue;
            }

            // Check for status changes
            const rentlyStatus = rentlyService.Status;
            const garatechTargetStatus = RENTLY_TO_GARATECH_STATUS[rentlyStatus];

            if (garatechTargetStatus && repair.status !== garatechTargetStatus) {
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
                orgUpdated++;
                await logSyncEvent({
                  repairId: repair.id,
                  organizationId: orgId,
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
                });
              } else {
                orgErrors++;
              }
              continue;
            }

            // Check for date changes (1-hour tolerance)
            const rentlyFrom = rentlyService.FromDate ? new Date(rentlyService.FromDate).toISOString() : null;
            const rentlyTo = rentlyService.ToDate ? new Date(rentlyService.ToDate).toISOString() : null;
            const garatechFrom = repair.started_at ? new Date(repair.started_at).toISOString() : null;
            const garatechTo = repair.scheduled_date ? new Date(repair.scheduled_date).toISOString() : null;

            const datesDiffer = (a: string | null, b: string | null): boolean => {
              if (!a && !b) return false;
              if (!a || !b) return true;
              return Math.abs(new Date(a).getTime() - new Date(b).getTime()) > 3600000;
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
                  orgUpdated++;
                  await logSyncEvent({
                    repairId: repair.id,
                    organizationId: orgId,
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
                  });
                } else {
                  orgErrors++;
                }
              }
            }
          } catch (err: any) {
            orgErrors++;
            console.error(`[scheduled-rently-poll] Error checking repair ${repair.id}:`, err?.message);
            await logSyncEvent({
              repairId: repair.id,
              organizationId: orgId,
              action: "rently_update",
              direction: "inbound",
              rentlyServiceId,
              error: err?.message || "Unknown error",
              success: false,
            });
          }
        }
      } catch (err: any) {
        orgErrors++;
        console.error(`[scheduled-rently-poll] Error processing org ${orgId}:`, err?.message);
      }

      totalChecked += orgChecked;
      totalUpdated += orgUpdated;
      orgResults.push({ orgId, checked: orgChecked, updated: orgUpdated, errors: orgErrors });
    }

    return res.json({
      ok: true,
      checked: totalChecked,
      updated: totalUpdated,
      organizations: orgResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[scheduled-rently-poll] Fatal error:", error);
    return res.status(500).json({
      error: error?.message || "Unknown error",
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
