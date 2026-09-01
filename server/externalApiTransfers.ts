/** API externa bidireccional de Transfers v1. */
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import {
  authenticateExternalApi,
  createCorrelationId,
  ExternalApiError,
  logExternalApiRequest,
  type ExternalApiAuth,
} from "./externalApiAuth";
import {
  buildExternalRequestHash,
  cancelExternalTransferSchema,
  createExternalTransferSchema,
  formatZodIssues,
  idempotencyKeySchema,
  sha256,
  TRANSFER_REQUEST_STATUSES,
} from "./externalTransferApiContract";
import { getServiceClient } from "./supabaseAdmin";
import { onTransferCreated, onTransferStatusChanged } from "./automationEngine";

const router = Router();
const uuidSchema = z.string().uuid();
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(TRANSFER_REQUEST_STATUSES).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(120).regex(/^[A-Za-z0-9À-ÿ\s-]+$/).optional(),
});

function setHeaders(res: Response, requestId: string) {
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-API-Version", "1.0.0");
  res.setHeader("Cache-Control", "no-store");
}

function sendError(res: Response, requestId: string, status: number, code: string, message: string, details?: unknown) {
  setHeaders(res, requestId);
  return res.status(status).json({
    success: false,
    request_id: requestId,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });
}

function requestIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.ip;
}

async function audit(params: {
  req: Request;
  auth: ExternalApiAuth;
  requestId: string;
  statusCode: number;
  startedAt: number;
  transferRequestId?: string;
  idempotencyKeyHash?: string;
  errorCode?: string;
}) {
  await logExternalApiRequest({
    apiKeyId: params.auth.apiKeyId,
    organizationId: params.auth.organizationId,
    method: params.req.method,
    endpoint: params.req.path,
    statusCode: params.statusCode,
    ipAddress: requestIp(params.req),
    userAgent: params.req.headers["user-agent"],
    durationMs: Date.now() - params.startedAt,
    correlationId: params.requestId,
    transferRequestId: params.transferRequestId,
    idempotencyKeyHash: params.idempotencyKeyHash,
    errorCode: params.errorCode,
  });
}

function mapRpcError(error: { message?: string } | null | undefined) {
  const message = error?.message || "";
  if (message.includes("IDEMPOTENCY_CONFLICT")) {
    return { status: 409, code: "IDEMPOTENCY_CONFLICT", message: "This Idempotency-Key was already used with a different request body." };
  }
  if (message.includes("IDEMPOTENCY_IN_PROGRESS")) {
    return { status: 409, code: "IDEMPOTENCY_IN_PROGRESS", message: "A request with this Idempotency-Key is still being processed." };
  }
  if (message.includes("TRANSFER_NOT_FOUND")) {
    return { status: 404, code: "NOT_FOUND", message: "Transfer request not found." };
  }
  if (message.includes("CANCELLATION_NOT_ALLOWED")) {
    return { status: 409, code: "CANCELLATION_NOT_ALLOWED", message: "Only pending or accepted transfers can be cancelled through the API." };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "The operation could not be completed." };
}

async function authenticate(
  req: Request,
  res: Response,
  requestId: string,
  permission: "transfers.create" | "transfers.read" | "transfers.cancel",
) {
  try {
    return await authenticateExternalApi(req, permission);
  } catch (error) {
    if (error instanceof ExternalApiError) {
      sendError(res, requestId, error.status, error.code, error.message);
      return null;
    }
    sendError(res, requestId, 500, "INTERNAL_ERROR", "Authentication failed.");
    return null;
  }
}

