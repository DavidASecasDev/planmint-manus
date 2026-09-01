import crypto from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { authenticateExternalApi, createCorrelationId, ExternalApiError, logExternalApiRequest } from "./externalApiAuth";
import { createWebhookSchema, formatZodIssues, updateWebhookSchema } from "./externalTransferApiContract";
import { getServiceClient } from "./supabaseAdmin";
import {
  assertWebhookDestination,
  decryptWebhookSecret,
  deliverWebhookPayload,
  encryptWebhookSecret,
  generateWebhookSecret,
} from "./externalWebhookSecurity";

const router = Router();
const uuidSchema = z.string().uuid();

function headers(res: Response, requestId: string) {
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-API-Version", "1.0.0");
  res.setHeader("Cache-Control", "no-store");
}

function fail(res: Response, requestId: string, status: number, code: string, message: string, details?: unknown) {
  headers(res, requestId);
  return res.status(status).json({ success: false, request_id: requestId, error: { code, message, ...(details ? { details } : {}) } });
}

async function authenticated(req: Request, res: Response, requestId: string) {
  try {
    return await authenticateExternalApi(req, "webhooks.manage");
  } catch (error) {
    if (error instanceof ExternalApiError) {
      fail(res, requestId, error.status, error.code, error.message);
      return null;
    }
    fail(res, requestId, 500, "INTERNAL_ERROR", "Authentication failed.");
    return null;
  }
}

async function audit(req: Request, auth: { apiKeyId: string; organizationId: string }, requestId: string, statusCode: number, startedAt: number, errorCode?: string) {
  await logExternalApiRequest({
    apiKeyId: auth.apiKeyId,
    organizationId: auth.organizationId,
    method: req.method,
    endpoint: req.path,
    statusCode,
    correlationId: requestId,
    durationMs: Date.now() - startedAt,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    errorCode,
  });
}

router.get("/", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const { data, error } = await getServiceClient()
    .from("external_api_webhooks")
    .select("id, name, url, events, is_active, created_at, updated_at, last_delivery_at, last_success_at, last_error")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });
  if (error) {
    await audit(req, auth, requestId, 500, startedAt, "INTERNAL_ERROR");
    return fail(res, requestId, 500, "INTERNAL_ERROR", "Failed to list webhooks.");
  }
  await audit(req, auth, requestId, 200, startedAt);
  headers(res, requestId);
  return res.json({ success: true, request_id: requestId, data: data || [] });
});

router.post("/", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const parsed = createWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    await audit(req, auth, requestId, 400, startedAt, "VALIDATION_ERROR");
    return fail(res, requestId, 400, "VALIDATION_ERROR", "The webhook configuration is invalid.", formatZodIssues(parsed.error));
  }
  try {
    await assertWebhookDestination(parsed.data.url);
    const signingSecret = generateWebhookSecret();
    const { data, error } = await getServiceClient()
      .from("external_api_webhooks")
      .insert({
        organization_id: auth.organizationId,
        name: parsed.data.name,
        url: parsed.data.url,
        events: parsed.data.events,
        encrypted_secret: encryptWebhookSecret(signingSecret),
      })
      .select("id, name, url, events, is_active, created_at")
      .single();
    if (error || !data) throw error || new Error("Webhook insert failed");
    await audit(req, auth, requestId, 201, startedAt);
    headers(res, requestId);
    return res.status(201).json({ success: true, request_id: requestId, data: { ...data, signing_secret: signingSecret } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook creation failed";
    await audit(req, auth, requestId, 400, startedAt, "INVALID_WEBHOOK_DESTINATION");
    return fail(res, requestId, 400, "INVALID_WEBHOOK_DESTINATION", message);
  }
});

router.patch("/:id", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  const parsed = updateWebhookSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    return fail(res, requestId, 400, "VALIDATION_ERROR", "The webhook update is invalid.", parsed.success ? undefined : formatZodIssues(parsed.error));
  }
  try {
    if (parsed.data.url) await assertWebhookDestination(parsed.data.url);
    const { data, error } = await getServiceClient()
      .from("external_api_webhooks")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id.data)
      .eq("organization_id", auth.organizationId)
      .select("id, name, url, events, is_active, updated_at")
      .single();
    if (error || !data) return fail(res, requestId, 404, "NOT_FOUND", "Webhook not found.");
    await audit(req, auth, requestId, 200, startedAt);
    headers(res, requestId);
    return res.json({ success: true, request_id: requestId, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook update failed";
    return fail(res, requestId, 400, "INVALID_WEBHOOK_DESTINATION", message);
  }
});

