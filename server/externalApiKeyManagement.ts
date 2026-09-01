import type { Request, Response } from "express";
import { z } from "zod";
import { EXTERNAL_API_PERMISSIONS, generateApiKey } from "./externalApiAuth";
import { requirePermission } from "./permissionHelper";
import { authenticateSupabaseRequest, AuthError, getServiceClient } from "./supabaseAdmin";

const keyIdSchema = z.string().uuid();
const createKeySchema = z.object({
  name: z.string().trim().min(1).max(120).default("Comerciales · Clave compartida"),
  permissions: z.array(z.enum(EXTERNAL_API_PERMISSIONS)).min(1).default([...EXTERNAL_API_PERMISSIONS]),
  expires_at: z.string().datetime().nullable().optional(),
  rate_limit_per_minute: z.number().int().min(1).max(1000).default(60),
});

async function requireApiAdmin(authorization: string | undefined) {
  const auth = await authenticateSupabaseRequest(authorization);
  await requirePermission(getServiceClient(), auth.organizationId, auth.userId, "integrations.manage_api_keys");
  return auth;
}

function managementError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return res.status(error.status).json({ success: false, error: { code: "AUTH_ERROR", message: error.message } });
  }
  const status = Number((error as { status?: unknown })?.status);
  if (status === 403) {
    return res.status(403).json({ success: false, error: { code: "PERMISSION_DENIED", message: "No tienes permiso para gestionar claves API." } });
  }
  console.error("[ApiKeyManagement] Error", error);
  return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: fallback } });
}

export async function handleCreateApiKey(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await requireApiAdmin(req.headers.authorization);
    const parsed = createKeySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Configuración de clave no válida", details: parsed.error.issues } });
    }

    const supabase = getServiceClient();
    const { data: activeSharedKey } = await supabase
      .from("external_api_keys")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("metadata->>key_type", "shared")
      .maybeSingle();
    if (activeSharedKey) {
      return res.status(409).json({ success: false, error: { code: "SHARED_KEY_EXISTS", message: "Ya existe una clave compartida activa. Rótala o revócala antes de crear otra." } });
    }

    const result = await generateApiKey({
      organizationId,
      name: parsed.data.name,
      permissions: parsed.data.permissions,
      expiresAt: parsed.data.expires_at || null,
      createdBy: userId,
      rateLimitPerMinute: parsed.data.rate_limit_per_minute,
    });
    return res.status(201).json({
      success: true,
      data: {
        id: result.keyId,
        api_key: result.apiKey,
        prefix: result.prefix,
        name: parsed.data.name,
        permissions: parsed.data.permissions,
        message: "Copia la clave ahora. No volverá a mostrarse.",
      },
    });
  } catch (error) {
    return managementError(res, error, "No se pudo crear la clave API");
  }
}

export async function handleListApiKeys(req: Request, res: Response) {
  try {
    const { organizationId } = await requireApiAdmin(req.headers.authorization);
    const { data, error } = await getServiceClient()
      .from("external_api_keys")
      .select("id, name, key_prefix, permissions, is_active, created_at, last_used_at, expires_at, metadata")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({
      success: true,
      data: (data || []).map((key) => ({
        ...key,
        key_preview: `pmk_${key.key_prefix}_${"*".repeat(32)}`,
        rate_limit_per_minute: Number(key.metadata?.rate_limit_per_minute) || 60,
        metadata: undefined,
      })),
    });
  } catch (error) {
    return managementError(res, error, "No se pudieron listar las claves API");
  }
}

export async function handleRevokeApiKey(req: Request, res: Response) {
  try {
    const { organizationId } = await requireApiAdmin(req.headers.authorization);
    const id = keyIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "ID de clave no válido" } });
    const { data, error } = await getServiceClient()
      .from("external_api_keys")
      .update({ is_active: false })
      .eq("id", id.data)
      .eq("organization_id", organizationId)
      .select("id")
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Clave no encontrada" } });
    return res.json({ success: true, data: { id: id.data, status: "revoked" } });
  } catch (error) {
    return managementError(res, error, "No se pudo revocar la clave API");
  }
}

export async function handleRotateApiKey(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await requireApiAdmin(req.headers.authorization);
    const id = keyIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "ID de clave no válido" } });
    const supabase = getServiceClient();
    const { data: current, error: currentError } = await supabase
      .from("external_api_keys")
      .select("id, name, permissions, expires_at, metadata, is_active")
      .eq("id", id.data)
      .eq("organization_id", organizationId)
      .single();
    if (currentError || !current || !current.is_active) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Clave activa no encontrada" } });

    const replacement = await generateApiKey({
      organizationId,
      name: current.name,
      permissions: current.permissions,
      expiresAt: current.expires_at,
      createdBy: userId,
      rateLimitPerMinute: Number(current.metadata?.rate_limit_per_minute) || 60,
    });
    const { error: revokeError } = await supabase.from("external_api_keys").update({ is_active: false }).eq("id", current.id).eq("organization_id", organizationId);
    if (revokeError) {
      await supabase.from("external_api_keys").update({ is_active: false }).eq("id", replacement.keyId);
      throw revokeError;
    }
    return res.json({
      success: true,
      data: {
        id: replacement.keyId,
        replaced_id: current.id,
        api_key: replacement.apiKey,
        prefix: replacement.prefix,
        message: "Actualiza el software comercial ahora. La clave anterior ya está revocada.",
      },
    });
  } catch (error) {
    return managementError(res, error, "No se pudo rotar la clave API");
  }
}

export async function handleGetApiKeyLogs(req: Request, res: Response) {
  try {
    const { organizationId } = await requireApiAdmin(req.headers.authorization);
    const id = keyIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "ID de clave no válido" } });
    const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;
    const { data, count, error } = await getServiceClient()
      .from("external_api_logs")
      .select("id, correlation_id, transfer_request_id, method, endpoint, status_code, error_code, duration_ms, created_at", { count: "exact" })
      .eq("api_key_id", id.data)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return res.json({
      success: true,
      data: data || [],
      pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    return managementError(res, error, "No se pudieron obtener los registros de la clave");
  }
}

export async function handleGetWebhookDispatcherStatus(req: Request, res: Response) {
  try {
    await requireApiAdmin(req.headers.authorization);
    const { data } = await getServiceClient()
      .from("external_api_webhook_dispatcher_config")
      .select("schedule_cron_task_uid, updated_at")
      .eq("singleton_key", "global")
      .single();
    return res.json({
      success: true,
      data: { configured: Boolean(data?.schedule_cron_task_uid), updated_at: data?.updated_at || null },
    });
  } catch (error) {
    return managementError(res, error, "No se pudo consultar el despachador de webhooks");
  }
}
