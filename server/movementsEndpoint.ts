/**
 * Movements API — Server-side endpoints for Android and web clients
 *
 * Provides a clean REST-like API for the vehicle movements module.
 * All endpoints require Supabase JWT authentication via Authorization header.
 *
 * Endpoints:
 *   POST /api/movements/start       — Start a new movement
 *   POST /api/movements/end         — End/complete a movement
 *   POST /api/movements/cancel      — Cancel a movement
 *   GET  /api/movements/active      — List active (en_curso) movements for the org
 *   GET  /api/movements/mine        — List movements for the current driver
 *   GET  /api/movements/:id         — Get a single movement by ID
 *   POST /api/movements/upload-photo — Upload a movement photo (base64)
 */
import type { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

// ─── Types ──────────────────────────────────────────────────────────────────

type MovementType = "entrega" | "recogida" | "escoba" | "limpieza";
type MovementStatus = "en_curso" | "completado" | "cancelado";

interface StartMovementBody {
  matricula: string;
  movement_type: MovementType;
  start_photo_url?: string;
  start_lat?: number;
  start_lng?: number;
  reservation_id?: string;
  vehicle_id?: string;
  notes?: string;
}

interface EndMovementBody {
  movement_id: string;
  end_photo_url?: string;
  end_lat?: number;
  end_lng?: number;
}

interface CancelMovementBody {
  movement_id: string;
}

interface UploadPhotoBody {
  image_base64: string;
  filename?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function authenticate(req: Request) {
  return authenticateSupabaseRequest(req.headers.authorization);
}

/**
 * Validate that a plate exists in the organization's fleet.
 * Returns { found, vehicleId } or throws.
 */
async function validatePlateInOrg(
  matricula: string,
  organizationId: string
): Promise<{ found: boolean; vehicleId: string | null }> {
  const sb = getServiceClient();
  const cleanPlate = matricula.replace(/\s+/g, "").toUpperCase();

  // Check fleet_vehicles first (source of truth)
  const { data: fleetVehicles } = await sb
    .from("fleet_vehicles")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("matricula", cleanPlate)
    .limit(1);

  if (fleetVehicles && fleetVehicles.length > 0) {
    // Also check operational vehicles for FK compatibility
    const { data: opVehicles } = await sb
      .from("vehicles")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("matricula", cleanPlate)
      .is("archived_at", null)
      .limit(1);

    return {
      found: true,
      vehicleId: opVehicles?.[0]?.id ?? null,
    };
  }

  // Fallback: check operational vehicles table
  const { data: opVehicles } = await sb
    .from("vehicles")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("matricula", cleanPlate)
    .is("archived_at", null)
    .limit(1);

  return {
    found: !!(opVehicles && opVehicles.length > 0),
    vehicleId: opVehicles?.[0]?.id ?? null,
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /api/movements/start
 * Start a new vehicle movement.
 */
export async function handleMovementsStart(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const body = req.body as StartMovementBody;

    if (!body.matricula || !body.movement_type) {
      return res.status(400).json({
        ok: false,
        error: "matricula and movement_type are required",
      });
    }

    const validTypes: MovementType[] = ["entrega", "recogida", "escoba", "limpieza"];
    if (!validTypes.includes(body.movement_type)) {
      return res.status(400).json({
        ok: false,
        error: `movement_type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const cleanPlate = body.matricula.replace(/\s+/g, "").toUpperCase();

    // Validate plate exists in the fleet
    const { found, vehicleId } = await validatePlateInOrg(cleanPlate, organizationId);
    if (!found) {
      return res.status(404).json({
        ok: false,
        error: `Matrícula "${cleanPlate}" no encontrada en la flota de la organización`,
      });
    }

    const sb = getServiceClient();

    const { data: movement, error } = await sb
      .from("vehicle_movements")
      .insert({
        organization_id: organizationId,
        matricula: cleanPlate,
        movement_type: body.movement_type,
        driver_id: userId,
        start_photo_url: body.start_photo_url || null,
        start_lat: body.start_lat || null,
        start_lng: body.start_lng || null,
        reservation_id: body.reservation_id || null,
        vehicle_id: body.vehicle_id || vehicleId || null,
        notes: body.notes || null,
        status: "en_curso" as MovementStatus,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("[movements/start] Insert error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, movement });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/start] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/movements/end
 * Complete/end a movement.
 */
export async function handleMovementsEnd(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const body = req.body as EndMovementBody;

    if (!body.movement_id) {
      return res.status(400).json({ ok: false, error: "movement_id is required" });
    }

    const sb = getServiceClient();

    // Verify the movement exists and belongs to the org
    const { data: existing, error: fetchErr } = await sb
      .from("vehicle_movements")
      .select("id, status, organization_id, driver_id")
      .eq("id", body.movement_id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado" });
    }

    if (existing.organization_id !== organizationId) {
      return res.status(403).json({ ok: false, error: "No tienes acceso a este movimiento" });
    }

    if (existing.status !== "en_curso") {
      return res.status(409).json({
        ok: false,
        error: `El movimiento ya está en estado "${existing.status}"`,
      });
    }

    const { data: movement, error } = await sb
      .from("vehicle_movements")
      .update({
        end_photo_url: body.end_photo_url || null,
        end_lat: body.end_lat || null,
        end_lng: body.end_lng || null,
        ended_at: new Date().toISOString(),
        status: "completado" as MovementStatus,
      })
      .eq("id", body.movement_id)
      .select("*")
      .single();

    if (error) {
      console.error("[movements/end] Update error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, movement });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/end] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/movements/cancel
 * Cancel a movement.
 */
export async function handleMovementsCancel(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const body = req.body as CancelMovementBody;

    if (!body.movement_id) {
      return res.status(400).json({ ok: false, error: "movement_id is required" });
    }

    const sb = getServiceClient();

    // Verify the movement exists and belongs to the org
    const { data: existing, error: fetchErr } = await sb
      .from("vehicle_movements")
      .select("id, status, organization_id")
      .eq("id", body.movement_id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado" });
    }

    if (existing.organization_id !== organizationId) {
      return res.status(403).json({ ok: false, error: "No tienes acceso a este movimiento" });
    }

    if (existing.status !== "en_curso") {
      return res.status(409).json({
        ok: false,
        error: `Solo se pueden cancelar movimientos en curso (actual: "${existing.status}")`,
      });
    }

    const { data: movement, error } = await sb
      .from("vehicle_movements")
      .update({ status: "cancelado" as MovementStatus })
      .eq("id", body.movement_id)
      .select("*")
      .single();

    if (error) {
      console.error("[movements/cancel] Update error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, movement });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/cancel] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * GET /api/movements/active
 * List all active (en_curso) movements for the organization.
 */
export async function handleMovementsActive(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const sb = getServiceClient();

    const { data: movements, error } = await sb
      .from("vehicle_movements")
      .select("*, driver:profiles!vehicle_movements_driver_id_fkey(id, name)")
      .eq("organization_id", organizationId)
      .eq("status", "en_curso")
      .order("started_at", { ascending: false });

    if (error) {
      console.error("[movements/active] Query error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, movements: movements || [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/active] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * GET /api/movements/mine
 * List movements for the authenticated driver.
 * Query params: ?status=en_curso&limit=20&offset=0
 */
export async function handleMovementsMine(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const sb = getServiceClient();

    const status = req.query.status as MovementStatus | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let query = sb
      .from("vehicle_movements")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("driver_id", userId)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: movements, error } = await query;

    if (error) {
      console.error("[movements/mine] Query error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, movements: movements || [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/mine] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * GET /api/movements/:id
 * Get a single movement by ID.
 */
export async function handleMovementsGetById(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ ok: false, error: "Movement ID is required" });
    }

    const sb = getServiceClient();

    const { data: movement, error } = await sb
      .from("vehicle_movements")
      .select("*, driver:profiles!vehicle_movements_driver_id_fkey(id, name)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !movement) {
      return res.status(404).json({ ok: false, error: "Movimiento no encontrado" });
    }

    return res.json({ ok: true, movement });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/:id] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/movements/upload-photo
 * Upload a movement photo (base64 encoded).
 * Returns the public URL of the uploaded photo.
 */
export async function handleMovementsUploadPhoto(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticate(req);
    const body = req.body as UploadPhotoBody;

    if (!body.image_base64) {
      return res.status(400).json({ ok: false, error: "image_base64 is required" });
    }

    const sb = getServiceClient();

    // Clean base64 data
    let cleanBase64 = body.image_base64;
    let mimeType = "image/jpeg";
    if (cleanBase64.startsWith("data:")) {
      const match = cleanBase64.match(/data:(image\/\w+);base64,/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = cleanBase64.replace(/data:image\/\w+;base64,/, "");
      }
    }

    const buffer = Buffer.from(cleanBase64, "base64");
    const ext = mimeType === "image/png" ? "png" : "jpg";
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const filename = `${organizationId}/${Date.now()}-${randomSuffix}.${ext}`;

    const { error: uploadError } = await sb.storage
      .from("movement-photos")
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[movements/upload-photo] Upload error:", uploadError);
      return res.status(500).json({ ok: false, error: uploadError.message });
    }

    const { data: urlData } = sb.storage
      .from("movement-photos")
      .getPublicUrl(filename);

    return res.json({ ok: true, url: urlData.publicUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[movements/upload-photo] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
