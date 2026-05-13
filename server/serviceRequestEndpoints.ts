/**
 * Service Request Endpoints — Cross-org vehicle/transfer requests.
 * Allows Bluebnc/Azul Stays to request vehicles or transfers from Azul Cars.
 * Only users with 'transfers.create' permission can create requests.
 * Only users with 'transfers.manage' permission in the fulfilling org can manage.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";
import { AZUL_CARS_ORG_ID } from "../shared/const";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateServiceRequestBody {
  request_type: "vehicle" | "transfer";
  start_date: string;
  end_date?: string;
  vehicle_category?: string;
  passengers?: number;
  pickup_location?: string;
  dropoff_location?: string;
  flight_number?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  notes?: string;
}

interface UpdateServiceRequestStatusBody {
  request_id: string;
  status: "in_progress" | "vehicle_assigned" | "completed" | "rejected" | "cancelled";
  internal_notes?: string;
  rejection_reason?: string;
  vehicle_id?: string;
}

// ─── 1. List Service Requests ───────────────────────────────────────────────
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

    // Enrich with user names
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

    if (!body.request_type || !body.start_date) {
      return res.status(400).json({
        data: null,
        error: "request_type and start_date are required",
      });
    }

    // Fulfilling org is always Azul Cars (the vehicle provider)
    const fulfilling_org_id = AZUL_CARS_ORG_ID;

    // Cannot request from your own org
    if (fulfilling_org_id === organizationId) {
      return res.status(400).json({
        data: null,
        error: "Azul Cars no puede crear solicitudes a sí misma",
      });
    }

    const { data, error } = await serviceClient
      .from("service_requests")
      .insert({
        requesting_org_id: organizationId,
        requested_by_user_id: userId,
        fulfilling_org_id: fulfilling_org_id,
        request_type: body.request_type,
        priority: "normal",
        start_date: body.start_date,
        end_date: body.end_date || null,
        vehicle_category: body.vehicle_category || null,
        passengers: body.passengers || 1,
        pickup_location: body.pickup_location || null,
        dropoff_location: body.dropoff_location || null,
        flight_number: body.flight_number || null,
        client_name: body.client_name || null,
        client_phone: body.client_phone || null,
        client_email: body.client_email || null,
        client_address: body.request_type === "vehicle" ? (body.client_address || null) : null,
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

// ─── 3. Update Service Request Status (step-by-step workflow) ───────────────
// Status flow: pending → in_progress → vehicle_assigned → completed
// Or: pending → rejected / cancelled at any point
export async function handleUpdateServiceRequestStatus(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const body: UpdateServiceRequestStatusBody = req.body;

    if (!body.request_id || !body.status) {
      return res.status(400).json({
        data: null,
        error: "request_id and status are required",
      });
    }

    const serviceClient = getServiceClient();

    // Fetch the request
    const { data: request, error: fetchErr } = await serviceClient
      .from("service_requests")
      .select("*")
      .eq("id", body.request_id)
      .single();

    if (fetchErr || !request) {
      return res.status(404).json({ data: null, error: "Service request not found" });
    }

    // Permission checks based on action
    const isFulfiller = request.fulfilling_org_id === organizationId;
    const isRequester = request.requesting_org_id === organizationId;

    // Only the fulfilling org (Azul Cars) can move through workflow states
    if (["in_progress", "vehicle_assigned", "completed", "rejected"].includes(body.status)) {
      if (!isFulfiller) {
        return res.status(403).json({
          data: null,
          error: "Solo la organización receptora puede gestionar esta solicitud",
        });
      }
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
    }

    // Only the requester can cancel (and only if not completed)
    if (body.status === "cancelled") {
      if (!isRequester && !isFulfiller) {
        return res.status(403).json({
          data: null,
          error: "No tienes permiso para cancelar esta solicitud",
        });
      }
      if (request.status === "completed") {
        return res.status(400).json({
          data: null,
          error: "No se puede cancelar una solicitud completada",
        });
      }
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      pending: ["in_progress", "rejected", "cancelled"],
      in_progress: ["vehicle_assigned", "rejected", "cancelled"],
      vehicle_assigned: ["completed", "cancelled"],
      approved: ["in_progress", "vehicle_assigned", "completed", "cancelled"], // legacy support
    };

    const allowed = validTransitions[request.status] || [];
    if (!allowed.includes(body.status)) {
      return res.status(400).json({
        data: null,
        error: `No se puede cambiar de "${request.status}" a "${body.status}"`,
      });
    }

    // Build update data
    const updateData: Record<string, any> = {
      status: body.status,
    };

    if (body.internal_notes) {
      updateData.internal_notes = body.internal_notes;
    }

    if (body.status === "rejected" && body.rejection_reason) {
      updateData.rejection_reason = body.rejection_reason;
    }

    if (body.vehicle_id && (body.status === "vehicle_assigned" || body.status === "completed")) {
      updateData.vehicle_id = body.vehicle_id;
    }

    // Mark resolved when completing or rejecting
    if (["completed", "rejected"].includes(body.status)) {
      updateData.resolved_by_user_id = userId;
      updateData.resolved_at = new Date().toISOString();
    }

    const { data: updated, error: updateErr } = await serviceClient
      .from("service_requests")
      .update(updateData)
      .eq("id", body.request_id)
      .select()
      .single();

    if (updateErr) {
      console.error("[updateServiceRequestStatus] Update error:", updateErr);
      return res.status(500).json({ data: null, error: updateErr.message });
    }

    return res.json({ data: updated, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[updateServiceRequestStatus] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 4. Get Service Request Detail ─────────────────────────────────────────
export async function handleGetServiceRequestDetail(req: Request, res: Response) {
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

    const { data: request, error } = await serviceClient
      .from("service_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (error || !request) {
      return res.status(404).json({ data: null, error: "Service request not found" });
    }

    // Only requesting or fulfilling org can view
    if (request.requesting_org_id !== organizationId && request.fulfilling_org_id !== organizationId) {
      return res.status(403).json({ data: null, error: "No tienes acceso a esta solicitud" });
    }

    // Enrich with org names and user names
    const orgIds = [request.requesting_org_id, request.fulfilling_org_id];
    const { data: orgs } = await serviceClient
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    const orgMap = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));

    const userIds = [request.requested_by_user_id, request.resolved_by_user_id].filter(Boolean);
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, name")
      .in("id", userIds);
    const userMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));

    // If vehicle is assigned, get vehicle info
    let vehicleInfo = null;
    if (request.vehicle_id) {
      const { data: vehicle } = await serviceClient
        .from("vehicles")
        .select("id, matricula, modelo")
        .eq("id", request.vehicle_id)
        .single();
      vehicleInfo = vehicle;
    }

    const enriched = {
      ...request,
      requesting_org_name: orgMap[request.requesting_org_id] || "Unknown",
      fulfilling_org_name: orgMap[request.fulfilling_org_id] || "Unknown",
      requested_by_name: userMap[request.requested_by_user_id] || "Unknown",
      resolved_by_name: request.resolved_by_user_id
        ? userMap[request.resolved_by_user_id] || "Unknown"
        : null,
      is_incoming: request.fulfilling_org_id === organizationId,
      vehicle_info: vehicleInfo,
    };

    return res.json({ data: enriched, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getServiceRequestDetail] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 5. Cancel Service Request ──────────────────────────────────────────────
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

    if (request.status === "completed" || request.status === "cancelled") {
      return res.status(400).json({
        data: null,
        error: "No se puede cancelar esta solicitud en su estado actual",
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

// ─── 6. Get Available Organizations ─────────────────────────────────────────
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

// ─── 7. Get Vehicle Models (distinct marca + modelo from fleet) ─────────────
// Returns distinct brand+model combinations from Azul Cars fleet
export async function handleGetVehicleModels(req: Request, res: Response) {
  try {
    await authenticateSupabaseRequest(req.headers.authorization);

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("fleet_vehicles")
      .select("marca, modelo")
      .eq("organization_id", AZUL_CARS_ORG_ID)
      .order("marca")
      .order("modelo");

    if (error) {
      console.error("[getVehicleModels] Error:", error);
      return res.status(500).json({ data: null, error: error.message });
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = (data || []).filter((v) => {
      const key = `${v.marca || ""}|${v.modelo || ""}`;
      if (seen.has(key) || (!v.marca && !v.modelo)) return false;
      seen.add(key);
      return true;
    }).map((v) => ({
      label: v.marca ? `${v.marca} ${v.modelo || ""}`.trim() : (v.modelo || ""),
      marca: v.marca || "",
      modelo: v.modelo || "",
    }));

    return res.json({ data: unique, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getVehicleModels] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 8. Upload Service Request Document ─────────────────────────────────────
// Uploads passport/ID or driving license and updates the request
export async function handleUploadServiceRequestDoc(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const { request_id, doc_type, file_url } = req.body;

    if (!request_id || !doc_type || !file_url) {
      return res.status(400).json({
        data: null,
        error: "request_id, doc_type, and file_url are required",
      });
    }

    if (!["passport", "driving_license"].includes(doc_type)) {
      return res.status(400).json({
        data: null,
        error: "doc_type must be 'passport' or 'driving_license'",
      });
    }

    const serviceClient = getServiceClient();

    // Verify request exists and user has access
    const { data: request, error: fetchErr } = await serviceClient
      .from("service_requests")
      .select("requesting_org_id, fulfilling_org_id")
      .eq("id", request_id)
      .single();

    if (fetchErr || !request) {
      return res.status(404).json({ data: null, error: "Service request not found" });
    }

    if (request.requesting_org_id !== organizationId && request.fulfilling_org_id !== organizationId) {
      return res.status(403).json({ data: null, error: "No tienes acceso a esta solicitud" });
    }

    // Update the appropriate column
    const column = doc_type === "passport" ? "passport_url" : "driving_license_url";
    const { data: updated, error: updateErr } = await serviceClient
      .from("service_requests")
      .update({ [column]: file_url })
      .eq("id", request_id)
      .select()
      .single();

    if (updateErr) {
      console.error("[uploadServiceRequestDoc] Update error:", updateErr);
      return res.status(500).json({ data: null, error: updateErr.message });
    }

    return res.json({ data: updated, error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[uploadServiceRequestDoc] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── 9. Get Available Vehicles (for assigning to a request) ─────────────────
// Returns vehicles from Azul Cars that can be assigned
export async function handleGetAvailableVehicles(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    // Only Azul Cars can assign vehicles
    if (organizationId !== AZUL_CARS_ORG_ID) {
      return res.status(403).json({ data: null, error: "Solo Azul Cars puede asignar vehículos" });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("vehicles")
      .select("id, matricula, modelo, status")
      .eq("organization_id", AZUL_CARS_ORG_ID)
      .eq("is_archived", false)
      .in("status", ["available", "limpio", "disponible"])
      .order("matricula");

    if (error) {
      console.error("[getAvailableVehicles] Error:", error);
      return res.status(500).json({ data: null, error: error.message });
    }

    return res.json({ data: data || [], error: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[getAvailableVehicles] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}

// ─── Legacy: Resolve Service Request (kept for backward compat) ─────────────
export async function handleResolveServiceRequest(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ data: null, error: "No organization context" });
    }

    const { request_id, action, internal_notes, rejection_reason, vehicle_id } = req.body;

    if (!request_id || !action) {
      return res.status(400).json({
        data: null,
        error: "request_id and action are required",
      });
    }

    const serviceClient = getServiceClient();

    const { data: request, error: fetchErr } = await serviceClient
      .from("service_requests")
      .select("*")
      .eq("id", request_id)
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

    const updateData: Record<string, any> = {
      status: action === "approve" ? "in_progress" : "rejected",
      resolved_by_user_id: userId,
      resolved_at: new Date().toISOString(),
    };

    if (internal_notes) updateData.internal_notes = internal_notes;
    if (action === "reject" && rejection_reason) updateData.rejection_reason = rejection_reason;
    if (action === "approve" && vehicle_id) updateData.vehicle_id = vehicle_id;

    const { data: updated, error: updateErr } = await serviceClient
      .from("service_requests")
      .update(updateData)
      .eq("id", request_id)
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