router.delete("/:id", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return fail(res, requestId, 400, "VALIDATION_ERROR", "The webhook id must be a UUID.");
  const { data, error } = await getServiceClient()
    .from("external_api_webhooks")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("organization_id", auth.organizationId)
    .select("id")
    .single();
  if (error || !data) return fail(res, requestId, 404, "NOT_FOUND", "Webhook not found.");
  await audit(req, auth, requestId, 200, startedAt);
  headers(res, requestId);
  return res.json({ success: true, request_id: requestId, data: { id: id.data, is_active: false } });
});

router.post("/:id/rotate-secret", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return fail(res, requestId, 400, "VALIDATION_ERROR", "The webhook id must be a UUID.");
  const signingSecret = generateWebhookSecret();
  const { data, error } = await getServiceClient()
    .from("external_api_webhooks")
    .update({ encrypted_secret: encryptWebhookSecret(signingSecret), updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("organization_id", auth.organizationId)
    .select("id")
    .single();
  if (error || !data) return fail(res, requestId, 404, "NOT_FOUND", "Webhook not found.");
  await audit(req, auth, requestId, 200, startedAt);
  headers(res, requestId);
  return res.json({ success: true, request_id: requestId, data: { id: id.data, signing_secret: signingSecret } });
});

router.get("/:id/deliveries", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return fail(res, requestId, 400, "VALIDATION_ERROR", "The webhook id must be a UUID.");
  const { data, error } = await getServiceClient()
    .from("external_api_webhook_deliveries")
    .select("id, event_id, event_type, status, attempt_count, next_attempt_at, last_attempt_at, delivered_at, response_status, last_error, created_at")
    .eq("webhook_id", id.data)
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail(res, requestId, 500, "INTERNAL_ERROR", "Failed to list webhook deliveries.");
  await audit(req, auth, requestId, 200, startedAt);
  headers(res, requestId);
  return res.json({ success: true, request_id: requestId, data: data || [] });
});

router.post("/:id/test", async (req, res) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticated(req, res, requestId);
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return fail(res, requestId, 400, "VALIDATION_ERROR", "The webhook id must be a UUID.");

  const supabase = getServiceClient();
  const { data: webhook, error } = await supabase
    .from("external_api_webhooks")
    .select("id, url, encrypted_secret, is_active")
    .eq("id", id.data)
    .eq("organization_id", auth.organizationId)
    .single();
  if (error || !webhook || !webhook.is_active) return fail(res, requestId, 404, "NOT_FOUND", "Active webhook not found.");

  const eventId = crypto.randomUUID();
  const payload = {
    event_id: eventId,
    type: "transfer.status_changed",
    occurred_at: new Date().toISOString(),
    test: true,
    data: {
      transfer_id: "00000000-0000-0000-0000-000000000000",
      request_number: "TRF-TEST",
      status: "pendiente",
      previous_status: null,
      updated_at: new Date().toISOString(),
    },
  };
  const { data: delivery, error: deliveryError } = await supabase
    .from("external_api_webhook_deliveries")
    .insert({
      webhook_id: webhook.id,
      organization_id: auth.organizationId,
      event_id: eventId,
      event_type: "transfer.status_changed",
      payload,
      status: "delivering",
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (deliveryError || !delivery) return fail(res, requestId, 500, "INTERNAL_ERROR", "Could not create test delivery.");

  try {
    const result = await deliverWebhookPayload({
      url: webhook.url,
      secret: decryptWebhookSecret(webhook.encrypted_secret),
      eventType: "transfer.status_changed",
      deliveryId: delivery.id,
      payload,
    });
    await supabase.from("external_api_webhook_deliveries").update({
      status: "delivered",
      response_status: result.status,
      delivered_at: new Date().toISOString(),
    }).eq("id", delivery.id);
    await audit(req, auth, requestId, 200, startedAt);
    headers(res, requestId);
    return res.json({ success: true, request_id: requestId, data: { delivery_id: delivery.id, status: "delivered", response_status: result.status } });
  } catch (deliveryFailure) {
    const message = deliveryFailure instanceof Error ? deliveryFailure.message : "Webhook delivery failed";
    await supabase.from("external_api_webhook_deliveries").update({ status: "failed", last_error: message }).eq("id", delivery.id);
    await audit(req, auth, requestId, 502, startedAt, "WEBHOOK_DELIVERY_FAILED");
    return fail(res, requestId, 502, "WEBHOOK_DELIVERY_FAILED", message);
  }
});

export default router;
