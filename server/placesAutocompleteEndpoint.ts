/**
 * Google Places Autocomplete endpoint.
 * Proxies autocomplete requests to Google Maps via the Manus proxy.
 * Used by the frontend "Dirección" field for address suggestions.
 */
import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { makeRequest } from "./_core/map";

interface AutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AutocompleteResponse {
  predictions: AutocompletePrediction[];
  status: string;
}

export async function handlePlacesAutocomplete(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { input } = req.body;
    if (!input || typeof input !== "string" || input.trim().length < 2) {
      return res.json({ ok: true, predictions: [] });
    }

    const result = await makeRequest<AutocompleteResponse>(
      "/maps/api/place/autocomplete/json",
      {
        input: input.trim(),
        // Bias results towards Mallorca, Spain
        location: "39.6953,-3.0176",
        radius: 50000, // 50km radius
        language: "es",
        components: "country:es",
      }
    );

    if (result.status === "OK" || result.status === "ZERO_RESULTS") {
      return res.json({
        ok: true,
        predictions: (result.predictions || []).map((p) => ({
          description: p.description,
          placeId: p.place_id,
          mainText: p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || "",
        })),
      });
    }

    return res.json({ ok: true, predictions: [] });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error("[places-autocomplete] Error:", err);
    return res.status(500).json({ ok: false, error: "Error en autocompletado" });
  }
}
