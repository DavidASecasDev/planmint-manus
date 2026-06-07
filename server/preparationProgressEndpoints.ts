import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

/**
 * GET /api/get-preparation-progress
 * Returns active preparations with their task progress for admin/owner view
 * Shows vehicles that are in the preparation_list with status=pending AND have inicio_prep marked
 */
async function handleGetPreparationProgress(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.view_progress
    const { allowed: canViewProgress } = await checkUserPermission(sb, organizationId, userId, "preparation.view_progress");
    if (!canViewProgress) return res.status(403).json({ ok: false, error: "No permission to view preparation progress" });

    // Get all pending preparation items
    const { data: prepItems, error: prepError } = await sb
      .from("preparation_list")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("deadline_at", { ascending: true });

    if (prepError) {
      console.error("[get-preparation-progress] Error fetching prep list:", prepError.message);
      return res.status(500).json({ ok: false, error: prepError.message });
    }

    if (!prepItems || prepItems.length === 0) {
      return res.json({ ok: true, data: [] });
    }

    // Get the vehicle IDs for these matriculas
    const matriculas = prepItems.map((item: any) => item.matricula);
    const { data: vehicles, error: vehiclesError } = await sb
      .from("vehicles")
      .select("id, matricula, modelo, status")
      .eq("organization_id", organizationId)
      .in("matricula", matriculas);

    if (vehiclesError) {
      console.error("[get-preparation-progress] Error fetching vehicles:", vehiclesError.message);
      return res.status(500).json({ ok: false, error: vehiclesError.message });
    }

    // Get cleaning tasks for these vehicles
    const vehicleIds = (vehicles || []).map((v: any) => v.id);
    let tasksData: any[] = [];
    if (vehicleIds.length > 0) {
      const { data: tasks, error: tasksError } = await sb
        .from("vehicle_cleaning_tasks")
        .select(`
          *,
          completed_by_profile:profiles!vehicle_cleaning_tasks_completed_by_fkey(name)
        `)
        .in("vehicle_id", vehicleIds);

      if (tasksError) {
        console.error("[get-preparation-progress] Error fetching tasks:", tasksError.message);
      } else {
        tasksData = tasks || [];
      }
    }

    // Build a map of vehicle_id -> tasks
    const vehicleTasksMap: Record<string, any[]> = {};
    for (const task of tasksData) {
      if (!vehicleTasksMap[task.vehicle_id]) {
        vehicleTasksMap[task.vehicle_id] = [];
      }
      vehicleTasksMap[task.vehicle_id].push(task);
    }

    // Build a map of matricula -> vehicle
    const vehicleByMatricula: Record<string, any> = {};
    for (const v of (vehicles || [])) {
      vehicleByMatricula[v.matricula] = v;
    }

    // Combine preparation items with their task progress
    const progressData = prepItems.map((item: any) => {
      const vehicle = vehicleByMatricula[item.matricula];
      const vehicleTasks = vehicle ? (vehicleTasksMap[vehicle.id] || []) : [];

      // Find the inicio_prep task to determine start time
      const inicioTask = vehicleTasks.find((t: any) => t.task_key === "inicio_prep" && t.completed);
      const startedAt = inicioTask?.completed_at || null;
      const startedBy = inicioTask?.completed_by_profile?.name || null;

      // Count completed tasks (excluding inicio_prep from the count)
      const actionTasks = vehicleTasks.filter((t: any) => t.task_key !== "inicio_prep");
      const totalTasks = actionTasks.length;
      const completedTasks = actionTasks.filter((t: any) => t.completed).length;

      return {
        id: item.id,
        matricula: item.matricula,
        modelo: item.modelo,
        deadline_at: item.deadline_at,
        notes: item.notes,
        created_at: item.created_at,
        started_at: startedAt,
        started_by: startedBy,
        vehicle_id: vehicle?.id || null,
        vehicle_status: vehicle?.status || null,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        tasks: vehicleTasks.map((t: any) => ({
          task_key: t.task_key,
          completed: t.completed || false,
          completed_at: t.completed_at,
          completed_by: t.completed_by_profile?.name || null,
        })),
      };
    });

    return res.json({ ok: true, data: progressData });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[get-preparation-progress] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

/**
 * POST /api/start-preparation
 * Mark a vehicle's preparation as started (marks inicio_prep task as completed)
 */
async function handleStartPreparation(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) return res.status(400).json({ ok: false, error: "No organization" });

    const sb = getServiceClient();

    // Permission check: preparation.start
    const { allowed: canStart } = await checkUserPermission(sb, organizationId, userId, "preparation.start");
    if (!canStart) return res.status(403).json({ ok: false, error: "No permission to start preparation" });

    const { matricula } = req.body;
    if (!matricula) return res.status(400).json({ ok: false, error: "Missing matricula" });

    // Find the vehicle - try without is_archived filter first (some vehicles may have null)
    const upperMatricula = matricula.toUpperCase().trim();
    let vehicle: { id: string } | null = null;

    // First try vehicles table (any non-archived)
    const { data: v1 } = await sb
      .from("vehicles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("matricula", upperMatricula)
      .maybeSingle();

    if (v1) {
      vehicle = v1;
    } else {
      // Fallback: try fleet_vehicles
      const { data: fv } = await sb
        .from("fleet_vehicles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("matricula", upperMatricula)
        .maybeSingle();
      if (fv) {
        vehicle = fv;
      }
    }

    if (!vehicle) {
      return res.status(404).json({ ok: false, error: "Vehicle not found" });
    }

    // Check if inicio_prep task exists
    const { data: existingTask } = await sb
      .from("vehicle_cleaning_tasks")
      .select("id, completed")
      .eq("vehicle_id", vehicle.id)
      .eq("task_key", "inicio_prep")
      .maybeSingle();

    if (existingTask?.completed) {
      return res.status(400).json({ ok: false, error: "La preparación ya fue iniciada" });
    }

    const now = new Date().toISOString();

    if (existingTask) {
      // Update existing task
      const { error: updateError } = await sb
        .from("vehicle_cleaning_tasks")
        .update({
          completed: true,
          completed_at: now,
          completed_by: userId,
        })
        .eq("id", existingTask.id);

      if (updateError) {
        console.error("[start-preparation] Update error:", updateError.message);
        return res.status(500).json({ ok: false, error: updateError.message });
      }
    } else {
      // Insert new task
      const { error: insertError } = await sb
        .from("vehicle_cleaning_tasks")
        .insert({
          vehicle_id: vehicle.id,
          task_key: "inicio_prep",
          completed: true,
          completed_at: now,
          completed_by: userId,
        });

      if (insertError) {
        console.error("[start-preparation] Insert error:", insertError.message);
        return res.status(500).json({ ok: false, error: insertError.message });
      }
    }

    return res.json({ ok: true, started_at: now });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error("[start-preparation] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}

export {
  handleGetPreparationProgress,
  handleStartPreparation,
};
