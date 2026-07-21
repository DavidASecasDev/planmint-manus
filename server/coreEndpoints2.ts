/**
 * Core Express endpoints replacing broken Supabase RPCs.
 * Batch 2: get_inactive_vehicles, get_org_integration_flags, get_next_transfer_document_number,
 *          update_vehicle_location, get_reservations_operational
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

// ─── 5. get_inactive_vehicles ─────────────────────────────────────────────────
export async function handleGetInactiveVehicles(req: Request, res: Response) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_org_id } = req.body;
    const orgId = p_org_id || organizationId;

    const serviceClient = getServiceClient();

    // Get vehicles that haven't had a reservation in the last 30 days
    // and are not currently rented or in service
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all non-archived vehicles for the org
    const { data: vehicles, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, matricula, modelo, categoria, current_reservation_id, status, updated_at")
      .eq("organization_id", orgId)
      .eq("is_archived", false);

    if (vehError) {
      console.error("[getInactiveVehicles] Vehicles query error:", vehError);
      return res.status(500).json({ error: "Failed to fetch vehicles" });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json([]);
    }

    // Get the last reservation date for each vehicle
    // reservations table uses 'auto' (matricula text) to link to vehicles, NOT vehicle_id
    const matriculas = vehicles.map((v) => v.matricula).filter(Boolean);
    const { data: reservations } = await serviceClient
      .from("reservations")
      .select("auto, hasta")
      .in("auto", matriculas)
      .order("hasta", { ascending: false });

    // Build a map of matricula -> last reservation date
    const lastResByMatricula: Record<string, string | null> = {};
    if (reservations) {
      for (const r of reservations) {
        if (r.auto && !lastResByMatricula[r.auto]) {
          lastResByMatricula[r.auto] = r.hasta;
        }
      }
    }
    // Convert to vehicle_id map for downstream usage
    const lastReservationMap: Record<string, string | null> = {};
    for (const v of vehicles) {
      if (v.matricula && lastResByMatricula[v.matricula]) {
        lastReservationMap[v.id] = lastResByMatricula[v.matricula];
      }
    }

    // Filter to inactive vehicles: no current reservation, not rented/in_service,
    // and last reservation > 30 days ago or never
    const inactiveVehicles = vehicles
      .filter((v) => {
        if (v.status === "alquilado" || v.status === "en_servicio") return false;
        if (v.current_reservation_id) return false;

        const lastRes = lastReservationMap[v.id];
        if (!lastRes) return true; // Never had a reservation = suspicious
        return new Date(lastRes) < thirtyDaysAgo;
      })
      .map((v) => ({
        vehicle_id: v.id,
        matricula: v.matricula,
        modelo: v.modelo,
        categoria: v.categoria,
        last_reservation_date: lastReservationMap[v.id] || null,
        is_suspicious: !lastReservationMap[v.id], // Never had a reservation
      }));

    return res.json(inactiveVehicles);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getInactiveVehicles] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 6. get_org_integration_flags ─────────────────────────────────────────────
export async function handleGetOrgIntegrationFlags(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id } = req.body;
    const orgId = p_organization_id || organizationId;

    const serviceClient = getServiceClient();

    // Query integration_settings for the organization
    const { data: settings, error } = await serviceClient
      .from("integration_settings")
      .select("*")
      .eq("organization_id", orgId)
      .single();

    if (error || !settings) {
      // Return default flags if no settings found
      return res.json({
        has_rently: false,
        has_ai: false,
        has_slack: false,
        has_whatsapp: false,
        reservations_archive_days: 10,
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
      });
    }

    // Check which integrations are configured (have non-null credentials)
    return res.json({
      has_rently: !!(settings.rently_api_host && settings.rently_client_id && settings.rently_client_secret),
      has_ai: !!(settings.ai_api_key),
      has_slack: !!(settings.slack_webhook_url),
      has_whatsapp: !!(settings.whatsapp_api_key),
      reservations_archive_days: settings.reservations_archive_days ?? 10,
      ai_provider: settings.ai_provider || "openai",
      ai_model: settings.ai_model || "gpt-4o-mini",
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getOrgIntegrationFlags] Error:", err);
    // Return defaults on error instead of 500
    return res.json({
      has_rently: false,
      has_ai: false,
      has_slack: false,
      has_whatsapp: false,
      reservations_archive_days: 10,
      ai_provider: "openai",
      ai_model: "gpt-4o-mini",
    });
  }
}

// ─── 7. get_next_transfer_document_number ─────────────────────────────────────
export async function handleGetNextTransferDocumentNumber(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id, p_document_type } = req.body;
    const orgId = p_organization_id || organizationId;
    const docType = p_document_type || "quote";

    const serviceClient = getServiceClient();

    // Get the count of existing documents of this type for the org
    const { count, error } = await serviceClient
      .from("transfer_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("document_type", docType);

    if (error) {
      console.error("[getNextTransferDocumentNumber] Count error:", error);
      return res.status(500).json({ error: "Failed to get document count" });
    }

    const nextNum = (count || 0) + 1;
    const prefix = docType === "invoice" ? "FAC" : "PRE";
    const year = new Date().getFullYear();
    const paddedNum = String(nextNum).padStart(4, "0");
    const documentNumber = `${prefix}-${year}-${paddedNum}`;

    return res.json(documentNumber);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getNextTransferDocumentNumber] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 8. update_vehicle_location ───────────────────────────────────────────────
export async function handleUpdateVehicleLocation(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_vehicle_id, p_location_id } = req.body;

    if (!p_vehicle_id) {
      return res.status(400).json({ error: "Vehicle ID is required" });
    }

    const serviceClient = getServiceClient();

    // Verify the vehicle belongs to the user's organization
    const { data: vehicle, error: vehError } = await serviceClient
      .from("vehicles")
      .select("id, organization_id")
      .eq("id", p_vehicle_id)
      .single();

    if (vehError || !vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    if (vehicle.organization_id !== organizationId) {
      return res.status(403).json({ error: "Vehicle does not belong to your organization" });
    }

    // If location_id is provided, verify it belongs to the same org
    if (p_location_id) {
      const { data: location, error: locError } = await serviceClient
        .from("vehicle_locations")
        .select("id, organization_id")
        .eq("id", p_location_id)
        .single();

      if (locError || !location) {
        return res.status(404).json({ error: "Location not found" });
      }

      if (location.organization_id !== organizationId) {
        return res.status(403).json({ error: "Location does not belong to your organization" });
      }
    }

    // Update the vehicle's location
    const { error: updateError } = await serviceClient
      .from("vehicles")
      .update({ location_id: p_location_id || null })
      .eq("id", p_vehicle_id);

    if (updateError) {
      console.error("[updateVehicleLocation] Update error:", updateError);
      return res.status(500).json({ error: "Failed to update vehicle location" });
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[updateVehicleLocation] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── 9. get_reservations_operational ──────────────────────────────────────────
export async function handleGetReservationsOperational(
  req: Request,
  res: Response
) {
  try {
    const { organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    const { p_organization_id, dateFrom, dateTo } = req.body;
    const orgId = p_organization_id || organizationId;

    const serviceClient = getServiceClient();

    // Fetch reservations for authenticated users, optionally filtered by date range
    let query = serviceClient
      .from("reservations")
      .select("*")
      .eq("organization_id", orgId)
      .is("archived_at", null);

    // Apply server-side date filter if provided
    // Match reservations where the reservation period overlaps with the requested range
    // Also include reservations with hasta=null (manual operations/transfers) if desde falls in range
    // AND reservations with desde=null (manual devoluciones) if hasta falls in range
    if (dateFrom && dateTo) {
      query = query.or(
        `and(desde.lte.${dateTo}T23:59:59,hasta.gte.${dateFrom}T00:00:00),` +
        `and(desde.gte.${dateFrom}T00:00:00,desde.lte.${dateTo}T23:59:59,hasta.is.null),` +
        `and(desde.is.null,hasta.gte.${dateFrom}T00:00:00,hasta.lte.${dateTo}T23:59:59)`
      );
    } else if (dateFrom) {
      // Single day: include overlapping reservations + manual ops (hasta=null) with desde on that day
      // + manual devoluciones (desde=null) with hasta on that day
      query = query.or(
        `and(desde.lte.${dateFrom}T23:59:59,hasta.gte.${dateFrom}T00:00:00),` +
        `and(desde.gte.${dateFrom}T00:00:00,desde.lte.${dateFrom}T23:59:59,hasta.is.null),` +
        `and(desde.is.null,hasta.gte.${dateFrom}T00:00:00,hasta.lte.${dateFrom}T23:59:59)`
      );
    }
    // If no date filter, fetch all (backwards compatible)

    const { data, error } = await query.order("desde", { ascending: true });

    if (error) {
      console.error("[getReservationsOperational] Query error:", error);
      return res.status(500).json({ error: "Failed to fetch reservations" });
    }

    // Return full data for all authenticated users (PII masking removed)
    return res.json(data || []);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[getReservationsOperational] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
