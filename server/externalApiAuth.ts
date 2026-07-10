/**
 * External API Authentication Middleware
 * 
 * Authenticates external API requests using API keys.
 * Keys are stored as SHA-256 hashes in the database.
 * Format: pmk_<prefix>_<secret> (PlanMint Key)
 * 
 * Usage:
 *   import { authenticateExternalApi } from "./externalApiAuth";
 *   const auth = await authenticateExternalApi(req, "transfers.create");
 */
import { Request } from "express";
import crypto from "crypto";
import { getServiceClient } from "./supabaseAdmin";

export class ExternalApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public code: string
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
}

/**
 * Authenticate an external API request using the X-API-Key header.
 * Validates the key, checks permissions, and updates last_used_at.
 */
export async function authenticateExternalApi(
  req: Request,
  requiredPermission?: string
): Promise<ExternalApiAuth> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    throw new ExternalApiError(
      "Missing API key. Provide it in the X-API-Key header.",
      401,
      "MISSING_API_KEY"
    );
  }

  // Validate key format: pmk_<prefix(8)>_<secret(32)>
  if (!apiKey.startsWith("pmk_") || apiKey.length < 44) {
    throw new ExternalApiError(
      "Invalid API key format.",
      401,
      "INVALID_API_KEY_FORMAT"
    );
  }

  // Extract prefix for lookup (first 8 chars after "pmk_")
  const prefix = apiKey.substring(4, 12);

  // Hash the full key for comparison
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const supabase = getServiceClient();

  // Look up the key by prefix
  const { data: keyRecord, error } = await supabase
    .from("external_api_keys")
    .select("id, organization_id, name, key_hash, permissions, is_active, expires_at")
    .eq("key_prefix", prefix)
    .single();

  if (error || !keyRecord) {
    throw new ExternalApiError(
      "Invalid API key.",
      401,
      "INVALID_API_KEY"
    );
  }

  // Verify hash matches
  if (keyRecord.key_hash !== keyHash) {
    throw new ExternalApiError(
      "Invalid API key.",
      401,
      "INVALID_API_KEY"
    );
  }

  // Check if key is active
  if (!keyRecord.is_active) {
    throw new ExternalApiError(
      "API key has been deactivated.",
      403,
      "API_KEY_DEACTIVATED"
    );
  }

  // Check expiration
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    throw new ExternalApiError(
      "API key has expired.",
      403,
      "API_KEY_EXPIRED"
    );
  }

  // Check permission
  const permissions: string[] = keyRecord.permissions || [];
  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw new ExternalApiError(
      `Insufficient permissions. Required: ${requiredPermission}`,
      403,
      "INSUFFICIENT_PERMISSIONS"
    );
  }

  // Update last_used_at (fire and forget)
  supabase
    .from("external_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => {});

  return {
    apiKeyId: keyRecord.id,
    organizationId: keyRecord.organization_id,
    keyName: keyRecord.name,
    permissions,
  };
}

/**
 * Generate a new API key for an organization.
 * Returns the full key (only shown once) and stores the hash.
 */
export async function generateApiKey(params: {
  organizationId: string;
  name: string;
  permissions?: string[];
  expiresAt?: string | null;
  createdBy?: string;
}): Promise<{ apiKey: string; keyId: string; prefix: string }> {
  const prefix = crypto.randomBytes(4).toString("hex"); // 8 chars
  const secret = crypto.randomBytes(16).toString("hex"); // 32 chars
  const fullKey = `pmk_${prefix}_${secret}`;
  const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("external_api_keys")
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      key_hash: keyHash,
      key_prefix: prefix,
      permissions: params.permissions || [
        "transfers.create",
        "transfers.read",
        "transfers.cancel",
      ],
      expires_at: params.expiresAt || null,
      created_by: params.createdBy || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create API key: ${error?.message}`);
  }

  return {
    apiKey: fullKey,
    keyId: data.id,
    prefix,
  };
}

/**
 * Log an external API request for audit purposes.
 */
export async function logExternalApiRequest(params: {
  apiKeyId: string;
  organizationId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  requestBody?: any;
  responseBody?: any;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("external_api_logs").insert({
      api_key_id: params.apiKeyId,
      organization_id: params.organizationId,
      method: params.method,
      endpoint: params.endpoint,
      status_code: params.statusCode,
      request_body: params.requestBody || null,
      response_body: params.responseBody || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      duration_ms: params.durationMs || null,
    });
  } catch (err) {
    console.error("[ExternalAPI] Failed to log request:", err);
  }
}
