/**
 * POST /api/change-vehicle-status
 * Allows admins/owners to manually change a vehicle's status in the Kanban.
 * Records an audit log entry for traceability.
 */
import type { Request, Response } from "express";
import {
  authenticateSupabaseRequest,
  AuthError,
  getServiceClient,
} from "./supabaseAdmin";
import { requirePermission } from "./permissionHelper";

const VALID_STATUSES = ["sucio", "incompleto", "limpio", "en_servicio", "alquilado"];

export async function handleChangeVehicleStatus(req: Request, res: Response) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // 1. Authenticate the caller
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    // 2. Check permission
    const serviceClient = getServiceClient();
    await requirePermission(
      serviceClient,
      organizationId,
      userId,
      "vehicles.change_status"
    );

    // 3. Validate inputs
    const { vehicle_id, new_status, reason } = req.body || {};

    if (!vehicle_id || typeof vehicle_id !== "string") {
      return res.status(400).json({ error: "vehicle_id is required" });
    }

    if (!new_status || !VALID_STATUSES.includes(new_status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // 4. Verify the vehicle belongs to the user's organization and get current status
    const { data: vehicle, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, organization_id, vehicle_status, matricula, modelo")
      .eq("id", vehicle_id)
      .single();

    if (vehError || !vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    if (vehicle.organization_id !== organizationId) {
      return res.status(403).json({ error: "Vehicle does not belong to your organization" });
    }

    const from_status = vehicle.vehicle_status || "sucio";

    // 5. If status is the same, no-op
    if (from_status === new_status) {
      return res.json({ success: true, message: "Status unchanged" });
    }

    // 6. Update the vehicle status
    const { error: updateError } = await serviceClient
      .from("vehicles")
      .update({ vehicle_status: new_status })
      .eq("id", vehicle_id);

    if (updateError) {
      console.error("[changeVehicleStatus] Update error:", updateError);
      return res.status(500).json({ error: "Failed to update vehicle status" });
    }

    // 7. Get the actor's name for the audit log
    let changedByName = "Unknown";
    try {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();
      if (profile?.name) changedByName = profile.name;
    } catch {
      // Non-critical
    }

    // 8. Insert audit log entry
    try {
      await serviceClient.from("vehicle_status_audit_log").insert({
        organization_id: organizationId,
        vehicle_id,
        from_status,
        to_status: new_status,
        changed_by: userId,
        changed_by_name: changedByName,
        reason: reason || null,
      });
    } catch (auditErr) {
      // Audit log failure should not block the operation
      console.error("[changeVehicleStatus] Audit log error:", auditErr);
    }

    return res.json({
      success: true,
      from_status,
      to_status: new_status,
      vehicle_matricula: vehicle.matricula,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err?.code === "PERMISSION_DENIED") {
      return res.status(403).json({ error: err.message });
    }
    console.error("[changeVehicleStatus] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/get-vehicle-status-history
 * Returns the audit log for a specific vehicle's status changes.
 */
export async function handleGetVehicleStatusHistory(req: Request, res: Response) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { vehicle_id, limit = 50 } = req.body || {};

    if (!vehicle_id || typeof vehicle_id !== "string") {
      return res.status(400).json({ error: "vehicle_id is required" });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("vehicle_status_audit_log")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicle_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getVehicleStatusHistory] Error:", error);
      return res.status(500).json({ error: "Failed to fetch status history" });
    }

    return res.json({ success: true, history: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getVehicleStatusHistory] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
