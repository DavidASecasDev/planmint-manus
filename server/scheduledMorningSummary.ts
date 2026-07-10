/**
 * Scheduled handler: Morning Summary Notification
 * 
 * Runs daily at 07:00 Europe/Madrid (05:00 UTC in summer, 06:00 UTC in winter).
 * Sends a push notification to all active org members with:
 * - Number of transfers scheduled for today
 * - Number of reservations for today (pickups + returns)
 * 
 * Path: POST /api/scheduled/morning-summary
 * Auth: Manus Heartbeat cron identity (validated via x-manus-cron-task-uid header)
 */
import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import { sendOperationalNotification } from "./notificationHelper";

/**
 * Get today's date range in Europe/Madrid timezone
 */
function getTodayRangeMadrid(): { startOfDay: string; endOfDay: string; dateLabel: string } {
  // Get current time in Madrid timezone
  const now = new Date();
  const madridFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = madridFormatter.formatToParts(now);
  const year = parts.find(p => p.type === "year")!.value;
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;

  const dateStr = `${year}-${month}-${day}`;
  const startOfDay = `${dateStr}T00:00:00`;
  const endOfDay = `${dateStr}T23:59:59`;

  // Human-readable label
  const labelFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dateLabel = labelFormatter.format(now);

  return { startOfDay, endOfDay, dateLabel };
}

export async function handleScheduledMorningSummary(req: Request, res: Response) {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;

  try {
    // Validate this is a cron call
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
    const { startOfDay, endOfDay, dateLabel } = getTodayRangeMadrid();

    // Get all organizations
    const { data: orgs, error: orgsError } = await serviceClient
      .from("organizations")
      .select("id, name");

    if (orgsError || !orgs || orgs.length === 0) {
      return res.json({ ok: true, skipped: "no-organizations", timestamp: new Date().toISOString() });
    }

    const results: Array<{ orgId: string; transfers: number; reservations: number; notified: number }> = [];

    for (const org of orgs) {
      try {
        // Count transfers for today
        // transfer_items have a date field - count items scheduled for today
        const { count: transferCount, error: transferError } = await serviceClient
          .from("transfer_items")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("date", startOfDay)
          .lte("date", endOfDay);

        // Count reservations for today (pickups and returns)
        // Reservations where fecha_hora_inicio or fecha_hora_fin falls on today
        const { count: pickupCount } = await serviceClient
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("fecha_hora_inicio", startOfDay)
          .lte("fecha_hora_inicio", endOfDay)
          .neq("status", "Cancelada");

        const { count: returnCount } = await serviceClient
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("fecha_hora_fin", startOfDay)
          .lte("fecha_hora_fin", endOfDay)
          .neq("status", "Cancelada");

        const totalTransfers = transferCount || 0;
        const totalPickups = pickupCount || 0;
        const totalReturns = returnCount || 0;
        const totalReservations = totalPickups + totalReturns;

        // Only send notification if there's something to report
        if (totalTransfers === 0 && totalReservations === 0) {
          results.push({ orgId: org.id, transfers: 0, reservations: 0, notified: 0 });
          continue;
        }

        // Build notification message
        const parts: string[] = [];
        if (totalTransfers > 0) {
          parts.push(`${totalTransfers} transfer${totalTransfers > 1 ? "s" : ""}`);
        }
        if (totalReservations > 0) {
          const details: string[] = [];
          if (totalPickups > 0) details.push(`${totalPickups} entrega${totalPickups > 1 ? "s" : ""}`);
          if (totalReturns > 0) details.push(`${totalReturns} devolución${totalReturns > 1 ? "es" : ""}`);
          parts.push(`${totalReservations} reserva${totalReservations > 1 ? "s" : ""} (${details.join(", ")})`);
        }

        const title = `📋 Resumen del día — ${dateLabel}`;
        const body = `Hoy tienes: ${parts.join(" y ")}.`;

        // Send notification to all org members (using nueva_reserva type so it passes the filter)
        await sendOperationalNotification(serviceClient, {
          organizationId: org.id,
          eventKey: "nueva_reserva",
          notificationType: "nueva_reserva",
          title,
          body,
          entityType: "daily_summary",
          entityId: startOfDay.split("T")[0],
        });

        results.push({ orgId: org.id, transfers: totalTransfers, reservations: totalReservations, notified: 1 });
      } catch (orgErr: any) {
        console.warn(`[morning-summary] Error for org ${org.id}:`, orgErr?.message);
        results.push({ orgId: org.id, transfers: 0, reservations: 0, notified: 0 });
      }
    }

    return res.json({
      ok: true,
      results,
      date: startOfDay.split("T")[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[scheduled-morning-summary] Fatal error:", error);
    return res.status(500).json({
      error: error?.message || "Unknown error",
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
