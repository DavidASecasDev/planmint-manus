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
  getRentlyToken,
  fetchBookingDetail,
  fetchBookingDrivers,
  enrichReservationWithDetail,
} from "./syncRently";

const MAX_ENRICHMENTS_PER_RUN = 50; // Stay well within 2-min handler timeout
const DETAIL_CONCURRENCY = 5;

// ─── Main scheduled handler ─────────────────────────────────────────────────

export async function handleScheduledRentlyEnrich(req: Request, res: Response) {
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
        // Find reservations that have never been enriched and are active/upcoming
        // Include reservations from the last 14 days AND all future reservations
        // This ensures we don't miss reservations that were synced from the list
        // but never had their detail fetched (e.g., due to timeout)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 14);

        const { data: unenriched, error: queryError } = await serviceClient
          .from("reservations")
          .select("id, external_reservation_id")
          .eq("organization_id", orgId)
          .is("rently_detail_synced_at", null)
          .is("archived_at", null)
          .not("external_reservation_id", "is", null)
          .neq("estado", "Cancelada")
          .gte("desde", cutoffDate.toISOString())
          .order("desde", { ascending: true })
          .limit(MAX_ENRICHMENTS_PER_RUN);

        if (queryError || !unenriched || unenriched.length === 0) {
          orgResults.push({ orgId, found: 0, enriched: 0, failed: queryError ? 1 : 0 });
          continue;
        }

        console.log(
          `[scheduled-rently-enrich] Org ${orgId}: found ${unenriched.length} unenriched reservations`
        );

        // Get Rently token
        const token = await getRentlyToken(host, clientId, clientSecret);

        // Fetch details in parallel with controlled concurrency
        for (let i = 0; i < unenriched.length; i += DETAIL_CONCURRENCY) {
          const chunk = unenriched.slice(i, i + DETAIL_CONCURRENCY);

          const promises = chunk.map(async (reservation) => {
            const bookingId = parseInt(reservation.external_reservation_id!);
            if (isNaN(bookingId)) return { id: reservation.id, success: false };

            try {
              const detail = await fetchBookingDetail(host, token, bookingId);
              if (!detail) return { id: reservation.id, success: false };

              const drivers = await fetchBookingDrivers(host, token, bookingId);

              // Build enrichment data using the same function as the main sync
              const enriched = enrichReservationWithDetail(
                { external_reservation_id: reservation.external_reservation_id },
                detail,
                drivers
              );

              // Only update fields that exist in the reservations table
              const updateFields: Record<string, unknown> = {};
              const detailKeys = [
                "extras_contratados",
                "desglose_precios",
                "conductores_adicionales",
                "cliente_direccion",
                "cliente_ciudad",
                "cliente_estado_provincia",
                "cliente_pais",
                "cliente_fecha_nacimiento",
                "cliente_carnet_numero",
                "cliente_carnet_pais",
                "cliente_carnet_expiracion",
                "cliente_notas",
                "vehiculo_kms",
                "vehiculo_combustible",
                "vehiculo_color",
                "vehiculo_anio",
                "vehiculo_chasis",
                "vehiculo_tipo_combustible",
                "balance",
                "total_pagado_rently",
                "prepago",
                "pagado_por_agencia",
                "pagado_por_cliente",
                "moneda",
                "comision_ventas",
                "tarifa_diaria",
                "tarifa_hora",
                "tarifa_dia_extra",
                "tarifa_hora_extra",
                "km_ilimitados",
                "km_max_permitidos",
                "km_max_por_dia",
                "rently_detail_synced_at",
              ];

              for (const key of detailKeys) {
                if (key in enriched && enriched[key] !== undefined) {
                  updateFields[key] = enriched[key];
                }
              }

              if (Object.keys(updateFields).length === 0) {
                // At minimum, mark as synced so we don't retry forever
                updateFields.rently_detail_synced_at = new Date().toISOString();
              }

              const { error: updateError } = await serviceClient
                .from("reservations")
                .update(updateFields)
                .eq("id", reservation.id);

              return { id: reservation.id, success: !updateError };
            } catch (err: any) {
              console.warn(
                `[scheduled-rently-enrich] Failed to enrich reservation ${reservation.id} (booking ${bookingId}):`,
                err?.message
              );
              return { id: reservation.id, success: false };
            }
          });

          const results = await Promise.allSettled(promises);
          for (const result of results) {
            if (result.status === "fulfilled") {
              if (result.value.success) {
                orgEnriched++;
              } else {
                orgFailed++;
              }
            } else {
              orgFailed++;
            }
          }
        }
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
