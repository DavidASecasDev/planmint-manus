/**
 * Transfer Route Estimation endpoint.
 * Uses Google Maps Directions API to estimate travel time and distance
 * between pickup and dropoff locations for transfer items.
 * Biased towards Mallorca, Spain for better results.
 */
import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { makeRequest, type DirectionsResult } from "./_core/map";

interface RouteEstimateRequest {
  origin: string;
  destination: string;
}

interface RouteEstimateResponse {
  ok: boolean;
  duration_text?: string;      // e.g. "25 min"
  duration_seconds?: number;   // e.g. 1500
  distance_text?: string;      // e.g. "32.5 km"
  distance_meters?: number;    // e.g. 32500
  error?: string;
}

export async function handleTransferRouteEstimate(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { origin, destination } = req.body as RouteEstimateRequest;

    if (!origin || !destination || origin.trim().length < 3 || destination.trim().length < 3) {
      return res.json({
        ok: false,
        error: "Se requieren origen y destino con al menos 3 caracteres",
      });
    }

    // Append ", Mallorca, Spain" if the address doesn't already contain location context
    const normalizeAddress = (addr: string): string => {
      const lower = addr.toLowerCase();
      if (
        lower.includes("mallorca") ||
        lower.includes("palma") ||
        lower.includes("baleares") ||
        lower.includes("balears") ||
        lower.includes("spain") ||
        lower.includes("españa")
      ) {
        return addr.trim();
      }
      return `${addr.trim()}, Mallorca, Spain`;
    };

    const normalizedOrigin = normalizeAddress(origin);
    const normalizedDestination = normalizeAddress(destination);

    const result = await makeRequest<DirectionsResult>(
      "/maps/api/directions/json",
      {
        origin: normalizedOrigin,
        destination: normalizedDestination,
        mode: "driving",
        language: "es",
        region: "es",
      }
    );

    if (result.status === "OK" && result.routes?.length > 0) {
      const leg = result.routes[0].legs[0];
      
      const duration = leg.duration;
      
      return res.json({
        ok: true,
        duration_text: duration.text,
        duration_seconds: duration.value,
        distance_text: leg.distance.text,
        distance_meters: leg.distance.value,
      } satisfies RouteEstimateResponse);
    }

    if (result.status === "ZERO_RESULTS") {
      return res.json({
        ok: false,
        error: "No se encontró ruta entre las ubicaciones indicadas",
      });
    }

    if (result.status === "NOT_FOUND") {
      return res.json({
        ok: false,
        error: "No se pudo localizar una o ambas direcciones",
      });
    }

    return res.json({
      ok: false,
      error: `Error de Google Maps: ${result.status}`,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error("[transfer-route-estimate] Error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error al estimar la ruta",
    });
  }
}
