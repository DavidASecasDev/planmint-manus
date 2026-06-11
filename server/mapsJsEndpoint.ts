/**
 * Maps JS SDK Endpoint
 * Returns the URL for loading Google Maps JS API via the Manus proxy.
 * The frontend calls this to get the script URL with the API key embedded.
 */
import { Request, Response } from "express";
import { ENV } from "./_core/env";

export async function handleGetMapsJsUrl(req: Request, res: Response) {
  try {
    const forgeUrl = ENV.forgeApiUrl;
    const forgeKey = ENV.forgeApiKey;

    if (!forgeUrl || !forgeKey) {
      return res.status(500).json({
        ok: false,
        error: "Maps proxy not configured",
      });
    }

    // The Manus Forge proxy exposes the Google Maps JS API at this URL
    const mapsJsUrl = `${forgeUrl.replace(/\/+$/, "")}/v1/maps/proxy/maps/api/js?key=${forgeKey}&libraries=drawing,geometry,places&callback=__initGoogleMaps`;

    return res.json({ ok: true, url: mapsJsUrl });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
