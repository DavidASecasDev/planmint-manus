/**
 * Scheduled handler: Rently Detail Enrichment Retry
 * 
 * Runs every hour. Finds reservations with rently_detail_synced_at = null
 * (i.e., detail was never fetched from Rently) that are active or upcoming,
 * and fetches their extras/details from the Rently API.
 * 
 * This prevents the scenario where a reservation is synced from the bookings
 * list but its detail (extras like baby seats, drivers, etc.) was skipped due
 * to time/batch limits during the main sync.
 * 
 * Path: POST /api/scheduled/rently-enrich
 * Auth: Manus Heartbeat cron identity (validated via x-manus-cron-task-uid header)
 */
import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import {
  enrichReservationsFromRentlyForSes,
  shouldRetryRentlySesEnrichment,
  type ReservationForSesEnrichment,
} from "./sesHospedajes/rentlyEnrichment";

const MAX_ENRICHMENTS_PER_RUN = 50; // Stay well within 2-min handler timeout

// ─── Main scheduled handler ─────────────────────────────────────────────────

export async function handleScheduledRentlyEnrich(req: Request, res: Response) {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;

  try {
    // Validate this is a cron call (header or cookie-based cron identity)
    if (!taskUid) {
      try {
        const { sdk } = await import("./_core/sdk");
        const user = await sdk.authenticateRequest(req) as any;
        if (!user.isCron) {
          return res.status(403).json({ error: "cron-only" });
        }
      } catch {
        return res.status(403).json({ error: "cron-only" });
      }
    }

    const serviceClient = getServiceClient();

    // 1. Get all organizations with Rently configured
    const { data: orgs, error: orgsError } = await serviceClient
      .from("integration_settings")
      .select("organization_id, rently_api_host, rently_client_id, rently_client_secret")
      .not("rently_client_id", "is", null)
      .not("rently_client_secret", "is", null);

    if (orgsError || !orgs || orgs.length === 0) {
      return res.json({
        ok: true,
        message: "No organizations with Rently configured",
        enriched: 0,
      });
    }

    let totalEnriched = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const orgResults: Array<{
      orgId: string;
      found: number;
      enriched: number;
      failed: number;
    }> = [];

    // 2. Process each organization
    for (const org of orgs) {
      const orgId = org.organization_id;
      const host = org.rently_api_host || "azul.rently.com.ar";
      const clientId = org.rently_client_id;
      const clientSecret = org.rently_client_secret;

      let orgEnriched = 0;
      let orgFailed = 0;

      try {
        // Find active/upcoming reservations and re-enrich missing SES fields at most once daily.
        // Include reservations from the last 14 days AND all future reservations
        // This ensures we don't miss reservations that were synced from the list
        // but never had their detail fetched (e.g., due to timeout)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 14);

        const { data: reservations, error: queryError } = await serviceClient
          .from("reservations")
          .select(`
            id,external_reservation_id,auto,imported_by,rently_detail_synced_at,
            vehiculo_chasis,vehiculo_kms,cliente_fecha_nacimiento,cliente_direccion,
            cliente_pais,cliente_carnet_numero,cliente_carnet_expiracion
          `)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .not("external_reservation_id", "is", null)
          .neq("estado", "Cancelada")
          .gte("desde", cutoffDate.toISOString())
          .order("desde", { ascending: true })
          .limit(250);

        const candidates = ((reservations ?? []) as ReservationForSesEnrichment[])
          .filter((reservation) => shouldRetryRentlySesEnrichment(reservation))
          .slice(0, MAX_ENRICHMENTS_PER_RUN);

        if (queryError || candidates.length === 0) {
          orgResults.push({ orgId, found: 0, enriched: 0, failed: queryError ? 1 : 0 });
          continue;
        }

        console.log(
          `[scheduled-rently-enrich] Org ${orgId}: found ${candidates.length} incomplete reservations eligible for retry`
        );
        const result = await enrichReservationsFromRentlyForSes({
          serviceClient,
          organizationId: orgId,
          reservations: candidates,
          credentials: { host, clientId, clientSecret },
          maxReservations: MAX_ENRICHMENTS_PER_RUN,
        });
        orgEnriched = result.enriched;
        orgFailed = result.failed;
      } catch (err: any) {
        orgFailed++;
        console.error(
          `[scheduled-rently-enrich] Error processing org ${orgId}:`,
          err?.message
        );
      }

      totalEnriched += orgEnriched;
      totalFailed += orgFailed;
      orgResults.push({
        orgId,
        found: (orgEnriched + orgFailed),
        enriched: orgEnriched,
        failed: orgFailed,
      });
    }

    return res.json({
      ok: true,
      enriched: totalEnriched,
      failed: totalFailed,
      organizations: orgResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[scheduled-rently-enrich] Fatal error:", error);
    return res.status(500).json({
      error: error?.message || "Unknown error",
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
