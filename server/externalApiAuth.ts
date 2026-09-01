/**
 * Autenticación y auditoría de la API externa de PlanMint.
 * Las claves completas solo se muestran al crearlas; en base se conserva SHA-256.
 */
import crypto from "node:crypto";
import type { Request } from "express";
import { getServiceClient } from "./supabaseAdmin";

export const EXTERNAL_API_PERMISSIONS = [
  "transfers.create",
  "transfers.read",
  "transfers.cancel",
  "webhooks.manage",
] as const;

export type ExternalApiPermission = typeof EXTERNAL_API_PERMISSIONS[number];

export class ExternalApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

export interface ExternalApiAuth {
  apiKeyId: string;
  organizationId: string;
  keyName: string;
  permissions: string[];
  rateLimitPerMinute: number;
}

function secureHashMatches(actualHashHex: string, expectedHashHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actualHashHex) || !/^[a-f0-9]{64}$/i.test(expectedHashHex)) return false;
  const actual = Buffer.from(actualHashHex, "hex");
  const expected = Buffer.from(expectedHashHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function parseRateLimit(metadata: unknown): number {
  const candidate = Number((metadata as { rate_limit_per_minute?: unknown } | null)?.rate_limit_per_minute);
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > 1000) return 60;
  return candidate;
}

export async function authenticateExternalApi(
  req: Request,
  requiredPermission?: ExternalApiPermission,
): Promise<ExternalApiAuth> {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    throw new ExternalApiError("Missing API key. Provide it in the X-API-Key header.", 401, "MISSING_API_KEY");
  }
  if (!/^pmk_[a-f0-9]{8}_[a-f0-9]{32}$/i.test(apiKey)) {
    throw new ExternalApiError("Invalid API key format.", 401, "INVALID_API_KEY_FORMAT");
  }

  const prefix = apiKey.substring(4, 12).toLowerCase();
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const supabase = getServiceClient();
  const { data: keyRecord, error } = await supabase
    .from("external_api_keys")
    .select("id, organization_id, name, key_hash, permissions, is_active, expires_at, metadata")
    .eq("key_prefix", prefix)
    .single();

  if (error || !keyRecord || !secureHashMatches(keyRecord.key_hash, keyHash)) {
    throw new ExternalApiError("Invalid API key.", 401, "INVALID_API_KEY");
  }
  if (!keyRecord.is_active) {
    throw new ExternalApiError("API key has been deactivated.", 403, "API_KEY_DEACTIVATED");
  }
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    throw new ExternalApiError("API key has expired.", 403, "API_KEY_EXPIRED");
  }

  const permissions: string[] = Array.isArray(keyRecord.permissions) ? keyRecord.permissions : [];
  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw new ExternalApiError(
      `Insufficient permissions. Required: ${requiredPermission}`,
      403,
      "INSUFFICIENT_PERMISSIONS",
    );
  }

  const rateLimitPerMinute = parseRateLimit(keyRecord.metadata);
  const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc(
    "consume_external_api_rate_limit",
    { p_api_key_id: keyRecord.id, p_limit: rateLimitPerMinute },
  );
  if (rateLimitError) {
    throw new ExternalApiError("The API security schema is not ready.", 503, "API_SCHEMA_NOT_READY");
  }
  if (withinRateLimit !== true) {
    throw new ExternalApiError(
      "Rate limit exceeded. Retry after the next minute boundary.",
      429,
      "RATE_LIMIT_EXCEEDED",
    );
  }

  void supabase
    .from("external_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => undefined);

  return {
    apiKeyId: keyRecord.id,
    organizationId: keyRecord.organization_id,
    keyName: keyRecord.name,
    permissions,
    rateLimitPerMinute,
  };
}

export async function generateApiKey(params: {
  organizationId: string;
  name: string;
  permissions?: string[];
  expiresAt?: string | null;
  createdBy?: string;
  rateLimitPerMinute?: number;
}): Promise<{ apiKey: string; keyId: string; prefix: string }> {
  const requestedPermissions = params.permissions || [...EXTERNAL_API_PERMISSIONS];
  const invalidPermission = requestedPermissions.find(
    (permission) => !EXTERNAL_API_PERMISSIONS.includes(permission as ExternalApiPermission),
  );
  if (invalidPermission) throw new Error(`Unsupported API permission: ${invalidPermission}`);

  const rateLimitPerMinute = params.rateLimitPerMinute ?? 60;
  if (!Number.isInteger(rateLimitPerMinute) || rateLimitPerMinute < 1 || rateLimitPerMinute > 1000) {
    throw new Error("rateLimitPerMinute must be an integer between 1 and 1000");
  }

  const prefix = crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(16).toString("hex");
  const apiKey = `pmk_${prefix}_${secret}`;
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("external_api_keys")
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      key_hash: keyHash,
      key_prefix: prefix,
      permissions: requestedPermissions,
      expires_at: params.expiresAt || null,
      created_by: params.createdBy || null,
      metadata: {
        key_type: "shared",
        audience: "commercial_software",
        rate_limit_per_minute: rateLimitPerMinute,
      },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create API key: ${error?.message}`);
  return { apiKey, keyId: data.id, prefix };
}

export function hashAuditValue(prefix: "ip" | "ua", value?: string): string | null {
  if (!value || !process.env.JWT_SECRET) return null;
  return `${prefix}_${crypto.createHmac("sha256", process.env.JWT_SECRET).update(value).digest("hex")}`;
}

export function createCorrelationId(headerValue: unknown): string {
  if (typeof headerValue === "string" && /^[a-f0-9-]{36}$/i.test(headerValue)) return headerValue.toLowerCase();
  return crypto.randomUUID();
}

export async function logExternalApiRequest(params: {
  apiKeyId: string;
  organizationId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  requestBody?: unknown;
  responseBody?: unknown;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
  correlationId?: string;
  transferRequestId?: string;
  idempotencyKeyHash?: string;
  errorCode?: string;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("external_api_logs").insert({
      api_key_id: params.apiKeyId,
      organization_id: params.organizationId,
      method: params.method,
      endpoint: params.endpoint,
      status_code: params.statusCode,
      request_body: null,
      response_body: null,
      ip_address: hashAuditValue("ip", params.ipAddress),
      user_agent: hashAuditValue("ua", params.userAgent),
      duration_ms: params.durationMs || null,
      correlation_id: params.correlationId || null,
      transfer_request_id: params.transferRequestId || null,
      idempotency_key_hash: params.idempotencyKeyHash || null,
      error_code: params.errorCode || null,
    });
  } catch (error) {
    console.error("[ExternalAPI] Failed to write redacted request audit", error);
  }
}
