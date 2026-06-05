import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

/**
 * GET /api/get-preparation-list
 * Returns all pending + recently completed items for the org
 */
async function handleGetPreparationList(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.view
    const { allowed: canView } = await checkUserPermission(sb, organizationId, userId, "preparation.view");
    if (!canView) return res.status(403).json({ ok: false, error: "No permission to view preparation list" });

    // Get all pending items + items completed in the last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from("preparation_list")
      .select("*")
      .eq("organization_id", organizationId)
      .or(`status.eq.pending,and(status.eq.ready,completed_at.gte.${oneDayAgo})`)
      .order("deadline_at", { ascending: true });

    if (error) {
      console.error("[get-preparation-list] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[get-preparation-list] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/add-preparation-item
 * Add a vehicle to the preparation list
 */
async function handleAddPreparationItem(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.manage
    const { allowed: canManage } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!canManage) return res.status(403).json({ ok: false, error: "No permission to manage preparation list" });

    const { matricula, modelo, deadline_at, notes } = req.body;
    if (!matricula || !deadline_at) {
      return res.status(400).json({ ok: false, error: "Missing required fields (matricula, deadline_at)" });
    }

    // Validate vehicle status: only allow sucio or incompleto
    const { data: vehicleData } = await sb
      .from("vehicles")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("matricula", matricula.toUpperCase().trim())
      .eq("is_archived", false)
      .maybeSingle();

    if (vehicleData) {
      const blockedStatuses = ['limpio', 'alquilado', 'en_servicio'];
      if (blockedStatuses.includes(vehicleData.status)) {
        const statusLabels: Record<string, string> = {
          limpio: 'ya est\u00e1 limpio',
          alquilado: 'est\u00e1 alquilado',
          en_servicio: 'est\u00e1 en servicio',
        };
        return res.status(400).json({
          ok: false,
          error: `No se puede a\u00f1adir: el veh\u00edculo ${statusLabels[vehicleData.status] || vehicleData.status}`,
        });
      }
    }

    // Check if vehicle is already in the pending preparation list
    const { data: existingItem } = await sb
      .from("preparation_list")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("matricula", matricula.toUpperCase().trim())
      .eq("status", "pending")
      .maybeSingle();

    if (existingItem) {
      return res.status(400).json({
        ok: false,
        error: "Este veh\u00edculo ya est\u00e1 en la lista de preparaci\u00f3n",
      });
    }

    const { data, error } = await sb
      .from("preparation_list")
      .insert({
        organization_id: organizationId,
        matricula: matricula.toUpperCase().trim(),
        modelo: modelo || null,
        deadline_at,
        notes: notes || null,
        added_by: userId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[add-preparation-item] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[add-preparation-item] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/complete-preparation-item
 * Mark a vehicle as ready
 */
async function handleCompletePreparationItem(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.manage
    const { allowed: canManage } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!canManage) return res.status(403).json({ ok: false, error: "No permission to manage preparation list" });

    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ ok: false, error: "Missing itemId" });

    const { data, error } = await sb
      .from("preparation_list")
      .update({
        status: "ready",
        completed_by: userId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("[complete-preparation-item] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[complete-preparation-item] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/uncomplete-preparation-item
 * Revert a vehicle back to pending
 */
async function handleUncompletePreparationItem(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.manage
    const { allowed: canManage } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!canManage) return res.status(403).json({ ok: false, error: "No permission to manage preparation list" });

    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ ok: false, error: "Missing itemId" });

    const { data, error } = await sb
      .from("preparation_list")
      .update({
        status: "pending",
        completed_by: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("[uncomplete-preparation-item] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[uncomplete-preparation-item] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/delete-preparation-item
 * Remove a vehicle from the preparation list
 */
async function handleDeletePreparationItem(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.manage
    const { allowed: canManage } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!canManage) return res.status(403).json({ ok: false, error: "No permission to manage preparation list" });

    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ ok: false, error: "Missing itemId" });

    const { error } = await sb
      .from("preparation_list")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("[delete-preparation-item] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[delete-preparation-item] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/update-preparation-item
 * Update deadline or notes of an existing item
 */
async function handleUpdatePreparationItem(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.manage
    const { allowed: canManage } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!canManage) return res.status(403).json({ ok: false, error: "No permission to manage preparation list" });

    const { itemId, deadline_at, notes, matricula, modelo } = req.body;
    if (!itemId) return res.status(400).json({ ok: false, error: "Missing itemId" });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (deadline_at !== undefined) updates.deadline_at = deadline_at;
    if (notes !== undefined) updates.notes = notes;
    if (matricula !== undefined) updates.matricula = matricula.toUpperCase().trim();
    if (modelo !== undefined) updates.modelo = modelo;

    const { data, error } = await sb
      .from("preparation_list")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("[update-preparation-item] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[update-preparation-item] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

export {
  handleGetPreparationList,
  handleAddPreparationItem,
  handleCompletePreparationItem,
  handleUncompletePreparationItem,
  handleDeletePreparationItem,
  handleUpdatePreparationItem,
};
