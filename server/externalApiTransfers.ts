/**
 * External API - Transfer Requests
 * 
 * RESTful API for external systems (e.g., Bluebnc BYM) to create and manage
 * transfer requests in PlanMint.
 * 
 * Base path: /api/external/v1/transfers
 * Auth: X-API-Key header
 * 
 * Endpoints:
 *   POST   /                    → Create a new transfer request
 *   GET    /                    → List transfer requests (paginated)
 *   GET    /:id                 → Get transfer request details
 *   GET    /:id/status          → Get current status
 *   POST   /:id/cancel          → Cancel a transfer request
 *   GET    /brokers             → List available brokers
 *   GET    /vehicle-types       → List available vehicle types
 */
import { Request, Response, Router } from "express";
import {
  authenticateExternalApi,
  ExternalApiError,
  logExternalApiRequest,
} from "./externalApiAuth";
import { getServiceClient } from "./supabaseAdmin";
import { onTransferCreated } from "./automationEngine";
import { notifyOwner } from "./_core/notification";

const router = Router();

// ─── Validation Helpers ───────────────────────────────────────────────────────

interface TransferItemInput {
  transfer_date: string; // YYYY-MM-DD
  pickup_location: string;
  pickup_time?: string; // HH:MM
  dropoff_location: string;
  dropoff_time?: string; // HH:MM
  pax_count?: number;
  vehicle_type?: string;
  flight_number?: string;
  notes?: string;
  baby_seats_count?: number;
  baby_seats?: Array<{ age: number; weight: number }>;
  direction?: "ida" | "vuelta";
  has_return?: boolean;
  return_pickup_location?: string;
  return_pickup_time?: string;
  return_dropoff_location?: string;
  return_dropoff_time?: string;
}

interface CreateTransferInput {
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_type?: "external_client" | "villa" | "boat";
  villa_name?: string;
  boat_name?: string;
  berth_number?: string;
  captain_name?: string;
  captain_phone?: string;
  service_type?: "point_to_point" | "hourly" | "daily" | "airport" | "port";
  notes?: string;
  broker_reference?: string; // External reference from BYM
  items: TransferItemInput[];
}

function validateDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function validateTime(timeStr: string): boolean {
  const regex = /^\d{2}:\d{2}$/;
  return regex.test(timeStr);
}

function validateCreateInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.client_name || typeof body.client_name !== "string" || body.client_name.trim().length === 0) {
    errors.push("client_name is required and must be a non-empty string");
  }

  if (body.client_type && !["external_client", "villa", "boat"].includes(body.client_type)) {
    errors.push("client_type must be one of: external_client, villa, boat");
  }

  if (body.service_type && !["point_to_point", "hourly", "daily", "airport", "port"].includes(body.service_type)) {
    errors.push("service_type must be one of: point_to_point, hourly, daily, airport, port");
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push("items is required and must be a non-empty array");
  } else {
    body.items.forEach((item: any, index: number) => {
      const prefix = `items[${index}]`;

      if (!item.transfer_date || !validateDate(item.transfer_date)) {
        errors.push(`${prefix}.transfer_date is required (format: YYYY-MM-DD)`);
      }

      if (!item.pickup_location || typeof item.pickup_location !== "string") {
        errors.push(`${prefix}.pickup_location is required`);
      }

      if (!item.dropoff_location || typeof item.dropoff_location !== "string") {
        errors.push(`${prefix}.dropoff_location is required`);
      }

      if (item.pickup_time && !validateTime(item.pickup_time)) {
        errors.push(`${prefix}.pickup_time must be in HH:MM format`);
      }

      if (item.dropoff_time && !validateTime(item.dropoff_time)) {
        errors.push(`${prefix}.dropoff_time must be in HH:MM format`);
      }

      if (item.pax_count !== undefined && (typeof item.pax_count !== "number" || item.pax_count < 1 || item.pax_count > 50)) {
        errors.push(`${prefix}.pax_count must be a number between 1 and 50`);
      }

      if (item.vehicle_type && !["sedan", "v_class", "minibus", "sprinter", "luxury"].includes(item.vehicle_type)) {
        errors.push(`${prefix}.vehicle_type must be one of: sedan, v_class, minibus, sprinter, luxury`);
      }

      if (item.direction && !["ida", "vuelta"].includes(item.direction)) {
        errors.push(`${prefix}.direction must be one of: ida, vuelta`);
      }

      if (item.has_return) {
        if (!item.return_pickup_location) {
          errors.push(`${prefix}.return_pickup_location is required when has_return is true`);
        }
        if (!item.return_dropoff_location) {
          errors.push(`${prefix}.return_dropoff_location is required when has_return is true`);
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Generate next request number ────────────────────────────────────────────

async function getNextRequestNumber(organizationId: string): Promise<string> {
  const supabase = getServiceClient();
  const year = new Date().getFullYear();

  const { count, error } = await supabase
    .from("transfer_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[ExternalAPI] Error getting request count:", error);
  }

  const nextNum = (count || 0) + 1;
  return `TRF-${year}-${String(nextNum).padStart(4, "0")}`;
}

// ─── POST /api/external/v1/transfers ─────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let auth;

  try {
    auth = await authenticateExternalApi(req, "transfers.create");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  try {
    const input: CreateTransferInput = req.body;

    // Validate input
    const validation = validateCreateInput(input);
    if (!validation.valid) {
      const response = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: validation.errors,
        },
      };
      await logExternalApiRequest({
        apiKeyId: auth.apiKeyId,
        organizationId: auth.organizationId,
        method: "POST",
        endpoint: "/api/external/v1/transfers",
        statusCode: 422,
        requestBody: req.body,
        responseBody: response,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        durationMs: Date.now() - startTime,
      });
      return res.status(422).json(response);
    }

    const supabase = getServiceClient();

    // Generate request number
    const requestNumber = await getNextRequestNumber(auth.organizationId);

    // Determine broker name from API key metadata or use key name
    const brokerName = auth.keyName;

    // Create the transfer request
    const { data: request, error: requestError } = await supabase
      .from("transfer_requests")
      .insert({
        organization_id: auth.organizationId,
        request_number: requestNumber,
        broker_name: brokerName,
        client_name: input.client_name.trim(),
        client_phone: input.client_phone || null,
        client_email: input.client_email || null,
        client_type: input.client_type || "external_client",
        villa_name: input.villa_name || null,
        boat_name: input.boat_name || null,
        berth_number: input.berth_number || null,
        captain_name: input.captain_name || null,
        captain_phone: input.captain_phone || null,
        service_type: input.service_type || "point_to_point",
        notes: input.notes || null,
        client_reference: input.broker_reference || null,
        status: "pendiente",
      })
      .select("id, request_number, status, created_at")
      .single();

    if (requestError || !request) {
      console.error("[ExternalAPI] Error creating transfer request:", requestError);
      throw new Error("Failed to create transfer request");
    }

    // Create transfer items
    const itemsToInsert = input.items.map((item, index) => ({
      request_id: request.id,
      organization_id: auth.organizationId,
      position: index + 1,
      transfer_date: item.transfer_date,
      pickup_enabled: true,
      pickup_location: item.pickup_location,
      pickup_time: item.pickup_time ? `${item.pickup_time}:00` : null,
      dropoff_enabled: true,
      dropoff_location: item.dropoff_location,
      dropoff_time: item.dropoff_time ? `${item.dropoff_time}:00` : null,
      pax_count: item.pax_count || 1,
      vehicle_type: item.vehicle_type || "v_class",
      flight_number: item.flight_number || null,
      notes: item.notes || null,
      baby_seats_count: item.baby_seats_count || null,
      baby_seats: item.baby_seats ? JSON.stringify(item.baby_seats) : null,
      direction: item.direction || "ida",
      transfer_time: item.pickup_time ? `${item.pickup_time}:00` : null,
      has_return: item.has_return || false,
      return_pickup_enabled: item.has_return || false,
      return_pickup_location: item.return_pickup_location || null,
      return_pickup_time: item.return_pickup_time ? `${item.return_pickup_time}:00` : null,
      return_dropoff_enabled: item.has_return || false,
      return_dropoff_location: item.return_dropoff_location || null,
      return_dropoff_time: item.return_dropoff_time ? `${item.return_dropoff_time}:00` : null,
      status: "pendiente",
      driver_pending: true,
    }));

    const { data: items, error: itemsError } = await supabase
      .from("transfer_items")
      .insert(itemsToInsert)
      .select("id, position, transfer_date, pickup_location, dropoff_location, vehicle_type, pax_count");

    if (itemsError) {
      console.error("[ExternalAPI] Error creating transfer items:", itemsError);
      // Rollback: delete the request
      await supabase.from("transfer_requests").delete().eq("id", request.id);
      throw new Error("Failed to create transfer items");
    }

    // Log status history
    await supabase.from("transfer_status_history").insert({
      request_id: request.id,
      organization_id: auth.organizationId,
      previous_status: null,
      new_status: "pendiente",
      changed_by_type: "api",
      changed_by_name: `API: ${auth.keyName}`,
      note: `Solicitud creada vía API externa (${auth.keyName})`,
    });

    // Notify owner if baby seats are needed (non-blocking)
    const itemsWithBabySeats = input.items.filter((item) => item.baby_seats_count && item.baby_seats_count > 0);
    if (itemsWithBabySeats.length > 0) {
      const totalSeats = itemsWithBabySeats.reduce((sum, item) => sum + (item.baby_seats_count || 0), 0);
      const getGroup = (w: number) => w < 9 ? 'Grupo 0' : w < 18 ? 'Grupo 1' : w <= 36 ? 'Grupo 2' : 'Grupo 3';
      const seatDetails = itemsWithBabySeats.map((item) => {
        if (item.baby_seats) {
          return item.baby_seats.map((s, i) => `  - Silla ${i + 1}: ${s.age} a\u00f1os, ${s.weight} kg (${getGroup(s.weight)})`).join('\n');
        }
        return `  - ${item.baby_seats_count} sillita(s)`;
      }).join('\n');
      notifyOwner({
        title: `\u{1F476} ${totalSeats} sillita${totalSeats > 1 ? 's' : ''} de beb\u00e9 - ${input.client_name} (${requestNumber})`,
        content: `Transfer creado v\u00eda API externa que requiere ${totalSeats} sillita${totalSeats > 1 ? 's' : ''} de beb\u00e9.\n\nDetalle:\n${seatDetails}`,
      }).catch((e) => console.error('[ExternalAPI] Baby seat notification error:', e));
    }

    // Fire automation (non-blocking)
    onTransferCreated({
      request_id: request.id,
      organization_id: auth.organizationId,
      status: "pendiente",
      broker_name: brokerName,
      client_name: input.client_name,
      service_type: input.service_type || "point_to_point",
      request_number: requestNumber,
      triggered_by_name: `API: ${auth.keyName}`,
    }).catch((err) => {
      console.error("[ExternalAPI] Automation error (non-blocking):", err);
    });

    const response = {
      success: true,
      data: {
        id: request.id,
        request_number: request.request_number,
        status: request.status,
        created_at: request.created_at,
        items_count: items?.length || 0,
        items: items?.map((i) => ({
          id: i.id,
          position: i.position,
          transfer_date: i.transfer_date,
          pickup_location: i.pickup_location,
          dropoff_location: i.dropoff_location,
          vehicle_type: i.vehicle_type,
          pax_count: i.pax_count,
        })),
      },
    };

    await logExternalApiRequest({
      apiKeyId: auth.apiKeyId,
      organizationId: auth.organizationId,
      method: "POST",
      endpoint: "/api/external/v1/transfers",
      statusCode: 201,
      requestBody: req.body,
      responseBody: { success: true, request_id: request.id },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      durationMs: Date.now() - startTime,
    });

    return res.status(201).json(response);
  } catch (err: any) {
    console.error("[ExternalAPI] POST /transfers error:", err);
    const response = {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create transfer request" },
    };
    if (auth) {
      await logExternalApiRequest({
        apiKeyId: auth.apiKeyId,
        organizationId: auth.organizationId,
        method: "POST",
        endpoint: "/api/external/v1/transfers",
        statusCode: 500,
        requestBody: req.body,
        responseBody: response,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        durationMs: Date.now() - startTime,
      });
    }
    return res.status(500).json(response);
  }
});

// ─── GET /api/external/v1/transfers ──────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let auth;

  try {
    auth = await authenticateExternalApi(req, "transfers.read");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  try {
    const supabase = getServiceClient();

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Filters
    const status = req.query.status as string;
    const fromDate = req.query.from_date as string;
    const toDate = req.query.to_date as string;
    const search = req.query.search as string;

    let query = supabase
      .from("transfer_requests")
      .select("id, request_number, broker_name, client_name, client_phone, client_email, status, service_type, client_type, notes, client_reference, created_at, updated_at", { count: "exact" })
      .eq("organization_id", auth.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (fromDate && validateDate(fromDate)) {
      query = query.gte("created_at", `${fromDate}T00:00:00Z`);
    }
    if (toDate && validateDate(toDate)) {
      query = query.lte("created_at", `${toDate}T23:59:59Z`);
    }
    if (search) {
      query = query.or(`client_name.ilike.%${search}%,request_number.ilike.%${search}%,client_reference.ilike.%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[ExternalAPI] Error listing transfers:", error);
      throw new Error("Failed to list transfers");
    }

    const response = {
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };

    await logExternalApiRequest({
      apiKeyId: auth.apiKeyId,
      organizationId: auth.organizationId,
      method: "GET",
      endpoint: "/api/external/v1/transfers",
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      durationMs: Date.now() - startTime,
    });

    return res.json(response);
  } catch (err: any) {
    console.error("[ExternalAPI] GET /transfers error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list transfers" },
    });
  }
});

// ─── GET /api/external/v1/transfers/:id ──────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let auth;

  try {
    auth = await authenticateExternalApi(req, "transfers.read");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  try {
    const { id } = req.params;
    const supabase = getServiceClient();

    // Get the request
    const { data: request, error: reqError } = await supabase
      .from("transfer_requests")
      .select("*")
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .single();

    if (reqError || !request) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Transfer request not found" },
      });
    }

    // Get items
    const { data: items } = await supabase
      .from("transfer_items")
      .select("*")
      .eq("request_id", id)
      .order("position", { ascending: true });

    // Get status history
    const { data: history } = await supabase
      .from("transfer_status_history")
      .select("previous_status, new_status, changed_by_type, changed_by_name, note, created_at")
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    const response = {
      success: true,
      data: {
        ...request,
        items: items || [],
        status_history: history || [],
      },
    };

    await logExternalApiRequest({
      apiKeyId: auth.apiKeyId,
      organizationId: auth.organizationId,
      method: "GET",
      endpoint: `/api/external/v1/transfers/${id}`,
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      durationMs: Date.now() - startTime,
    });

    return res.json(response);
  } catch (err: any) {
    console.error("[ExternalAPI] GET /transfers/:id error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get transfer details" },
    });
  }
});

// ─── GET /api/external/v1/transfers/:id/status ───────────────────────────────

router.get("/:id/status", async (req: Request, res: Response) => {
  let auth;

  try {
    auth = await authenticateExternalApi(req, "transfers.read");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  try {
    const { id } = req.params;
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("transfer_requests")
      .select("id, request_number, status, updated_at")
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Transfer request not found" },
      });
    }

    return res.json({
      success: true,
      data: {
        id: data.id,
        request_number: data.request_number,
        status: data.status,
        updated_at: data.updated_at,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get status" },
    });
  }
});

// ─── POST /api/external/v1/transfers/:id/cancel ──────────────────────────────

router.post("/:id/cancel", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let auth;

  try {
    auth = await authenticateExternalApi(req, "transfers.cancel");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const supabase = getServiceClient();

    // Get current request
    const { data: request, error: reqError } = await supabase
      .from("transfer_requests")
      .select("id, status, request_number")
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .single();

    if (reqError || !request) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Transfer request not found" },
      });
    }

    // Check if cancellation is possible
    if (request.status === "cancelado") {
      return res.status(409).json({
        success: false,
        error: { code: "ALREADY_CANCELLED", message: "Transfer is already cancelled" },
      });
    }

    if (request.status === "completado") {
      return res.status(409).json({
        success: false,
        error: { code: "ALREADY_COMPLETED", message: "Cannot cancel a completed transfer" },
      });
    }

    // Update status
    const { error: updateError } = await supabase
      .from("transfer_requests")
      .update({
        status: "cancelado",
        rejection_reason: reason || "Cancelado vía API externa",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      throw new Error("Failed to cancel transfer");
    }

    // Log status change
    await supabase.from("transfer_status_history").insert({
      request_id: id,
      organization_id: auth.organizationId,
      previous_status: request.status,
      new_status: "cancelado",
      changed_by_type: "api",
      changed_by_name: `API: ${auth.keyName}`,
      note: reason || "Cancelado vía API externa",
    });

    const response = {
      success: true,
      data: {
        id: request.id,
        request_number: request.request_number,
        previous_status: request.status,
        new_status: "cancelado",
        cancelled_at: new Date().toISOString(),
      },
    };

    await logExternalApiRequest({
      apiKeyId: auth.apiKeyId,
      organizationId: auth.organizationId,
      method: "POST",
      endpoint: `/api/external/v1/transfers/${id}/cancel`,
      statusCode: 200,
      requestBody: req.body,
      responseBody: response,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      durationMs: Date.now() - startTime,
    });

    return res.json(response);
  } catch (err: any) {
    console.error("[ExternalAPI] POST /transfers/:id/cancel error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to cancel transfer" },
    });
  }
});

// ─── GET /api/external/v1/transfers/meta/vehicle-types ───────────────────────

router.get("/meta/vehicle-types", async (req: Request, res: Response) => {
  try {
    await authenticateExternalApi(req, "transfers.read");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  return res.json({
    success: true,
    data: [
      { id: "sedan", name: "Sedan", description: "Berlina estándar (hasta 3 pasajeros)", max_pax: 3 },
      { id: "v_class", name: "V-Class", description: "Mercedes V-Class (hasta 6 pasajeros)", max_pax: 6 },
      { id: "minibus", name: "Minibus", description: "Minibus (hasta 16 pasajeros)", max_pax: 16 },
      { id: "sprinter", name: "Sprinter", description: "Mercedes Sprinter (hasta 19 pasajeros)", max_pax: 19 },
      { id: "luxury", name: "Luxury", description: "Vehículo de lujo (hasta 3 pasajeros)", max_pax: 3 },
    ],
  });
});

// ─── GET /api/external/v1/transfers/meta/statuses ────────────────────────────

router.get("/meta/statuses", async (req: Request, res: Response) => {
  try {
    await authenticateExternalApi(req, "transfers.read");
  } catch (err: any) {
    if (err instanceof ExternalApiError) {
      return res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Authentication failed" },
    });
  }

  return res.json({
    success: true,
    data: [
      { id: "pendiente", name: "Pendiente", description: "Solicitud recibida, pendiente de revisión" },
      { id: "aceptado", name: "Aceptado", description: "Solicitud aceptada y en proceso de asignación" },
      { id: "confirmado", name: "Confirmado", description: "Transfer confirmado con conductor asignado" },
      { id: "en_curso", name: "En Curso", description: "Transfer en ejecución" },
      { id: "completado", name: "Completado", description: "Transfer finalizado" },
      { id: "cancelado", name: "Cancelado", description: "Solicitud cancelada" },
    ],
  });
});

export default router;
