/**
 * POST /api/toggle-cleaning-task
 * 
 * Toggles a vehicle cleaning task's completed status.
 * Uses the service role client to bypass RLS, fixing the bug where
 * expired Supabase sessions cause silent update failures.
 * 
 * Body: { taskId: string, completed: boolean, vehicleId?: string, taskKey?: string }
 * 
 * The endpoint:
 * 1. Authenticates the user via their Supabase JWT
 * 2. Verifies the task belongs to the user's organization
 * 3. Updates the task using the service role client (bypasses RLS)
 * 4. Records in cleaning history if completing a task
 */
import { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

export async function handleToggleCleaningTask(req: Request, res: Response) {
  try {
    // Authenticate the user
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!organizationId) {
      return res.status(400).json({ ok: false, error: "No organization" });
    }

    const { taskId, completed, vehicleId, taskKey } = req.body;

    if (!taskId || typeof completed !== "boolean") {
      return res.status(400).json({ ok: false, error: "Missing taskId or completed" });
    }

    const sb = getServiceClient();

    // Verify the task exists and belongs to a vehicle in the user's organization
    const { data: task, error: taskError } = await sb
      .from("vehicle_cleaning_tasks")
      .select("id, vehicle_id, task_key, completed")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) {
      console.error("[toggle-cleaning-task] Task lookup error:", taskError.message);
      return res.status(500).json({ ok: false, error: taskError.message });
    }

    if (!task) {
      return res.status(404).json({ ok: false, error: "Tarea no encontrada" });
    }

    // Verify the vehicle belongs to the user's organization
    const { data: vehicle, error: vehicleError } = await sb
      .from("vehicles")
      .select("id, organization_id")
      .eq("id", task.vehicle_id)
      .maybeSingle();

    if (vehicleError) {
      console.error("[toggle-cleaning-task] Vehicle lookup error:", vehicleError.message);
      return res.status(500).json({ ok: false, error: vehicleError.message });
    }

    if (!vehicle || vehicle.organization_id !== organizationId) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para esta operación" });
    }

    // Perform the update using service role (bypasses RLS)
    const now = new Date().toISOString();
    const { error: updateError } = await sb
      .from("vehicle_cleaning_tasks")
      .update({
        completed,
        completed_at: completed ? now : null,
        completed_by: completed ? userId : null,
      })
      .eq("id", taskId);

    if (updateError) {
      console.error("[toggle-cleaning-task] Update error:", updateError.message);
      return res.status(500).json({ ok: false, error: updateError.message });
    }

    // Record in cleaning history when completing a task
    if (completed && (vehicleId || task.vehicle_id) && (taskKey || task.task_key)) {
      const historyVehicleId = vehicleId || task.vehicle_id;
      const historyTaskKey = taskKey || task.task_key;

      await sb
        .from("vehicle_cleaning_history")
        .insert({
          organization_id: organizationId,
          vehicle_id: historyVehicleId,
          task_key: historyTaskKey,
          completed_by: userId,
          completed_at: now,
        })
        .then(({ error: historyError }) => {
          if (historyError) {
            // Non-critical: log but don't fail the request
            console.warn("[toggle-cleaning-task] History insert error:", historyError.message);
          }
        });
    }

    return res.json({ ok: true, taskId, completed, completed_at: completed ? now : null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error("[toggle-cleaning-task] Error:", err?.message);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
}
