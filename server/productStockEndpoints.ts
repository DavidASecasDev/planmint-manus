import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

/**
 * Product Stock Management Endpoints
 * 
 * Allows the preparation team to report missing/low-stock products.
 * Admins can manage product categories and resolve shortage reports.
 */

// ─── Categories CRUD ─────────────────────────────────────────────────────────

/**
 * GET /api/product-categories
 * Returns all product categories for the organization
 */
async function handleGetProductCategories(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("product_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[product-categories] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[product-categories] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/product-categories
 * Create a new product category (admin only)
 */
async function handleCreateProductCategory(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.manage (admin-level)
    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { name, icon } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: "El nombre es obligatorio" });
    }

    const { data, error } = await sb
      .from("product_categories")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        icon: icon || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[create-product-category] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[create-product-category] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * PUT /api/product-categories
 * Update a product category (admin only)
 */
async function handleUpdateProductCategory(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id, name, icon } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (icon !== undefined) updates.icon = icon;

    const { data, error } = await sb
      .from("product_categories")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("[update-product-category] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[update-product-category] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * DELETE /api/product-categories
 * Delete a product category (admin only)
 */
async function handleDeleteProductCategory(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const { error } = await sb
      .from("product_categories")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[delete-product-category] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[delete-product-category] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── Shortage Reports ────────────────────────────────────────────────────────

/**
 * GET /api/product-shortage-reports
 * Returns shortage reports for the organization (pending first, then resolved)
 */
async function handleGetShortageReports(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("product_shortage_reports")
      .select("*, category:product_categories(id, name, icon), reporter:profiles!product_shortage_reports_reported_by_fkey(name), resolver:profiles!product_shortage_reports_resolved_by_fkey(name)")
      .eq("organization_id", organizationId)
      .order("status", { ascending: true }) // pending first
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[get-shortage-reports] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Flatten nested relations for the frontend
    const flattened = (data || []).map((item: any) => {
      const reporter = Array.isArray(item.reporter) ? item.reporter[0] : item.reporter;
      const resolver = Array.isArray(item.resolver) ? item.resolver[0] : item.resolver;
      const category = Array.isArray(item.category) ? item.category[0] : item.category;
      return {
        id: item.id,
        category_id: item.category_id,
        category_name: category?.name || null,
        product_name: item.product_name,
        product_brand: item.product_brand,
        photo_url: item.photo_url,
        notes: item.notes,
        status: item.status,
        reported_by_name: reporter?.name || null,
        resolved_by_name: resolver?.name || null,
        resolved_at: item.resolved_at,
        created_at: item.created_at,
      };
    });

    return res.json({ ok: true, data: flattened });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[get-shortage-reports] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * GET /api/product-shortage-reports-count
 * Returns count of pending shortage reports (for badge)
 */
async function handleGetShortageReportsCount(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { count, error } = await sb
      .from("product_shortage_reports")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    if (error) {
      console.error("[shortage-reports-count] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, count: count || 0 });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[shortage-reports-count] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/product-shortage-reports
 * Create a new shortage report (any team member with preparation.view)
 */
async function handleCreateShortageReport(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Any team member with preparation.view can report
    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.view");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { category_id, product_name, product_brand, photo_url, notes } = req.body;
    if (!category_id && !product_name?.trim()) {
      return res.status(400).json({ ok: false, error: "Debes seleccionar una categoría o indicar el nombre del producto" });
    }

    const { data, error } = await sb
      .from("product_shortage_reports")
      .insert({
        organization_id: organizationId,
        category_id: category_id || null,
        product_name: product_name?.trim() || null,
        product_brand: product_brand?.trim() || null,
        photo_url: photo_url || null,
        notes: notes?.trim() || null,
        reported_by: userId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[create-shortage-report] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[create-shortage-report] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/resolve-shortage-report
 * Mark a shortage report as resolved (admin only)
 */
async function handleResolveShortageReport(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const { data, error } = await sb
      .from("product_shortage_reports")
      .update({
        status: "resolved",
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("[resolve-shortage-report] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[resolve-shortage-report] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/unresolve-shortage-report
 * Revert a shortage report back to pending (admin only)
 */
async function handleUnresolveShortageReport(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const { data, error } = await sb
      .from("product_shortage_reports")
      .update({
        status: "pending",
        resolved_by: null,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("[unresolve-shortage-report] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[unresolve-shortage-report] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * DELETE /api/product-shortage-reports
 * Delete a shortage report (admin only)
 */
async function handleDeleteShortageReport(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const { error } = await sb
      .from("product_shortage_reports")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[delete-shortage-report] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[delete-shortage-report] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

// ─── Habitual Products (master list) ────────────────────────────────────────

interface HabitualProduct {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/habitual-products
 * Returns all habitual products for the organization
 */
async function handleGetHabitualProducts(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("habitual_products")
      .select("*, category:product_categories(id, name)")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[habitual-products] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Flatten category
    const flattened = (data || []).map((item: any) => {
      const category = Array.isArray(item.category) ? item.category[0] : item.category;
      return {
        ...item,
        category_name: category?.name || null,
        category: undefined,
      };
    });

    return res.json({ ok: true, data: flattened });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[habitual-products] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/habitual-products
 * Create a new habitual product (admin only)
 */
async function handleCreateHabitualProduct(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { name, brand, category_id, photo_url } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: "El nombre es obligatorio" });
    }

    const { data, error } = await sb
      .from("habitual_products")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        brand: brand?.trim() || null,
        category_id: category_id || null,
        photo_url: photo_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[create-habitual-product] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[create-habitual-product] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * PUT /api/habitual-products
 * Update a habitual product (admin only)
 */
async function handleUpdateHabitualProduct(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id, name, brand, category_id, photo_url } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (brand !== undefined) updates.brand = brand?.trim() || null;
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (photo_url !== undefined) updates.photo_url = photo_url || null;

    const { data, error } = await sb
      .from("habitual_products")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("[update-habitual-product] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[update-habitual-product] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * DELETE /api/habitual-products
 * Delete a habitual product (admin only)
 */
async function handleDeleteHabitualProduct(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, organizationId, userId, "preparation.manage");
    if (!allowed) return res.status(403).json({ ok: false, error: "No permission" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const { error } = await sb
      .from("habitual_products")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[delete-habitual-product] Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[delete-habitual-product] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

export {
  handleGetProductCategories,
  handleCreateProductCategory,
  handleUpdateProductCategory,
  handleDeleteProductCategory,
  handleGetShortageReports,
  handleGetShortageReportsCount,
  handleCreateShortageReport,
  handleResolveShortageReport,
  handleUnresolveShortageReport,
  handleDeleteShortageReport,
  handleGetHabitualProducts,
  handleCreateHabitualProduct,
  handleUpdateHabitualProduct,
  handleDeleteHabitualProduct,
};