router.post("/", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticate(req, res, requestId, "transfers.create");
  if (!auth) return;

  let idempotencyKeyHash: string | undefined;
  const rawIdempotencyKey = req.headers["idempotency-key"];
  const idempotency = idempotencyKeySchema.safeParse(rawIdempotencyKey);
  if (!idempotency.success) {
    await audit({ req, auth, requestId, statusCode: 400, startedAt, errorCode: "INVALID_IDEMPOTENCY_KEY" });
    return sendError(res, requestId, 400, "INVALID_IDEMPOTENCY_KEY", "Provide a valid Idempotency-Key header.");
  }
  idempotencyKeyHash = sha256(idempotency.data);

  const parsed = createExternalTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    await audit({ req, auth, requestId, statusCode: 400, startedAt, idempotencyKeyHash, errorCode: "VALIDATION_ERROR" });
    return sendError(res, requestId, 400, "VALIDATION_ERROR", "The request body is invalid.", formatZodIssues(parsed.error));
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("create_external_transfer_v1", {
      p_api_key_id: auth.apiKeyId,
      p_organization_id: auth.organizationId,
      p_idempotency_key_hash: idempotencyKeyHash,
      p_request_hash: buildExternalRequestHash(parsed.data),
      p_payload: parsed.data,
      p_actor_name: `API: ${auth.keyName}`,
    });
    if (error || !data) {
      const mapped = mapRpcError(error);
      await audit({ req, auth, requestId, statusCode: mapped.status, startedAt, idempotencyKeyHash, errorCode: mapped.code });
      return sendError(res, requestId, mapped.status, mapped.code, mapped.message);
    }

    const transferRequestId = data.id as string;
    const statusCode = data.replayed ? 200 : 201;
    if (!data.replayed) {
      void onTransferCreated({
        organization_id: auth.organizationId,
        request_id: transferRequestId,
        status: "pendiente",
        broker_name: auth.keyName,
        client_name: parsed.data.client_name,
        service_type: parsed.data.service_type,
        request_number: data.request_number,
        triggered_by_name: `API: ${auth.keyName}`,
      }).catch((error) => console.error("[ExternalAPI] Transfer automation failed", error));
    }
    await audit({ req, auth, requestId, statusCode, startedAt, transferRequestId, idempotencyKeyHash });
    setHeaders(res, requestId);
    return res.status(statusCode).json({ success: true, request_id: requestId, data });
  } catch (error) {
    console.error("[ExternalAPI] Create transfer failed", error);
    await audit({ req, auth, requestId, statusCode: 500, startedAt, idempotencyKeyHash, errorCode: "INTERNAL_ERROR" });
    return sendError(res, requestId, 500, "INTERNAL_ERROR", "Failed to create transfer request.");
  }
});

router.get("/", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticate(req, res, requestId, "transfers.read");
  if (!auth) return;

  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    await audit({ req, auth, requestId, statusCode: 400, startedAt, errorCode: "VALIDATION_ERROR" });
    return sendError(res, requestId, 400, "VALIDATION_ERROR", "The query parameters are invalid.", formatZodIssues(parsed.error));
  }

  try {
    const { page, limit, status, from_date: fromDate, to_date: toDate, search } = parsed.data;
    const offset = (page - 1) * limit;
    const supabase = getServiceClient();
    let query = supabase
      .from("transfer_requests")
      .select(`
        id, request_number, broker_name, client_type, client_name, client_phone, client_email,
        villa_name, boat_name, berth_number, captain_name, captain_phone, status, service_type,
        notes, client_reference, created_at, updated_at,
        items:transfer_items(
          id, position, direction, transfer_date, transfer_time, pickup_location, pickup_lat, pickup_lng,
          pickup_place_id, dropoff_location, dropoff_lat, dropoff_lng, dropoff_place_id, vehicle_type,
          pax_count, flight_number, status, driver_name, baby_seats_count, baby_seats, luggage_count,
          vans_needed, linked_item_id, notes
        )
      `, { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq("status", status);
    if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00Z`);
    if (toDate) query = query.lte("created_at", `${toDate}T23:59:59Z`);
    if (search) query = query.or(`client_name.ilike.%${search}%,request_number.ilike.%${search}%,client_reference.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;
    await audit({ req, auth, requestId, statusCode: 200, startedAt });
    setHeaders(res, requestId);
    return res.json({
      success: true,
      request_id: requestId,
      data: data || [],
      pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error("[ExternalAPI] List transfers failed", error);
    await audit({ req, auth, requestId, statusCode: 500, startedAt, errorCode: "INTERNAL_ERROR" });
    return sendError(res, requestId, 500, "INTERNAL_ERROR", "Failed to list transfer requests.");
  }
});

router.get("/:id/status", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticate(req, res, requestId, "transfers.read");
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return sendError(res, requestId, 400, "VALIDATION_ERROR", "The transfer id must be a UUID.");

  const { data, error } = await getServiceClient()
    .from("transfer_requests")
    .select("id, request_number, status, updated_at")
    .eq("id", id.data)
    .eq("organization_id", auth.organizationId)
    .single();
  if (error || !data) {
    await audit({ req, auth, requestId, statusCode: 404, startedAt, errorCode: "NOT_FOUND" });
    return sendError(res, requestId, 404, "NOT_FOUND", "Transfer request not found.");
  }
  await audit({ req, auth, requestId, statusCode: 200, startedAt, transferRequestId: id.data });
  setHeaders(res, requestId);
  return res.json({ success: true, request_id: requestId, data });
});

router.get("/:id", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticate(req, res, requestId, "transfers.read");
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return sendError(res, requestId, 400, "VALIDATION_ERROR", "The transfer id must be a UUID.");

  try {
    const { data, error } = await getServiceClient()
      .from("transfer_requests")
      .select(`
        id, request_number, broker_name, client_type, client_name, client_phone, client_email,
        villa_name, boat_name, berth_number, captain_name, captain_phone, status, service_type,
        notes, client_reference, rejection_reason, accepted_at, created_at, updated_at,
        items:transfer_items(
          id, position, direction, transfer_date, transfer_time, pickup_location, pickup_lat, pickup_lng,
          pickup_place_id, dropoff_location, dropoff_lat, dropoff_lng, dropoff_place_id, vehicle_type,
          pax_count, flight_number, status, driver_name, driver_phone, baby_seats_count, baby_seats,
          luggage_count, vans_needed, linked_item_id, notes
        ),
        status_history:transfer_status_history(previous_status, new_status, changed_by_type, created_at)
      `)
      .eq("id", id.data)
      .eq("organization_id", auth.organizationId)
      .single();
    if (error || !data) {
      await audit({ req, auth, requestId, statusCode: 404, startedAt, errorCode: "NOT_FOUND" });
      return sendError(res, requestId, 404, "NOT_FOUND", "Transfer request not found.");
    }
    await audit({ req, auth, requestId, statusCode: 200, startedAt, transferRequestId: id.data });
    setHeaders(res, requestId);
    return res.json({ success: true, request_id: requestId, data });
  } catch (error) {
    console.error("[ExternalAPI] Get transfer failed", error);
    await audit({ req, auth, requestId, statusCode: 500, startedAt, transferRequestId: id.data, errorCode: "INTERNAL_ERROR" });
    return sendError(res, requestId, 500, "INTERNAL_ERROR", "Failed to retrieve transfer request.");
  }
});

