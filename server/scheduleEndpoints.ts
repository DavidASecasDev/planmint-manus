/**
 * Schedule Endpoints — Staff shift scheduling module.
 * Manages shift templates and daily staff schedule assignments.
 * Integrates with teams and reservations for workload visibility.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

// ─── Shift Templates ────────────────────────────────────────────────────────

/** GET shift templates for the org */
export async function handleGetShiftTemplates(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.view
    const { allowed: canView } = await checkUserPermission(sb, orgId, userId, "schedules.view");
    if (!canView) return res.status(403).json({ ok: false, error: "No permission to view schedules" });

    const { data, error } = await sb
      .from("shift_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[get-shift-templates]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Create a new shift template */
export async function handleCreateShiftTemplate(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_templates or schedules.manage
    const { allowed: canManageTemplates } = await checkUserPermission(sb, orgId, userId, "schedules.manage_templates");
    if (!canManageTemplates) return res.status(403).json({ ok: false, error: "No permission to manage shift templates" });

    const { name, start_time, end_time, color, is_day_off } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Name is required" });

    // Get max sort_order
    const { data: existing } = await sb
      .from("shift_templates")
      .select("sort_order")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const { data, error } = await sb
      .from("shift_templates")
      .insert({
        organization_id: orgId,
        name,
        start_time: is_day_off ? null : start_time,
        end_time: is_day_off ? null : end_time,
        color: color || "#3B82F6",
        is_day_off: is_day_off || false,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[create-shift-template]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Update a shift template */
export async function handleUpdateShiftTemplate(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_templates or schedules.manage
    const { allowed: canManageTemplates } = await checkUserPermission(sb, orgId, userId, "schedules.manage_templates");
    if (!canManageTemplates) return res.status(403).json({ ok: false, error: "No permission to manage shift templates" });

    const { template_id, name, start_time, end_time, color, is_day_off } = req.body;
    if (!template_id) return res.status(400).json({ ok: false, error: "template_id is required" });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (is_day_off !== undefined) {
      updates.is_day_off = is_day_off;
      if (is_day_off) {
        updates.start_time = null;
        updates.end_time = null;
      }
    }
    if (start_time !== undefined && !updates.is_day_off) updates.start_time = start_time;
    if (end_time !== undefined && !updates.is_day_off) updates.end_time = end_time;

    const { data, error } = await sb
      .from("shift_templates")
      .update(updates)
      .eq("id", template_id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) throw error;
    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[update-shift-template]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Delete a shift template */
export async function handleDeleteShiftTemplate(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_templates or schedules.manage
    const { allowed: canManageTemplates } = await checkUserPermission(sb, orgId, userId, "schedules.manage_templates");
    if (!canManageTemplates) return res.status(403).json({ ok: false, error: "No permission to manage shift templates" });

    const { template_id } = req.body;
    if (!template_id) return res.status(400).json({ ok: false, error: "template_id is required" });

    const { error } = await sb
      .from("shift_templates")
      .delete()
      .eq("id", template_id)
      .eq("organization_id", orgId);

    if (error) throw error;
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[delete-shift-template]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Staff Schedules ────────────────────────────────────────────────────────

/** Get weekly schedule for the org (date range) */
export async function handleGetWeeklySchedule(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.view
    const { allowed: canView } = await checkUserPermission(sb, orgId, userId, "schedules.view");
    if (!canView) return res.status(403).json({ ok: false, error: "No permission to view schedules" });

    const { start_date, end_date } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ ok: false, error: "start_date and end_date are required" });
    }

    // Get schedules for the date range
    const { data: schedules, error: schedError } = await sb
      .from("staff_schedules")
      .select(`
        id,
        user_id,
        date,
        shift_template_id,
        team_id,
        notes,
        created_by,
        created_at
      `)
      .eq("organization_id", orgId)
      .gte("date", start_date)
      .lte("date", end_date);

    if (schedError) throw schedError;

    // Get team members with their profiles and teams
    const { data: teamMembers, error: tmError } = await sb
      .from("team_members")
      .select(`
        user_id,
        team_id,
        sort_order,
        teams!inner(id, name, color, organization_id)
      `)
      .eq("teams.organization_id", orgId)
      .order("sort_order", { ascending: true });

    if (tmError) throw tmError;

    // Fetch per-week member order overrides
    const { data: weeklyOrder } = await sb
      .from("schedule_member_order")
      .select("team_id, user_id, sort_order")
      .eq("organization_id", orgId)
      .eq("week_start", start_date);

    // Merge weekly order into teamMembers: if a per-week order exists, override sort_order
    if (weeklyOrder && weeklyOrder.length > 0) {
      const orderMap = new Map<string, number>();
      for (const wo of weeklyOrder) {
        orderMap.set(`${wo.team_id}:${wo.user_id}`, wo.sort_order);
      }
      for (const tm of (teamMembers || []) as any[]) {
        const key = `${tm.team_id}:${tm.user_id}`;
        if (orderMap.has(key)) {
          tm.sort_order = orderMap.get(key)!;
        }
      }
    }

    // Get profiles for all team members
    const memberUserIds = Array.from(new Set((teamMembers || []).map((tm: any) => tm.user_id)));
    const { data: profiles, error: profError } = await sb
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", memberUserIds.length > 0 ? memberUserIds : ["__none__"]);

    if (profError) throw profError;

    // Get reservation counts for the date range (entregas + devoluciones)
    // Bug fix #14: Use correct filter — fetch reservations where desde OR hasta falls within range
    // Bug fix #13: Include confirmed datetime fields for accurate day assignment
    const { data: reservations, error: resError } = await sb
      .from("reservations")
      .select("desde, hasta, tipo_actividad, estado, entrega_completada, devolucion_completada, transfer_completado, confirmed_entrega_datetime, confirmed_devolucion_datetime")
      .eq("organization_id", orgId)
      .or(`and(desde.gte.${start_date},desde.lte.${end_date}T23:59:59),and(hasta.gte.${start_date},hasta.lte.${end_date}T23:59:59),and(confirmed_entrega_datetime.gte.${start_date},confirmed_entrega_datetime.lte.${end_date}T23:59:59),and(confirmed_devolucion_datetime.gte.${start_date},confirmed_devolucion_datetime.lte.${end_date}T23:59:59)`);

    if (resError) throw resError;

    // Count entregas and devoluciones per day
    // Use confirmed datetime with fallback to original desde/hasta
    const dailyCounts: Record<string, { entregas: number; devoluciones: number; transfers: number }> = {};
    (reservations || []).forEach((r: any) => {
      // Skip cancelled
      if (r.estado === "Cancelada") return;

      // Determine effective dates using confirmed datetime with fallback
      const entregaDate = r.confirmed_entrega_datetime || r.desde;
      const devolucionDate = r.confirmed_devolucion_datetime || r.hasta;

      if (r.tipo_actividad === "Transfer" && entregaDate) {
        const day = entregaDate.substring(0, 10);
        if (day >= start_date && day <= end_date) {
          if (!dailyCounts[day]) dailyCounts[day] = { entregas: 0, devoluciones: 0, transfers: 0 };
          dailyCounts[day].transfers++;
        }
      } else {
        // Entrega
        if (entregaDate) {
          const day = entregaDate.substring(0, 10);
          if (day >= start_date && day <= end_date) {
            if (!dailyCounts[day]) dailyCounts[day] = { entregas: 0, devoluciones: 0, transfers: 0 };
            dailyCounts[day].entregas++;
          }
        }
        // Devolución
        if (devolucionDate) {
          const day = devolucionDate.substring(0, 10);
          if (day >= start_date && day <= end_date) {
            if (!dailyCounts[day]) dailyCounts[day] = { entregas: 0, devoluciones: 0, transfers: 0 };
            dailyCounts[day].devoluciones++;
          }
        }
      }
    });

    return res.json({
      ok: true,
      data: {
        schedules: schedules || [],
        teamMembers: teamMembers || [],
        profiles: profiles || [],
        dailyCounts,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[get-weekly-schedule] Error:", err?.message || err, "| Code:", err?.code, "| Details:", err?.details);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/** Upsert a schedule entry (assign or update shift for a user on a date) */
export async function handleUpsertSchedule(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.assign or schedules.manage
    const { allowed: canAssign } = await checkUserPermission(sb, orgId, userId, "schedules.assign");
    if (!canAssign) return res.status(403).json({ ok: false, error: "No permission to assign shifts" });

    const { user_id, date, shift_template_id, team_id, notes } = req.body;
    if (!user_id || !date) {
      return res.status(400).json({ ok: false, error: "user_id and date are required" });
    }

    // If shift_template_id is null, delete the schedule entry (clear the cell)
    if (!shift_template_id) {
      const { error } = await sb
        .from("staff_schedules")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", user_id)
        .eq("date", date);

      if (error) throw error;
      return res.json({ ok: true, data: null });
    }

    // Upsert the schedule
    const { data, error } = await sb
      .from("staff_schedules")
      .upsert(
        {
          organization_id: orgId,
          user_id,
          date,
          shift_template_id,
          team_id: team_id || null,
          notes: notes || null,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,date" }
      )
      .select()
      .single();

    if (error) throw error;
    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[upsert-schedule]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Bulk upsert schedules (for copying a week, etc.) */
export async function handleBulkUpsertSchedules(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage (bulk operations require full manage permission)
    const { allowed: canManage } = await checkUserPermission(sb, orgId, userId, "schedules.manage");
    if (!canManage) return res.status(403).json({ ok: false, error: "No permission to manage schedules (bulk operations)" });

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, error: "entries array is required" });
    }

    const records = entries.map((e: any) => ({
      organization_id: orgId,
      user_id: e.user_id,
      date: e.date,
      shift_template_id: e.shift_template_id,
      team_id: e.team_id || null,
      notes: e.notes || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await sb
      .from("staff_schedules")
      .upsert(records, { onConflict: "organization_id,user_id,date" })
      .select();

    if (error) throw error;
    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[bulk-upsert-schedules]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Get staff available on a specific date (for AssigneeSelect integration) */
export async function handleGetAvailableStaff(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const { date } = req.body;
    if (!date) return res.status(400).json({ ok: false, error: "date is required" });

    const sb = getServiceClient();

    // No specific permission needed — this is used by AssigneeSelect which is already gated by the parent module

    // Get all schedules for this date
    const { data: schedules, error: schedError } = await sb
      .from("staff_schedules")
      .select(`
        user_id,
        shift_template_id,
        shift_templates!inner(id, name, start_time, end_time, is_day_off)
      `)
      .eq("organization_id", orgId)
      .eq("date", date);

    if (schedError) throw schedError;

    // Build availability map: user_id -> { available, shift_name, start_time, end_time }
    // A user may have multiple schedule entries (one per team). We collect all shifts
    // and pick the one that is currently active, or the earliest upcoming one.
    const userShifts: Record<string, Array<{ available: boolean; shift_name: string; start_time: string | null; end_time: string | null }>> = {};
    (schedules || []).forEach((s: any) => {
      const template = s.shift_templates;
      if (!userShifts[s.user_id]) userShifts[s.user_id] = [];
      userShifts[s.user_id].push({
        available: !template.is_day_off,
        shift_name: template.name,
        start_time: template.start_time,
        end_time: template.end_time,
      });
    });

    // Helper: convert HH:MM to minutes since midnight
    const toMinutes = (t: string | null): number => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const availability: Record<string, { available: boolean; shift_name: string; start_time: string | null; end_time: string | null }> = {};
    for (const [uid, shifts] of Object.entries(userShifts)) {
      if (shifts.length === 1) {
        availability[uid] = shifts[0];
        continue;
      }

      // If any shift is a day-off and another is working, prefer the working one
      const workingShifts = shifts.filter(s => s.available);
      const dayOffShifts = shifts.filter(s => !s.available);

      if (workingShifts.length === 0) {
        // All are day-off
        availability[uid] = dayOffShifts[0];
        continue;
      }

      // Among working shifts, find the one currently active
      const activeShift = workingShifts.find(s => {
        if (!s.start_time || !s.end_time) return false;
        const startMin = toMinutes(s.start_time);
        const endMin = toMinutes(s.end_time);
        // Handle overnight shifts
        if (endMin <= startMin) {
          return currentMinutes >= startMin || currentMinutes <= endMin;
        }
        return currentMinutes >= startMin && currentMinutes <= endMin;
      });

      if (activeShift) {
        availability[uid] = activeShift;
      } else {
        // No active shift right now — pick the earliest start_time shift (the one for today)
        // Sort by start_time and pick the first one
        workingShifts.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
        availability[uid] = workingShifts[0];
      }
    }

    return res.json({ ok: true, data: availability });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[get-available-staff]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}


/**
 * POST /api/reorder-team-members
 * Reorder members within a team by updating their sort_order.
 * Body: { team_id: string, ordered_user_ids: string[] }
 */
// ─── Schedule Notes ─────────────────────────────────────────────────────────

/** Get schedule notes for a date range */
export async function handleGetScheduleNotes(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_notes
    const { allowed: canNotes } = await checkUserPermission(sb, orgId, userId, "schedules.manage_notes");
    if (!canNotes) return res.status(403).json({ ok: false, error: "No permission to view schedule notes" });

    const { start_date, end_date } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ ok: false, error: "start_date and end_date are required" });
    }

    const { data, error } = await sb
      .from("schedule_notes")
      .select(`
        id,
        user_id,
        date,
        content,
        created_by,
        updated_by,
        created_at,
        updated_at
      `)
      .eq("organization_id", orgId)
      .gte("date", start_date)
      .lte("date", end_date)
      .order("date", { ascending: true });

    if (error) throw error;

    // Enrich with profile names
    const userIds = Array.from(new Set(
      (data || []).flatMap(n => [n.created_by, n.updated_by].filter(Boolean))
    ));
    let profiles: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (profs) {
        profiles = Object.fromEntries(profs.map(p => [p.id, p.name]));
      }
    }

    const enriched = (data || []).map(n => ({
      ...n,
      created_by_name: profiles[n.created_by] || null,
      updated_by_name: profiles[n.updated_by] || null,
    }));

    return res.json({ ok: true, data: enriched });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[get-schedule-notes]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Upsert a schedule note (one per org+date) */
export async function handleUpsertScheduleNote(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_notes
    const { allowed: canNotes } = await checkUserPermission(sb, orgId, userId, "schedules.manage_notes");
    if (!canNotes) return res.status(403).json({ ok: false, error: "No permission to manage schedule notes" });

     const { date, content, user_id: targetUserId } = req.body;
    if (!date) return res.status(400).json({ ok: false, error: "date is required" });
    if (!targetUserId) return res.status(400).json({ ok: false, error: "user_id is required" });
    if (typeof content !== 'string') return res.status(400).json({ ok: false, error: "content is required" });
    // If content is empty, delete the note
    if (content.trim() === '') {
      // Get existing note for history before deleting
      const { data: existing } = await sb
        .from("schedule_notes")
        .select("id, content")
        .eq("organization_id", orgId)
        .eq("user_id", targetUserId)
        .eq("date", date)
        .maybeSingle();
      if (existing) {
        // Record deletion in history
        await sb.from("schedule_note_history").insert({
          note_id: existing.id,
          content: existing.content,
          action: 'deleted',
          changed_by: userId,
        });
      }
      const { error } = await sb
        .from("schedule_notes")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", targetUserId)
        .eq("date", date);
      if (error) throw error;
      return res.json({ ok: true, data: null });
    }
    // Check if note already exists (to determine created vs updated)
    const { data: existingNote } = await sb
      .from("schedule_notes")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId)
      .eq("date", date)
      .maybeSingle();
    const isUpdate = !!existingNote;
    const { data, error } = await sb
      .from("schedule_notes")
      .upsert(
        {
          organization_id: orgId,
          user_id: targetUserId,
          date,
          content: content.trim(),
          created_by: userId,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,date" }
      )
      .select()
      .single();

    if (error) throw error;

    // Record in history
    if (data) {
      await sb.from("schedule_note_history").insert({
        note_id: data.id,
        content: content.trim(),
        action: isUpdate ? 'updated' : 'created',
        changed_by: userId,
      });
    }

    return res.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[upsert-schedule-note]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/** Delete a schedule note */
export async function handleDeleteScheduleNote(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_notes
    const { allowed: canNotes } = await checkUserPermission(sb, orgId, userId, "schedules.manage_notes");
    if (!canNotes) return res.status(403).json({ ok: false, error: "No permission to manage schedule notes" });

    const { note_id } = req.body;
    if (!note_id) return res.status(400).json({ ok: false, error: "note_id is required" });

    // Get note data for history before deleting
    const { data: noteData } = await sb
      .from("schedule_notes")
      .select("id, date, content")
      .eq("id", note_id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (noteData) {
      // Record deletion in history
      await sb.from("schedule_note_history").insert({
        note_id: noteData.id,
        content: noteData.content,
        action: 'deleted',
        changed_by: userId,
      });
    }

    const { error } = await sb
      .from("schedule_notes")
      .delete()
      .eq("id", note_id)
      .eq("organization_id", orgId);

    if (error) throw error;
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[delete-schedule-note]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Schedule Note History ─────────────────────────────────────────────────────────────────────────────

/** Get history for a specific schedule note */
export async function handleGetScheduleNoteHistory(req: Request, res: Response) {
  try {
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission: schedules.manage_notes
    const { allowed: canNotes } = await checkUserPermission(sb, orgId, userId, "schedules.manage_notes");
    if (!canNotes) return res.status(403).json({ ok: false, error: "No permission to view schedule note history" });

    const { note_id } = req.body;
    if (!note_id) return res.status(400).json({ ok: false, error: "note_id is required" });

    const { data, error } = await sb
      .from("schedule_note_history")
      .select("id, note_id, content, action, changed_by, created_at")
      .eq("note_id", note_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Enrich with profile names
    const userIds = Array.from(new Set((data || []).map(h => h.changed_by).filter(Boolean)));
    let profiles: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      if (profs) {
        profiles = Object.fromEntries(profs.map(p => [p.id, p.name]));
      }
    }

    const enriched = (data || []).map(h => ({
      ...h,
      changed_by_name: profiles[h.changed_by] || null,
    }));

    return res.json({ ok: true, data: enriched });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[get-schedule-note-history]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Reorder Team Members ──────────────────────────────────────────────────────────────────────────────

export async function handleReorderTeamMembers(req: Request, res: Response) {
  try {
    const sb = getServiceClient();
    const { userId, organizationId: orgId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!orgId) return res.status(400).json({ ok: false, error: "No organization" });

    const { team_id, ordered_user_ids, week_start } = req.body;
    if (!team_id || !Array.isArray(ordered_user_ids) || ordered_user_ids.length === 0) {
      return res.status(400).json({ ok: false, error: "team_id and ordered_user_ids are required" });
    }
    if (!week_start) {
      return res.status(400).json({ ok: false, error: "week_start is required" });
    }

    // Verify the team belongs to the organization
    const { data: team, error: teamErr } = await sb
      .from("teams")
      .select("id")
      .eq("id", team_id)
      .eq("organization_id", orgId)
      .single();

    if (teamErr || !team) {
      return res.status(404).json({ ok: false, error: "Team not found" });
    }

    // Save per-week order in schedule_member_order table
    // Upsert all members for this team+week
    const upsertRows = ordered_user_ids.map((uid: string, index: number) => ({
      organization_id: orgId,
      team_id,
      week_start,
      user_id: uid,
      sort_order: index,
    }));

    const { error: upsertErr } = await sb
      .from("schedule_member_order")
      .upsert(upsertRows, { onConflict: "organization_id,team_id,week_start,user_id" });

    if (upsertErr) throw upsertErr;

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[reorder-team-members]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
