import type { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import { sdk } from "./_core/sdk";
import { decryptWebhookSecret, deliverWebhookPayload } from "./externalWebhookSecurity";

const MAX_ATTEMPTS = 6;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000];

type ClaimedDelivery = {
  id: string;
  webhook_id: string;
  organization_id: string;
  event_type: string;
  payload: unknown;
  attempt_count: number;
};

export async function dispatchPendingExternalWebhooks(limit = 50): Promise<{
  claimed: number;
  delivered: number;
  failed: number;
  exhausted: number;
}> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("claim_external_api_webhook_deliveries", {
    p_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (error) throw new Error(`Could not claim webhook deliveries: ${error.message}`);

  const deliveries = (data || []) as ClaimedDelivery[];
  let delivered = 0;
  let failed = 0;
  let exhausted = 0;

  for (const delivery of deliveries) {
    const { data: webhook, error: webhookError } = await supabase
      .from("external_api_webhooks")
      .select("id, url, encrypted_secret, is_active")
      .eq("id", delivery.webhook_id)
      .eq("organization_id", delivery.organization_id)
      .single();

    if (webhookError || !webhook || !webhook.is_active) {
      exhausted++;
      await supabase.from("external_api_webhook_deliveries").update({
        status: "exhausted",
        last_error: "Webhook is missing or inactive",
      }).eq("id", delivery.id);
      continue;
    }

    try {
      const result = await deliverWebhookPayload({
        url: webhook.url,
        secret: decryptWebhookSecret(webhook.encrypted_secret),
        eventType: delivery.event_type,
        deliveryId: delivery.id,
        payload: delivery.payload,
      });
      delivered++;
      const deliveredAt = new Date().toISOString();
      await supabase.from("external_api_webhook_deliveries").update({
        status: "delivered",
        response_status: result.status,
        response_excerpt: null,
        last_error: null,
        delivered_at: deliveredAt,
      }).eq("id", delivery.id);
      await supabase.from("external_api_webhooks").update({
        last_delivery_at: deliveredAt,
        last_success_at: deliveredAt,
        last_error: null,
        updated_at: deliveredAt,
      }).eq("id", webhook.id);
    } catch (deliveryError) {
      const message = deliveryError instanceof Error ? deliveryError.message.slice(0, 500) : "Webhook delivery failed";
      const hasExhausted = delivery.attempt_count >= MAX_ATTEMPTS;
      if (hasExhausted) exhausted++;
      else failed++;
      const retryDelay = RETRY_DELAYS_MS[Math.min(Math.max(delivery.attempt_count - 1, 0), RETRY_DELAYS_MS.length - 1)];
      await supabase.from("external_api_webhook_deliveries").update({
        status: hasExhausted ? "exhausted" : "failed",
        response_status: null,
        response_excerpt: null,
        last_error: message,
        next_attempt_at: new Date(Date.now() + retryDelay).toISOString(),
      }).eq("id", delivery.id);
      await supabase.from("external_api_webhooks").update({
        last_delivery_at: new Date().toISOString(),
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", webhook.id);
    }
  }

  return { claimed: deliveries.length, delivered, failed, exhausted };
}

export async function handleScheduledExternalWebhooks(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;

    const { data: config } = await getServiceClient()
      .from("external_api_webhook_dispatcher_config")
      .select("schedule_cron_task_uid")
      .eq("singleton_key", "global")
      .eq("schedule_cron_task_uid", taskUid)
      .single();
    if (!config) return res.status(403).json({ error: "unknown-task" });

    const result = await dispatchPendingExternalWebhooks(50);
    return res.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook dispatcher error";
    return res.status(500).json({
      error: message,
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
