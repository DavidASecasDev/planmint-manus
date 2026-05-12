/**
 * Service Request Endpoints — Cross-org vehicle/transfer requests.
 * Allows Bluebnc/Azul Stays to request vehicles or transfers from Azul Cars.
 * Only users with 'transfers.create' permission can create requests.
 * Only users with 'transfers.manage' permission in the fulfilling org can approve/reject.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateServiceRequestBody {
  fulfilling_org_id: string;
  request_type: "vehicle" | "transfer";
  priority?: "low" | "normal" | "high" | "urgent";
  start_date: string;
  end_date?: string;
  vehicle_category?: string;
  passengers?: number;
  pickup_location?: string;
  dropoff_location?: string;
  flight_number?: string;
  client_name?: string;
  client_phone?: string;
  notes?: string;
}

interface ResolveServiceRequestBody {
  request_id: string;
  action: "approve" | "reject";
  internal_notes?: string;
  rejection_reason?: string;
  vehicle_id?: string;
}

// ─── 1. List Service Requests ───────────────────────────────────────────────
// Returns requests relevant to the user's current organization:
// - Outgoing: requests made BY this org
// - Incoming: requests made TO this org
export async function handleListServiceRequests(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const serviceClient = getServiceClient();
    const { direction = "all", status: statusFilter } = req.body || {};

    let query = serviceClient
      .from("service_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by direction
    if (direction === "outgoing") {
      query = query.eq("requesting_org_id", organizationId);
    } else if (direction === "incoming") {
      query = query.eq("fulfilling_org_id", organizationId);
    } else {
      // All: show both incoming and outgoing for this org
      query = query.or(
        `requesting_org_id.eq.${organizationId},fulfilling_org_id.eq.${organizationId}`
      );
    }

    // Optional status filter
    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[listServiceRequests] Query error:", error);
      return res.status(500).json({ data: null, error: error.message });
    }

    // Enrich with org names
    const orgIds = Array.from(
      new Set(
        (data || []).flatMap((r: any) => [r.requesting_org_id, r.fulfilling_org_id])
      )
    );

    const { data: orgs } = await serviceClient
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);

    const orgMap = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));

    // Enrich with user names for requested_by and resolved_by
    const userIds = Array.from(
      new Set(
        (data || [])
          .flatMap((r: any) => [r.requested_by_user_id, r.resolved_by_user_id])
          .filter(Boolean)
      )
    );

    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    const userMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p.name])
    );

    const enriched = (data || []).map((r) => ({
      ...r,
      requesting_org_name: orgMap[r.requesting_org_id] || "Unknown",
      fulfilling_org_name: orgMap[r.fulfilling_org_id] || "Unknown",
      requested_by_name: userMap[r.requested_by_user_id] || "Unknown",
      resolved_by_name: r.resolved_by_user_id
        ? userMap[r.resolved_by_user_id] || "Unknown"
        : null,
      is_incoming: r.fulfilling_org_id === organizationId,
    }));

    return res.json({ data: enriched, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[listServiceRequests] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 2. Create Service Request ──────────────────────────────────────────────
export async function handleCreateServiceRequest(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const serviceClient = getServiceClient();

    // Check permission: transfers.create
    const hasPermission = await checkUserPermission(
      serviceClient,
      organizationId,
      userId,
      "transfers.create"
    );
    if (!hasPermission) {
      return res.status(403).json({ data: null, error: "No tienes permiso para crear solicitudes de servicio" });
    }

    const body: CreateServiceRequestBody = req.body;

    if (!body.fulfilling_org_id || !body.request_type || !body.start_date) {
      return res.status(400).json({
        data: null,
        error: "fulfilling_org_id, request_type, and start_date are required",
      });
    }

    // Validate that the fulfilling org exists and is different from requesting org
    if (body.fulfilling_org_id === organizationId) {
      return res.status(400).json({
        data: null,
        error: "Cannot request service from your own organization",
      });
    }

    const { data, error } = await serviceClient
      .from("service_requests")
      .insert({
        requesting_org_id: organizationId,
        requested_by_user_id: userId,
        fulfilling_org_id: body.fulfilling_org_id,
        request_type: body.request_type,
        priority: body.priority || "normal",
        start_date: body.start_date,
        end_date: body.end_date || null,
        vehicle_category: body.vehicle_category || null,
        passengers: body.passengers || 1,
        pickup_location: body.pickup_location || null,
        dropoff_location: body.dropoff_location || null,
        flight_number: body.flight_number || null,
        client_name: body.client_name || null,
        client_phone: body.client_phone || null,
        notes: body.notes || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[createServiceRequest] Insert error:", error);
      return res.status(500).json({ data: null, error: error.message });
    }

    return res.json({ data, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[createServiceRequest] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 3. Resolve Service Request (Approve/Reject) ───────────────────────────
export async function handleResolveServiceRequest(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const body: ResolveServiceRequestBody = req.body;

    if (!body.request_id || !body.action) {
      return res.status(400).json({
        data: null,
        error: "request_id and action are required",
      });
    }

    const serviceClient = getServiceClient();

    // Fetch the request to verify it belongs to this org as fulfiller
    const { data: request, error: fetchErr } = await serviceClient
      .from("service_requests")
      .select("*")
      .eq("id", body.request_id)
      .single();

    if (fetchErr || !request) {
      return res.status(404).json({ data: null, error: "Service request not found" });
    }

    if (request.fulfilling_org_id !== organizationId) {
      return res.status(403).json({
        data: null,
        error: "Solo la organización receptora puede resolver esta solicitud",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        data: null,
        error: `Esta solicitud ya fue ${request.status === "approved" ? "aprobada" : request.status === "rejected" ? "rechazada" : request.status}`,
      });
    }

    // Check permission: transfers.manage (for approving/rejecting)
    const hasPermission = await checkUserPermission(
      serviceClient,
      organizationId,
      userId,
      "transfers.manage"
    );
    if (!hasPermission) {
      return res.status(403).json({
        data: null,
        error: "No tienes permiso para gestionar solicitudes de servicio",
      });
    }

    // Update the request
    const updateData: Record<string, any> = {
      status: body.action === "approve" ? "approved" : "rejected",
      resolved_by_user_id: userId,
      resolved_at: new Date().toISOString(),
    };

    if (body.internal_notes) {
      updateData.internal_notes = body.internal_notes;
    }

    if (body.action === "reject" && body.rejection_reason) {
      updateData.rejection_reason = body.rejection_reason;
    }

    if (body.action === "approve" && body.vehicle_id) {
      updateData.vehicle_id = body.vehicle_id;
    }

    const { data: updated, error: updateErr } = await serviceClient
      .from("service_requests")
      .update(updateData)
      .eq("id", body.request_id)
      .select()
      .single();

    if (updateErr) {
      console.error("[resolveServiceRequest] Update error:", updateErr);
      return res.status(500).json({ data: null, error: updateErr.message });
    }

    return res.json({ data: updated, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[resolveServiceRequest] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 4. Cancel Service Request ──────────────────────────────────────────────
// Only the requesting org can cancel their own pending requests
export async function handleCancelServiceRequest(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const { request_id } = req.body;

    if (!request_id) {
      return res.status(400).json({ data: null, error: "request_id is required" });
    }

    const serviceClient = getServiceClient();

    // Fetch the request
    const { data: request, error: fetchErr } = await serviceClient
      .from("service_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (fetchErr || !request) {
      return res.status(404).json({ data: null, error: "Service request not found" });
    }

    // Only the requesting org can cancel
    if (request.requesting_org_id !== organizationId) {
      return res.status(403).json({
        data: null,
        error: "Solo la organización solicitante puede cancelar esta solicitud",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        data: null,
        error: "Solo se pueden cancelar solicitudes pendientes",
      });
    }

    const { data: updated, error: updateErr } = await serviceClient
      .from("service_requests")
      .update({
        status: "cancelled",
        resolved_by_user_id: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (updateErr) {
      console.error("[cancelServiceRequest] Update error:", updateErr);
      return res.status(500).json({ data: null, error: updateErr.message });
    }

    return res.json({ data: updated, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[cancelServiceRequest] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 5. Get Available Organizations (for the request form dropdown) ─────────
// Returns all organizations except the current one (potential fulfilling orgs)
export async function handleGetAvailableOrgs(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const serviceClient = getServiceClient();

    const { data: orgs, error } = await serviceClient
      .from("organizations")
      .select("id, name")
      .neq("id", organizationId)
      .order("name");

    if (error) {
      console.error("[getAvailableOrgs] Error:", error);
      return res.status(500).json({ data: null, error: error.message });
    }

    return res.json({ data: orgs || [], error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getAvailableOrgs] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}
