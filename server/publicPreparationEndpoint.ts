import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";

/**
 * Public Preparation List Endpoint
 *
 * GET /api/public/preparacion
 *
 * Returns the current preparation list for Azul Cars (pending items only).
 * No authentication required. Minimal data exposed (matricula, modelo, deadline, notes, urgency).
 */

// Hardcoded Azul Cars org ID (same as in publicOperationsEndpoint.ts)
const AZUL_CARS_ORG_ID = "a23a0d42-5af7-4cda-9955-569c10cc6714";

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

    // Add urgency level to each item
    const now = Date.now();
    const items = (data || []).map((item) => {
      const diffMs = new Date(item.deadline_at).getTime() - now;
      const diffHours = diffMs / (1000 * 60 * 60);
      let urgency: "critical" | "high" | "medium" | "low";
      if (diffHours < 0 || diffHours < 1) urgency = "critical";
      else if (diffHours < 4) urgency = "high";
      else if (diffHours < 12) urgency = "medium";
      else urgency = "low";

      return {
        id: item.id,
        matricula: item.matricula,
        modelo: item.modelo,
        deadline_at: item.deadline_at,
        notes: item.notes,
        urgency,
      };
    });

    return res.json({ ok: true, items, count: items.length });
  } catch (err: any) {
    console.error("[public-preparation] Error:", err?.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