router.post("/:id/cancel", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const requestId = createCorrelationId(req.headers["x-request-id"]);
  const auth = await authenticate(req, res, requestId, "transfers.cancel");
  if (!auth) return;
  const id = uuidSchema.safeParse(req.params.id);
  const body = cancelExternalTransferSchema.safeParse(req.body);
  if (!id.success || !body.success) {
    return sendError(
      res,
      requestId,
      400,
      "VALIDATION_ERROR",
      "The cancellation request is invalid.",
      body.success ? undefined : formatZodIssues(body.error),
    );
  }

  try {
    const { data, error } = await getServiceClient().rpc("cancel_external_transfer_v1", {
      p_organization_id: auth.organizationId,
      p_transfer_request_id: id.data,
      p_actor_name: `API: ${auth.keyName}`,
      p_reason: body.data.reason,
    });
    if (error || !data) {
      const mapped = mapRpcError(error);
      await audit({ req, auth, requestId, statusCode: mapped.status, startedAt, transferRequestId: id.data, errorCode: mapped.code });
      return sendError(res, requestId, mapped.status, mapped.code, mapped.message);
    }
    if (!data.replayed) {
      void onTransferStatusChanged({
        organization_id: auth.organizationId,
        request_id: id.data,
        status: "cancelado",
        previous_status: data.previous_status,
        request_number: data.request_number,
        triggered_by_name: `API: ${auth.keyName}`,
      }).catch((error) => console.error("[ExternalAPI] Status automation failed", error));
    }
    await audit({ req, auth, requestId, statusCode: 200, startedAt, transferRequestId: id.data });
    setHeaders(res, requestId);
    return res.json({ success: true, request_id: requestId, data });
  } catch (error) {
    console.error("[ExternalAPI] Cancel transfer failed", error);
    await audit({ req, auth, requestId, statusCode: 500, startedAt, transferRequestId: id.data, errorCode: "INTERNAL_ERROR" });
    return sendError(res, requestId, 500, "INTERNAL_ERROR", "Failed to cancel transfer request.");
  }
});

export default router;
