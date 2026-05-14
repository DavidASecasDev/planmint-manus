/**
 * Google Maps Geocoding endpoint.
 * Proxies geocoding requests to Google Maps via the Manus proxy.
 * Used by the LiveMap when Nominatim fails to find an address.
 */
import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { makeRequest } from "./_core/map";

interface GeocodeResult {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_address: string;
}

interface GeocodeResponse {
  results: GeocodeResult[];
  status: string;
}

export async function handleGeocode(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { address } = req.body;
    if (!address || typeof address !== "string" || address.trim().length < 3) {
      return res.json({ ok: true, result: null });
    }

    const result = await makeRequest<GeocodeResponse>(
      "/maps/api/geocode/json",
      {
        address: address.trim(),
        // Bias results towards Mallorca, Spain
        bounds: "39.2,-3.5|40.0,3.5",
        language: "es",
        region: "es",
      }
    );

    if (result.status === "OK" && result.results && result.results.length > 0) {
      const loc = result.results[0].geometry.location;
      return res.json({
        ok: true,
        result: {
          lat: loc.lat,
          lng: loc.lng,
          formattedAddress: result.results[0].formatted_address,
        },
      });
    }

    return res.json({ ok: true, result: null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error("[geocode] Error:", err);
    return res.status(500).json({ ok: false, error: "Error en geocodificación" });
  }
}
