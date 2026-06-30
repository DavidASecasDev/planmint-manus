/**
 * Scheduled handler: Lost & Found Expiry
 * 
 * Runs daily. Marks lost_found_items as 'unclaimed' if they have been
 * in 'found' or 'contacted' status for more than 30 days.
 * 
 * Path: POST /api/scheduled/lost-found-expiry
 * Auth: Manus Heartbeat cron identity (validated via x-manus-cron-task-uid header)
 */
import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";

export async function handleScheduledLostFoundExpiry(req: Request, res: Response) {
  try {
    // Validate this is a cron call (header or cookie-based cron identity)
    const cronTaskUid = req.headers["x-manus-cron-task-uid"];
    if (!cronTaskUid) {
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

    const supabase = getServiceClient();

    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISO = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // Find items that are still 'found' or 'contacted' and older than 30 days
    const { data: expiredItems, error: fetchError } = await supabase
      .from("lost_found_items")
      .select("id, status, found_date, description")
      .in("status", ["found", "contacted"])
      .lte("found_date", cutoffISO);

    if (fetchError) {
      console.error("[LostFound Expiry] Error fetching expired items:", fetchError);
      return res.status(500).json({
        error: fetchError.message,
        context: { url: req.url, taskUid: cronTaskUid },
        timestamp: new Date().toISOString(),
      });
    }

    if (!expiredItems || expiredItems.length === 0) {
      return res.json({ ok: true, updated: 0, message: "No items to expire" });
    }

    // Update all expired items to 'unclaimed'
    const expiredIds = expiredItems.map((item) => item.id);

    const { error: updateError, count } = await supabase
      .from("lost_found_items")
      .update({
        status: "unclaimed",
        notes: `Marcado automáticamente como no reclamado tras 30 días (${new Date().toLocaleDateString("es-ES")})`,
      })
      .in("id", expiredIds);

    if (updateError) {
      console.error("[LostFound Expiry] Error updating items:", updateError);
      return res.status(500).json({
        error: updateError.message,
        context: { url: req.url, taskUid: cronTaskUid },
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[LostFound Expiry] Marked ${expiredIds.length} items as unclaimed`);

    return res.json({
      ok: true,
      updated: expiredIds.length,
      items: expiredItems.map((i) => ({
        id: i.id,
        description: i.description?.substring(0, 50),
        found_date: i.found_date,
        previous_status: i.status,
      })),
    });
  } catch (err: any) {
    console.error("[LostFound Expiry] Unexpected error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
      stack: err.stack,
      context: { url: req.url, taskUid: req.headers["x-manus-cron-task-uid"] },
      timestamp: new Date().toISOString(),
    });
  }
}
