/**
 * POST /api/ai-assistant
 * Migrated from Supabase Edge Function ai-assistant.
 * Uses Manus LLM instead of Lovable/OpenAI API.
 *
 * Supports types: insights, task_summary, weekly_digest, connection_test
 */
import type { Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchOrganizationData(organizationId: string) {
  const serviceClient = getServiceClient();

  // Fetch reservations (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: reservations } = await serviceClient
    .from("reservations")
    .select("id, estado, desde, hasta, precio, modelo, categoria, origen_reserva, cliente_nombre, cliente_apellido")
    .eq("organization_id", organizationId)
    .gte("desde", thirtyDaysAgo)
    .order("desde", { ascending: false })
    .limit(200);

  // Fetch vehicles from fleet_vehicles (source of truth)
  const { data: vehicles } = await serviceClient
    .from("fleet_vehicles")
    .select("id, matricula, marca, modelo, status, categoria")
    .eq("organization_id", organizationId)
    .limit(100);

  // Fetch movements (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: movements } = await serviceClient
    .from("vehicle_movements")
    .select("id, type, status, created_at, plate")
    .eq("organization_id", organizationId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch tasks
  const { data: tasks } = await serviceClient
    .from("tasks")
    .select("id, title, status, priority, due_date, assigned_to")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"])
    .limit(50);

  return { reservations: reservations || [], vehicles: vehicles || [], movements: movements || [], tasks: tasks || [] };
}

async function fetchTaskData(taskId: string) {
  const serviceClient = getServiceClient();

  const { data: task } = await serviceClient
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (!task) return null;

  const { data: comments } = await serviceClient
    .from("task_comments")
    .select("content, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(20);

  return { task, comments: comments || [] };
}

// ─── AI Generation ───────────────────────────────────────────────────────────

async function generateInsights(organizationId: string): Promise<string> {
  const data = await fetchOrganizationData(organizationId);

  const stats = {
    totalReservations: data.reservations.length,
    activeVehicles: data.vehicles.length,
    recentMovements: data.movements.length,
    pendingTasks: data.tasks.length,
    statusBreakdown: data.reservations.reduce((acc: Record<string, number>, r) => {
      acc[r.estado || "Sin estado"] = (acc[r.estado || "Sin estado"] || 0) + 1;
      return acc;
    }, {}),
    vehicleStatusBreakdown: data.vehicles.reduce((acc: Record<string, number>, v) => {
      acc[v.status || "Sin estado"] = (acc[v.status || "Sin estado"] || 0) + 1;
      return acc;
    }, {}),
  };

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Eres un analista de negocio para una empresa de alquiler de vehículos. Genera un resumen ejecutivo conciso en español con insights accionables. Usa formato markdown con secciones claras. Incluye:
1. Resumen general del estado actual
2. Métricas clave (reservas, vehículos, movimientos)
3. Tendencias observadas
4. Recomendaciones prioritarias
Sé directo y práctico. No uses más de 500 palabras.`,
      },
      {
        role: "user",
        content: `Datos de la organización (últimos 30 días):
- Reservas: ${stats.totalReservations} (${JSON.stringify(stats.statusBreakdown)})
- Vehículos activos: ${stats.activeVehicles} (${JSON.stringify(stats.vehicleStatusBreakdown)})
- Movimientos recientes (7 días): ${stats.recentMovements}
- Tareas pendientes: ${stats.pendingTasks}

Top modelos reservados: ${JSON.stringify(
          data.reservations
            .reduce((acc: Record<string, number>, r) => {
              if (r.modelo) acc[r.modelo] = (acc[r.modelo] || 0) + 1;
              return acc;
            }, {})
        )}

Orígenes de reserva: ${JSON.stringify(
          data.reservations
            .reduce((acc: Record<string, number>, r) => {
              if (r.origen_reserva) acc[r.origen_reserva] = (acc[r.origen_reserva] || 0) + 1;
              return acc;
            }, {})
        )}`,
      },
    ],
  });

  return response.choices?.[0]?.message?.content?.toString() || "No se pudieron generar insights.";
}

async function generateTaskSummary(taskId: string): Promise<string> {
  const data = await fetchTaskData(taskId);
  if (!data) return "Tarea no encontrada.";

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Eres un asistente de gestión de tareas. Genera un resumen conciso de la tarea en español. Incluye:
1. Estado actual y prioridad
2. Resumen de la actividad reciente (comentarios)
3. Próximos pasos sugeridos
Sé breve y práctico. Máximo 200 palabras.`,
      },
      {
        role: "user",
        content: `Tarea: ${data.task.title}
Estado: ${data.task.status}
Prioridad: ${data.task.priority}
Fecha límite: ${data.task.due_date || "Sin fecha"}
Descripción: ${data.task.description || "Sin descripción"}

Últimos comentarios:
${data.comments.map((c) => `- ${c.content}`).join("\n") || "Sin comentarios"}`,
      },
    ],
  });

  return response.choices?.[0]?.message?.content?.toString() || "No se pudo generar el resumen.";
}

async function generateWeeklyDigest(organizationId: string): Promise<string> {
  const data = await fetchOrganizationData(organizationId);

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Eres un analista de negocio para una empresa de alquiler de vehículos. Genera un resumen semanal ejecutivo en español. Usa formato markdown. Incluye:
1. Resumen de la semana
2. Reservas nuevas y completadas
3. Estado de la flota
4. Movimientos realizados
5. Tareas pendientes importantes
6. Recomendaciones para la próxima semana
Sé conciso y orientado a la acción. Máximo 400 palabras.`,
      },
      {
        role: "user",
        content: `Datos semanales:
- Reservas activas: ${data.reservations.filter((r) => ["Confirmada", "En curso", "Pendiente"].includes(r.estado)).length}
- Reservas completadas: ${data.reservations.filter((r) => r.estado === "Completada").length}
- Vehículos disponibles: ${data.vehicles.filter((v) => v.status === "Disponible" || v.status === "Limpio").length} de ${data.vehicles.length}
- Movimientos esta semana: ${data.movements.length}
- Tareas pendientes: ${data.tasks.length}
- Tareas urgentes: ${data.tasks.filter((t) => t.priority === "high" || t.priority === "urgent").length}`,
      },
    ],
  });

  return response.choices?.[0]?.message?.content?.toString() || "No se pudo generar el resumen semanal.";
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function handleAiAssistant(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Authenticate
    const { organizationId } = await authenticateSupabaseRequest(req.headers.authorization);

    const { type, organizationId: bodyOrgId, taskId } = req.body || {};
    const orgId = bodyOrgId || organizationId;

    switch (type) {
      case "connection_test":
        // Just test that LLM is reachable
        try {
          const testResponse = await invokeLLM({
            messages: [{ role: "user", content: "Say OK" }],
          });
          if (testResponse.choices?.[0]?.message?.content) {
            return res.json({ success: true });
          }
          return res.json({ success: false, error: "LLM did not respond" });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }

      case "insights":
        const insights = await generateInsights(orgId);
        return res.json({ summary: insights });

      case "task_summary":
        if (!taskId) return res.status(400).json({ error: "taskId is required" });
        const taskSummary = await generateTaskSummary(taskId);
        return res.json({ summary: taskSummary });

      case "weekly_digest":
        const digest = await generateWeeklyDigest(orgId);
        return res.json({ summary: digest });

      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }
  } catch (error: any) {
    console.error("[ai-assistant] Error:", error);
    const status = error instanceof AuthError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Error desconocido" });
  }
}
