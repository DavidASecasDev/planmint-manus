/**
 * En Camino Tracking Endpoint
 * Records when a rental marks an operation as "En camino" and provides
 * real-time tracking data for the map view.
 */
import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { notifyOwner } from "./_core/notification";

const getServiceClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface EnCaminoRecord {
  reservation_id: string;
  operation_type: "entrega" | "devolucion";
  destination_address?: string;
  assigned_user_name?: string;
}

/**
 * POST /api/en-camino-tracking
 * Record that a rental has started navigating to a destination.
 * Uses upsert so re-clicking updates the timestamp.
 */
export async function handleEnCaminoTrack(req: Request, res: Response) {
  try {
    // Support _method override for apiInvoke (which always POSTs)
    if (req.body?._method === 'GET') {
      // Delegate to list handler with query params from body
      req.query = { ...req.query, ...req.body };
      return handleEnCaminoList(req, res);
    }
    if (req.body?._method === 'DELETE') {
      return handleEnCaminoDelete(req, res);
    }

    const { reservation_id, operation_type, destination_address, assigned_user_name } =
      req.body as EnCaminoRecord;

    if (!reservation_id || !operation_type) {
      return res.status(400).json({ ok: false, error: "reservation_id and operation_type required" });
    }

    if (!["entrega", "devolucion"].includes(operation_type)) {
      return res.status(400).json({ ok: false, error: "operation_type must be 'entrega' or 'devolucion'" });
    }

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("en_camino_tracking")
      .upsert(
        {
          reservation_id,
          operation_type,
          en_camino_at: new Date().toISOString(),
          destination_address: destination_address || null,
          assigned_user_name: assigned_user_name || null,
        },
        { onConflict: "reservation_id,operation_type" }
      )
      .select()
      .single();

    if (error) {
      console.error("[en-camino-tracking] Upsert error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Fetch reservation details for a richer notification
    let extId = reservation_id.substring(0, 8);
    let clienteName = '';
    try {
      const { data: resData } = await sb
        .from('reservations')
        .select('external_reservation_id, cliente_nombre')
        .eq('id', reservation_id)
        .single();
      if (resData) {
        extId = resData.external_reservation_id || extId;
        clienteName = resData.cliente_nombre || '';
      }
    } catch { /* ignore */ }

    // Send push notification to the team
    const opLabel = operation_type === 'entrega' ? 'Entrega' : 'Devolución';
    const destLabel = destination_address || 'destino no especificado';
    const userLabel = assigned_user_name || 'Sin asignar';
    const clienteLabel = clienteName ? ` (${clienteName})` : '';
    notifyOwner({
      title: `🚗 ${opLabel} en camino — Reserva ${extId}${clienteLabel}`,
      content: `${userLabel} ha salido hacia ${destLabel}`,
    }).catch((err) => console.warn('[en-camino-tracking] Notification error:', err));

    return res.json({ ok: true, record: data });
  } catch (err) {
    console.error("[en-camino-tracking] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * GET /api/en-camino-tracking?date=YYYY-MM-DD
 * Get all "en camino" records for a given date (for the map view).
 * Returns records with reservation details joined.
 */
export async function handleEnCaminoList(req: Request, res: Response) {
  try {
    const { date } = req.query as { date?: string };

    const sb = getServiceClient();

    let query = sb
      .from("en_camino_tracking")
      .select("*")
      .order("en_camino_at", { ascending: false });

    if (date) {
      // Filter by date (en_camino_at within the given day)
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      query = query.gte("en_camino_at", startOfDay).lte("en_camino_at", endOfDay);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[en-camino-tracking] List error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, records: data || [] });
  } catch (err) {
    console.error("[en-camino-tracking] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/en-camino-tracking/llego
 * Record that a rental has arrived at the destination.
 * Updates the llego_at timestamp and returns real vs estimated travel time.
 */
export async function handleEnCaminoLlego(req: Request, res: Response) {
  try {
    const { reservation_id, operation_type, estimated_minutes } = req.body as {
      reservation_id?: string;
      operation_type?: string;
      estimated_minutes?: number | null;
    };

    if (!reservation_id || !operation_type) {
      return res.status(400).json({ ok: false, error: "reservation_id and operation_type required" });
    }

    const sb = getServiceClient();
    const now = new Date().toISOString();

    // Update the record with arrival timestamp
    const { data, error } = await sb
      .from("en_camino_tracking")
      .update({ llego_at: now })
      .eq("reservation_id", reservation_id)
      .eq("operation_type", operation_type)
      .select("en_camino_at, llego_at")
      .single();

    if (error) {
      console.error("[en-camino-tracking/llego] Update error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "No en_camino record found for this operation" });
    }

    // Calculate real travel time in minutes
    const enCaminoAt = new Date(data.en_camino_at);
    const llegoAt = new Date(data.llego_at);
    const realMinutes = Math.round((llegoAt.getTime() - enCaminoAt.getTime()) / 60000);

    return res.json({
      ok: true,
      real_minutes: realMinutes,
      estimated_minutes: estimated_minutes ?? null,
      en_camino_at: data.en_camino_at,
      llego_at: data.llego_at,
    });
  } catch (err) {
    console.error("[en-camino-tracking/llego] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * DELETE /api/en-camino-tracking
 * Remove a tracking record (e.g., when operation is completed or cancelled).
 */
export async function handleEnCaminoDelete(req: Request, res: Response) {
  try {
    const { reservation_id, operation_type } = req.body as {
      reservation_id?: string;
      operation_type?: string;
    };

    if (!reservation_id || !operation_type) {
      return res.status(400).json({ ok: false, error: "reservation_id and operation_type required" });
    }

    const sb = getServiceClient();

    const { error } = await sb
      .from("en_camino_tracking")
      .delete()
      .eq("reservation_id", reservation_id)
      .eq("operation_type", operation_type);

    if (error) {
      console.error("[en-camino-tracking] Delete error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[en-camino-tracking] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
