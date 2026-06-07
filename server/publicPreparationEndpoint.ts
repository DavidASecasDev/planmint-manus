import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";
import { AZUL_CARS_ORG_ID } from "../shared/const";

/**
 * Public Preparation List Endpoint
 *
 * GET /api/public/preparacion
 *
 * Returns the current preparation list for Azul Cars (pending items only).
 * Also returns the count of items completed today for motivation.
 * No authentication required. Minimal data exposed (matricula, modelo, deadline, notes, urgency).
 */

export async function handlePublicPreparation(req: Request, res: Response) {
  try {
    const sb = getServiceClient();

    // Get all pending items for Azul Cars, ordered by deadline (most urgent first)
    const { data, error } = await sb
      .from("preparation_list")
      .select("id, matricula, modelo, deadline_at, notes, status, created_at")
      .eq("organization_id", AZUL_CARS_ORG_ID)
      .eq("status", "pending")
      .order("deadline_at", { ascending: true });

    if (error) {
      console.error("[public-preparation] Error:", error.message);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Get count of items completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: completedToday, error: countError } = await sb
      .from("preparation_list")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", AZUL_CARS_ORG_ID)
      .eq("status", "done")
      .gte("updated_at", todayStart.toISOString());

    if (countError) {
      console.error("[public-preparation] Count error:", countError.message);
      // Non-critical, continue with 0
    }

    // Get vehicles for these matriculas to fetch task progress
    const matriculas = (data || []).map((item) => item.matricula);
    let vehicleTasksMap: Record<string, { total: number; completed: number }> = {};

    if (matriculas.length > 0) {
      const { data: vehicles } = await sb
        .from("vehicles")
        .select("id, matricula")
        .eq("organization_id", AZUL_CARS_ORG_ID)
        .in("matricula", matriculas);

      if (vehicles && vehicles.length > 0) {
        const vehicleIds = vehicles.map((v: any) => v.id);
        const { data: tasks } = await sb
          .from("vehicle_cleaning_tasks")
          .select("vehicle_id, task_key, completed")
          .in("vehicle_id", vehicleIds);

        if (tasks) {
          // Build map: matricula -> { total, completed } (excluding inicio_prep)
          const vehicleIdToMatricula: Record<string, string> = {};
          for (const v of vehicles) {
            vehicleIdToMatricula[v.id] = v.matricula;
          }
          for (const task of tasks) {
            if (task.task_key === "inicio_prep") continue;
            const mat = vehicleIdToMatricula[task.vehicle_id];
            if (!mat) continue;
            if (!vehicleTasksMap[mat]) vehicleTasksMap[mat] = { total: 0, completed: 0 };
            vehicleTasksMap[mat].total++;
            if (task.completed) vehicleTasksMap[mat].completed++;
          }
        }
      }
    }

    // Add urgency level and task progress to each item
    // Filter out vehicles that have ALL tasks completed (they are effectively "limpio")
    const now = Date.now();
    const allItems = (data || []).map((item) => {
      const diffMs = new Date(item.deadline_at).getTime() - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      let urgency: "critical" | "high" | "medium" | "low";
      if (diffHours < 0 || diffHours < 1) urgency = "critical";
      else if (diffHours < 4) urgency = "high";
      else if (diffHours < 12) urgency = "medium";
      else urgency = "low";

      const taskProgress = vehicleTasksMap[item.matricula] || null;

      return {
        id: item.id,
        matricula: item.matricula,
        modelo: item.modelo,
        deadline_at: item.deadline_at,
        notes: item.notes,
        urgency,
        total_tasks: taskProgress?.total ?? 0,
        completed_tasks: taskProgress?.completed ?? 0,
      };
    });

    // Exclude items where all tasks are completed (total > 0 && completed === total)
    const items = allItems.filter((item) => {
      if (item.total_tasks > 0 && item.completed_tasks >= item.total_tasks) {
        return false; // All tasks done = vehicle is clean, don't show as pending
      }
      return true;
    });

    // Count filtered-out items as effectively completed today too
    const autoCompletedCount = allItems.length - items.length;

    return res.json({
      ok: true,
      items,
      count: items.length,
      completed_today: (completedToday ?? 0) + autoCompletedCount,
    });
  } catch (err: any) {
    console.error("[public-preparation] Error:", err?.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
