/**
 * External API Key Management
 * 
 * Endpoints for admins to create, list, and revoke API keys.
 * These endpoints use Supabase JWT auth (internal users only).
 * 
 * Base path: /api/external/v1/keys
 */
import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError, getServiceClient } from "./supabaseAdmin";
import { generateApiKey } from "./externalApiAuth";

// ─── POST /api/external/v1/keys ──────────────────────────────────────────────

export async function handleCreateApiKey(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { name, permissions, expires_at } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "name is required" },
      });
    }

    const result = await generateApiKey({
      organizationId,
      name: name.trim(),
      permissions: permissions || ["transfers.create", "transfers.read", "transfers.cancel"],
      expiresAt: expires_at || null,
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: result.keyId,
        api_key: result.apiKey, // Only shown once!
        prefix: result.prefix,
        name: name.trim(),
        message: "Store this API key securely. It will not be shown again.",
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ success: false, error: { code: "AUTH_ERROR", message: err.message } });
    }
    console.error("[ApiKeyManagement] Create error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create API key" },
    });
  }
}

// ─── GET /api/external/v1/keys ───────────────────────────────────────────────

export async function handleListApiKeys(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("external_api_keys")
      .select("id, name, key_prefix, permissions, is_active, created_at, last_used_at, expires_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Failed to list API keys");
    }

    return res.json({
      success: true,
      data: (data || []).map((k) => ({
        ...k,
        key_preview: `pmk_${k.key_prefix}_${"*".repeat(32)}`,
      })),
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ success: false, error: { code: "AUTH_ERROR", message: err.message } });
    }
    console.error("[ApiKeyManagement] List error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list API keys" },
    });
  }
}

// ─── DELETE /api/external/v1/keys/:id ────────────────────────────────────────

export async function handleRevokeApiKey(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { id } = req.params;
    const supabase = getServiceClient();

    const { error } = await supabase
      .from("external_api_keys")
      .update({ is_active: false })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error("Failed to revoke API key");
    }

    return res.json({
      success: true,
      data: { id, status: "revoked" },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ success: false, error: { code: "AUTH_ERROR", message: err.message } });
    }
    console.error("[ApiKeyManagement] Revoke error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to revoke API key" },
    });
  }
}

// ─── GET /api/external/v1/keys/:id/logs ──────────────────────────────────────

export async function handleGetApiKeyLogs(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const supabase = getServiceClient();

    const { data, count, error } = await supabase
      .from("external_api_logs")
      .select("id, method, endpoint, status_code, ip_address, duration_ms, created_at", { count: "exact" })
      .eq("api_key_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error("Failed to get API key logs");
    }

    return res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ success: false, error: { code: "AUTH_ERROR", message: err.message } });
    }
    console.error("[ApiKeyManagement] Logs error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get logs" },
    });
  }
}
