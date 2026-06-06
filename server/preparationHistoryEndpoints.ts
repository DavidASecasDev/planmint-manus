import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import { authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

/**
 * POST /api/get-preparation-history
 * Returns completed preparations with timing data and performance metrics.
 * Supports filtering by date range.
 */
async function handleGetPreparationHistory(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });
    const sb = getServiceClient();

    // Permission check: preparation.view_progress
    const { allowed: canView } = await checkUserPermission(sb, organizationId, userId, "preparation.view_progress");
    if (!canView) return res.status(403).json({ ok: false, error: "No permission to view preparation history" });

    const { period = "month", page = 1, limit = 50 } = req.body;

    // Calculate date range based on period
    const now = new Date();
    let fromDate: Date;
    switch (period) {
      case "week":
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        fromDate = new Date(0);
        break;
      default:
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get completed preparation items
    const offset = (page - 1) * limit;
    const { data: completedItems, error: itemsError, count } = await sb
      .from("preparation_list")
      .select("*, completed_by_profile:profiles!preparation_list_completed_by_fkey(name)", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("status", "ready")
      .gte("completed_at", fromDate.toISOString())
      .order("completed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error("[get-preparation-history] Error:", itemsError.message);
      return res.status(500).json({ ok: false, error: itemsError.message });
    }

    // Get vehicles for these matriculas to find their cleaning task history
    const matriculas = (completedItems || []).map((item: any) => item.matricula);
    let vehicleTaskHistory: any[] = [];

    if (matriculas.length > 0) {
      // Get vehicles
      const { data: vehicles } = await sb
        .from("vehicles")
        .select("id, matricula")
        .eq("organization_id", organizationId)
        .in("matricula", matriculas);

      if (vehicles && vehicles.length > 0) {
        const vehicleIds = vehicles.map((v: any) => v.id);

        // Get cleaning tasks for these vehicles (to calculate prep time)
        const { data: tasks } = await sb
          .from("vehicle_cleaning_tasks")
          .select(`
            vehicle_id,
            task_key,
            completed,
            completed_at,
            completed_by,
            completed_by_profile:profiles!vehicle_cleaning_tasks_completed_by_fkey(name)
          `)
          .in("vehicle_id", vehicleIds);

        vehicleTaskHistory = tasks || [];
      }
    }

    // Build vehicle task map
    const vehicleTaskMap: Record<string, any[]> = {};
    for (const task of vehicleTaskHistory) {
      if (!vehicleTaskMap[task.vehicle_id]) vehicleTaskMap[task.vehicle_id] = [];
      vehicleTaskMap[task.vehicle_id].push(task);
    }

    // Enrich completed items with timing data
    const enrichedItems = (completedItems || []).map((item: any) => {
      // Calculate preparation duration (from created_at or first task to completed_at)
      const createdAt = new Date(item.created_at).getTime();
      const completedAt = new Date(item.completed_at).getTime();
      const durationMinutes = Math.round((completedAt - createdAt) / 60000);

      return {
        id: item.id,
        matricula: item.matricula,
        modelo: item.modelo,
        deadline_at: item.deadline_at,
        notes: item.notes,
        created_at: item.created_at,
        completed_at: item.completed_at,
        completed_by_name: item.completed_by_profile?.name || "Desconocido",
        duration_minutes: durationMinutes > 0 ? durationMinutes : null,
        met_deadline: item.deadline_at ? completedAt <= new Date(item.deadline_at).getTime() : null,
      };
    });

    // Calculate performance metrics
    const allDurations = enrichedItems
      .filter((item: any) => item.duration_minutes !== null && item.duration_minutes > 0 && item.duration_minutes < 1440) // Exclude > 24h as outliers
      .map((item: any) => item.duration_minutes);

    const avgDuration = allDurations.length > 0
      ? Math.round(allDurations.reduce((a: number, b: number) => a + b, 0) / allDurations.length)
      : null;

    const minDuration = allDurations.length > 0 ? Math.min(...allDurations) : null;
    const maxDuration = allDurations.length > 0 ? Math.max(...allDurations) : null;

    // Deadline compliance rate
    const withDeadline = enrichedItems.filter((item: any) => item.met_deadline !== null);
    const metDeadlineCount = withDeadline.filter((item: any) => item.met_deadline).length;
    const deadlineComplianceRate = withDeadline.length > 0
      ? Math.round((metDeadlineCount / withDeadline.length) * 100)
      : null;

    // Performance by preparer (who completed the most)
    const preparerStats: Record<string, { name: string; count: number; totalDuration: number; durations: number[] }> = {};
    for (const item of enrichedItems) {
      const name = item.completed_by_name;
      if (!preparerStats[name]) {
        preparerStats[name] = { name, count: 0, totalDuration: 0, durations: [] };
      }
      preparerStats[name].count++;
      if (item.duration_minutes && item.duration_minutes > 0 && item.duration_minutes < 1440) {
        preparerStats[name].totalDuration += item.duration_minutes;
        preparerStats[name].durations.push(item.duration_minutes);
      }
    }

    const preparerRanking = Object.values(preparerStats)
      .map((stat) => ({
        name: stat.name,
        completed_count: stat.count,
        avg_duration_minutes: stat.durations.length > 0
          ? Math.round(stat.totalDuration / stat.durations.length)
          : null,
      }))
      .sort((a, b) => b.completed_count - a.completed_count);

    // Daily completion trend (last 7 days for week, last 30 for month, etc.)
    const trendDays = period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 30;
    const dailyTrend: { date: string; count: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split("T")[0];
      const count = enrichedItems.filter((item: any) => {
        const itemDay = item.completed_at?.split("T")[0];
        return itemDay === dayStr;
      }).length;
      dailyTrend.push({ date: dayStr, count });
    }

    return res.json({
      ok: true,
      data: {
        items: enrichedItems,
        total: count || 0,
        page,
        limit,
        metrics: {
          total_completed: count || 0,
          avg_duration_minutes: avgDuration,
          min_duration_minutes: minDuration,
          max_duration_minutes: maxDuration,
          deadline_compliance_rate: deadlineComplianceRate,
          preparer_ranking: preparerRanking,
          daily_trend: dailyTrend,
        },
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[get-preparation-history] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

export { handleGetPreparationHistory };
