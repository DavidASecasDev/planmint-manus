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
  estimated_minutes?: number | null;
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

    const { reservation_id, operation_type, destination_address, assigned_user_name, estimated_minutes } =
      req.body as EnCaminoRecord;

    if (!reservation_id || !operation_type) {
      return res.status(400).json({ ok: false, error: "reservation_id and operation_type required" });
    }

    if (!["entrega", "devolucion"].includes(operation_type)) {
      return res.status(400).json({ ok: false, error: "operation_type must be 'entrega' or 'devolucion'" });
    }

    const sb = getServiceClient();

    // Bug fix: Prevent re-starting a completed operation (one that already has llego_at)
    const { data: existing } = await sb
      .from("en_camino_tracking")
      .select("id, llego_at")
      .eq("reservation_id", reservation_id)
      .eq("operation_type", operation_type)
      .maybeSingle();

    if (existing?.llego_at) {
      return res.status(409).json({
        ok: false,
        error: "Esta operación ya fue completada. No se puede volver a iniciar.",
      });
    }

    const { data, error } = await sb
      .from("en_camino_tracking")
      .upsert(
        {
          reservation_id,
          operation_type,
          en_camino_at: new Date().toISOString(),
          destination_address: destination_address || null,
          assigned_user_name: assigned_user_name || null,
          estimated_minutes: estimated_minutes ?? null,
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

    // Create in-app notifications for all team members in the organization
    try {
      // Get the reservation's organization_id
      const { data: resOrg } = await sb
        .from('reservations')
        .select('organization_id')
        .eq('id', reservation_id)
        .single();
      
      if (resOrg?.organization_id) {
        // Get all active team members in the organization
        const { data: members } = await sb
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', resOrg.organization_id)
          .eq('status', 'active');
        
        if (members && members.length > 0) {
          const notificationTitle = `🚗 ${opLabel} en camino`;
          const notificationBody = `${userLabel} ha salido hacia ${destLabel}${clienteLabel}`;
          
          const notifications = members.map((m: { user_id: string }) => ({
            organization_id: resOrg.organization_id,
            user_id: m.user_id,
            type: 'en_camino_alert',
            title: notificationTitle,
            body: notificationBody.substring(0, 500),
            entity_type: 'en_camino',
            entity_id: reservation_id,
          }));
          
          await sb.from('notifications').insert(notifications);
        }
      }
    } catch (notifErr) {
      console.warn('[en-camino-tracking] Team notification error:', notifErr);
    }

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
    const { date, include_completed } = req.query as { date?: string; include_completed?: string };

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

    // By default, exclude completed operations (those with llego_at set)
    // Only include them if explicitly requested (for reports/history)
    if (include_completed !== 'true') {
      query = query.is("llego_at", null);
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
    const { reservation_id, operation_type, estimated_minutes, llego_user_name } = req.body as {
      reservation_id?: string;
      operation_type?: string;
      estimated_minutes?: number | null;
      llego_user_name?: string;
    };

    if (!reservation_id || !operation_type) {
      return res.status(400).json({ ok: false, error: "reservation_id and operation_type required" });
    }

    const sb = getServiceClient();
    const now = new Date().toISOString();

    // Bug fix: Prevent registering arrival multiple times
    const { data: existingRecord } = await sb
      .from("en_camino_tracking")
      .select("id, llego_at, en_camino_at")
      .eq("reservation_id", reservation_id)
      .eq("operation_type", operation_type)
      .maybeSingle();

    if (existingRecord?.llego_at) {
      // Already arrived — return the existing data instead of overwriting
      const realMinutes = Math.round(
        (new Date(existingRecord.llego_at).getTime() - new Date(existingRecord.en_camino_at).getTime()) / 60000
      );
      return res.json({
        ok: true,
        real_minutes: realMinutes,
        estimated_minutes: estimated_minutes ?? null,
        en_camino_at: existingRecord.en_camino_at,
        llego_at: existingRecord.llego_at,
        already_arrived: true,
      });
    }

    // Update the record with arrival timestamp and who arrived
    const updatePayload: Record<string, unknown> = { llego_at: now };
    if (llego_user_name) {
      updatePayload.llego_user_name = llego_user_name;
    }

    const { data, error } = await sb
      .from("en_camino_tracking")
      .update(updatePayload)
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
 * POST /api/en-camino-tracking/status
 * Get arrival status for multiple reservation operations.
 * Body: { reservation_ids: string[] }
 * Returns map of reservation_id -> { en_camino_at, llego_at, real_minutes, estimated_minutes }
 */
export async function handleEnCaminoStatus(req: Request, res: Response) {
  try {
    const { reservation_ids } = req.body as { reservation_ids?: string[] };

    if (!reservation_ids || !Array.isArray(reservation_ids) || reservation_ids.length === 0) {
      return res.json({ ok: true, statuses: {} });
    }

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("en_camino_tracking")
      .select("reservation_id, operation_type, en_camino_at, llego_at, estimated_minutes, assigned_user_name, llego_user_name")
      .in("reservation_id", reservation_ids);

    if (error) {
      console.error("[en-camino-tracking/status] Error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Build a map: key = "reservation_id:operation_type"
    const statuses: Record<string, {
      en_camino_at: string;
      llego_at: string | null;
      real_minutes: number | null;
      estimated_minutes: number | null;
      started_by: string | null;
      arrived_by: string | null;
    }> = {};

    for (const row of data || []) {
      const key = `${row.reservation_id}:${row.operation_type}`;
      let realMinutes: number | null = null;
      if (row.llego_at && row.en_camino_at) {
        realMinutes = Math.round(
          (new Date(row.llego_at).getTime() - new Date(row.en_camino_at).getTime()) / 60000
        );
      }
      statuses[key] = {
        en_camino_at: row.en_camino_at,
        llego_at: row.llego_at,
        real_minutes: realMinutes,
        estimated_minutes: row.estimated_minutes ?? null,
        started_by: row.assigned_user_name || null,
        arrived_by: row.llego_user_name || null,
      };
    }

    return res.json({ ok: true, statuses });
  } catch (err) {
    console.error("[en-camino-tracking/status] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/en-camino-tracking/summary
 * Get daily punctuality summary.
 * Body: { date: 'YYYY-MM-DD' }
 * Returns stats: total arrivals, on-time count, late count, avg difference
 */
export async function handleEnCaminoSummary(req: Request, res: Response) {
  try {
    const { date } = req.body as { date?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];

    const sb = getServiceClient();
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data, error } = await sb
      .from("en_camino_tracking")
      .select("reservation_id, operation_type, en_camino_at, llego_at, estimated_minutes")
      .gte("en_camino_at", startOfDay)
      .lte("en_camino_at", endOfDay)
      .not("llego_at", "is", null);

    if (error) {
      console.error("[en-camino-tracking/summary] Error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    const arrivals = data || [];
    const totalArrivals = arrivals.length;
    let onTime = 0;
    let late = 0;
    let totalDiffMinutes = 0;
    let withEstimate = 0;

    for (const row of arrivals) {
      if (!row.en_camino_at || !row.llego_at) continue;
      const realMinutes = Math.round(
        (new Date(row.llego_at).getTime() - new Date(row.en_camino_at).getTime()) / 60000
      );
      const estimated = row.estimated_minutes;
      if (estimated != null && estimated > 0) {
        withEstimate++;
        const diff = realMinutes - estimated;
        totalDiffMinutes += diff;
        if (diff <= 5) {
          onTime++;
        } else {
          late++;
        }
      }
    }

    const avgDiff = withEstimate > 0 ? Math.round(totalDiffMinutes / withEstimate) : 0;
    const onTimePercent = withEstimate > 0 ? Math.round((onTime / withEstimate) * 100) : 0;

    return res.json({
      ok: true,
      summary: {
        date: targetDate,
        total_arrivals: totalArrivals,
        with_estimate: withEstimate,
        on_time: onTime,
        late: late,
        on_time_percent: onTimePercent,
        avg_diff_minutes: avgDiff,
      },
    });
  } catch (err) {
    console.error("[en-camino-tracking/summary] Error:", err);
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

/**
 * POST /api/en-camino-tracking/history
 * Get detailed daily travel history for the report.
 * Body: { date: 'YYYY-MM-DD' }
 * Returns all trips for the day with user attribution and time comparison.
 */
export async function handleEnCaminoHistory(req: Request, res: Response) {
  try {
    const { date } = req.body as { date?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];

    const sb = getServiceClient();
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data, error } = await sb
      .from("en_camino_tracking")
      .select("id, reservation_id, operation_type, en_camino_at, llego_at, estimated_minutes, destination_address, assigned_user_name, llego_user_name")
      .gte("en_camino_at", startOfDay)
      .lte("en_camino_at", endOfDay)
      .order("en_camino_at", { ascending: true });

    if (error) {
      console.error("[en-camino-tracking/history] Error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    const trips = (data || []).map((row) => {
      const realMinutes = row.llego_at && row.en_camino_at
        ? Math.round((new Date(row.llego_at).getTime() - new Date(row.en_camino_at).getTime()) / 60000)
        : null;
      const diff = realMinutes != null && row.estimated_minutes != null && row.estimated_minutes > 0
        ? realMinutes - row.estimated_minutes
        : null;
      const status: 'on_time' | 'late' | 'very_late' | 'en_route' =
        row.llego_at == null ? 'en_route' :
        diff == null ? 'on_time' :
        diff <= 5 ? 'on_time' :
        diff <= 15 ? 'late' : 'very_late';

      return {
        id: row.id,
        reservation_id: row.reservation_id,
        operation_type: row.operation_type,
        destination_address: row.destination_address,
        started_by: row.assigned_user_name,
        arrived_by: row.llego_user_name,
        en_camino_at: row.en_camino_at,
        llego_at: row.llego_at,
        estimated_minutes: row.estimated_minutes,
        real_minutes: realMinutes,
        diff_minutes: diff,
        status,
      };
    });

    // Per-user stats
    const userStats: Record<string, { trips: number; totalReal: number; totalEstimated: number; onTime: number; late: number }> = {};
    for (const trip of trips) {
      const userName = trip.started_by || 'Sin asignar';
      if (!userStats[userName]) {
        userStats[userName] = { trips: 0, totalReal: 0, totalEstimated: 0, onTime: 0, late: 0 };
      }
      userStats[userName].trips++;
      if (trip.real_minutes != null) {
        userStats[userName].totalReal += trip.real_minutes;
      }
      if (trip.estimated_minutes != null) {
        userStats[userName].totalEstimated += trip.estimated_minutes;
      }
      if (trip.status === 'on_time') userStats[userName].onTime++;
      if (trip.status === 'late' || trip.status === 'very_late') userStats[userName].late++;
    }

    const userSummary = Object.entries(userStats).map(([name, stats]) => ({
      name,
      trips: stats.trips,
      avg_real_minutes: stats.trips > 0 ? Math.round(stats.totalReal / stats.trips) : 0,
      avg_estimated_minutes: stats.trips > 0 ? Math.round(stats.totalEstimated / stats.trips) : 0,
      on_time: stats.onTime,
      late: stats.late,
      on_time_percent: stats.trips > 0 ? Math.round((stats.onTime / stats.trips) * 100) : 0,
    }));

    return res.json({
      ok: true,
      date: targetDate,
      trips,
      user_summary: userSummary,
      totals: {
        total_trips: trips.length,
        completed: trips.filter(t => t.status !== 'en_route').length,
        en_route: trips.filter(t => t.status === 'en_route').length,
        on_time: trips.filter(t => t.status === 'on_time').length,
        late: trips.filter(t => t.status === 'late' || t.status === 'very_late').length,
      },
    });
  } catch (err) {
    console.error("[en-camino-tracking/history] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/en-camino-tracking/location
 * Update the current GPS location of a rental during an active En Camino operation.
 * Body: { reservation_id, operation_type, lat, lng }
 * Called every ~15 seconds by the rental's browser while sharing location.
 */
export async function handleEnCaminoLocation(req: Request, res: Response) {
  try {
    const { reservation_id, operation_type, lat, lng } = req.body as {
      reservation_id?: string;
      operation_type?: string;
      lat?: number;
      lng?: number;
    };

    if (!reservation_id || !operation_type) {
      return res.status(400).json({ ok: false, error: "reservation_id and operation_type required" });
    }

    if (lat == null || lng == null || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ ok: false, error: "lat and lng are required as numbers" });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "Invalid coordinates" });
    }

    const sb = getServiceClient();

    const { data, error } = await sb
      .from("en_camino_tracking")
      .update({
        current_lat: lat,
        current_lng: lng,
        location_updated_at: new Date().toISOString(),
        sharing_location: true,
      })
      .eq("reservation_id", reservation_id)
      .eq("operation_type", operation_type)
      .is("llego_at", null) // Only update active (non-completed) operations
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[en-camino-tracking/location] Update error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "No active en_camino record found" });
    }

    // Also record this position in location_history for route replay
    try {
      await sb.from("location_history").insert({
        tracking_id: data.id,
        reservation_id,
        operation_type,
        latitude: lat,
        longitude: lng,
        accuracy: (req.body as any).accuracy ?? null,
        recorded_at: new Date().toISOString(),
      });
    } catch (histErr) {
      // Non-critical: don't fail the location update if history insert fails
      console.warn("[en-camino-tracking/location] History insert error:", histErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[en-camino-tracking/location] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

/**
 * POST /api/en-camino-tracking/location-history
 * Get the location history for a specific tracking operation.
 * Body: { reservation_id, operation_type } or { tracking_id }
 * Returns an ordered array of positions for route replay.
 */
export async function handleEnCaminoLocationHistory(req: Request, res: Response) {
  try {
    const { reservation_id, operation_type, tracking_id } = req.body as {
      reservation_id?: string;
      operation_type?: string;
      tracking_id?: string;
    };

    const sb = getServiceClient();

    let query = sb
      .from("location_history")
      .select("id, latitude, longitude, accuracy, recorded_at")
      .order("recorded_at", { ascending: true });

    if (tracking_id) {
      query = query.eq("tracking_id", tracking_id);
    } else if (reservation_id && operation_type) {
      query = query
        .eq("reservation_id", reservation_id)
        .eq("operation_type", operation_type);
    } else {
      return res.status(400).json({ ok: false, error: "tracking_id or (reservation_id + operation_type) required" });
    }

    const { data, error } = await query;

    if (error) {
      console.error("[en-camino-tracking/location-history] Error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({
      ok: true,
      positions: (data || []).map((p: any) => ({
        lat: p.latitude,
        lng: p.longitude,
        accuracy: p.accuracy,
        time: p.recorded_at,
      })),
    });
  } catch (err) {
    console.error("[en-camino-tracking/location-history] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

export async function handleEnCaminoLocationStop(req: Request, res: Response) {
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
      .update({
        sharing_location: false,
        current_lat: null,
        current_lng: null,
        location_updated_at: null,
      })
      .eq("reservation_id", reservation_id)
      .eq("operation_type", operation_type);

    if (error) {
      console.error("[en-camino-tracking/location-stop] Error:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[en-camino-tracking/location-stop] Error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
