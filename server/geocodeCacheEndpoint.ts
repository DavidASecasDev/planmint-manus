/**
 * Geocode Cache Endpoint.
 * Provides batch lookup and save operations for geocoded addresses.
 * Uses the geocode_cache table in Supabase to persist results.
 */
import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError, getServiceClient } from "./supabaseAdmin";

interface CachedGeocode {
  address_key: string;
  lat: number;
  lng: number;
  formatted_address: string | null;
}

/**
 * POST /api/geocode-cache/lookup
 * Body: { organization_id: string, address_keys: string[] }
 * Returns: { ok: true, results: Record<string, { lat, lng, formatted_address }> }
 */
export async function handleGeocodeCacheLookup(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { organization_id, address_keys } = req.body;
    if (!organization_id || !Array.isArray(address_keys) || address_keys.length === 0) {
      return res.json({ ok: true, results: {} });
    }

    // Limit batch size to prevent abuse
    const keys = address_keys.slice(0, 200).map((k: string) => k.toLowerCase().trim());

    const client = getServiceClient();
    const { data, error } = await client
      .from('geocode_cache')
      .select('address_key, lat, lng, formatted_address')
      .eq('organization_id', organization_id)
      .in('address_key', keys);

    if (error) {
      console.error('[geocode-cache] Lookup error:', error.message);
      return res.json({ ok: true, results: {} });
    }

    const results: Record<string, { lat: number; lng: number; formatted_address: string | null }> = {};
    for (const row of (data || []) as CachedGeocode[]) {
      results[row.address_key] = {
        lat: row.lat,
        lng: row.lng,
        formatted_address: row.formatted_address,
      };
    }

    return res.json({ ok: true, results });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error('[geocode-cache] Lookup error:', err);
    return res.status(500).json({ ok: false, error: "Error en caché de geocodificación" });
  }
}

/**
 * POST /api/geocode-cache/save
 * Body: { organization_id: string, entries: Array<{ address_key, lat, lng, formatted_address? }> }
 * Returns: { ok: true, saved: number }
 */
export async function handleGeocodeCacheSave(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { organization_id, entries } = req.body;
    if (!organization_id || !Array.isArray(entries) || entries.length === 0) {
      return res.json({ ok: true, saved: 0 });
    }

    // Limit batch size
    const toSave = entries.slice(0, 200).map((e: any) => ({
      organization_id,
      address_key: String(e.address_key || '').toLowerCase().trim(),
      lat: Number(e.lat),
      lng: Number(e.lng),
      formatted_address: e.formatted_address || null,
      updated_at: new Date().toISOString(),
    })).filter(e => e.address_key && !isNaN(e.lat) && !isNaN(e.lng));

    if (toSave.length === 0) {
      return res.json({ ok: true, saved: 0 });
    }

    const client = getServiceClient();
    const { error } = await client
      .from('geocode_cache')
      .upsert(toSave, { onConflict: 'organization_id,address_key' });

    if (error) {
      console.error('[geocode-cache] Save error:', error.message);
      return res.json({ ok: true, saved: 0 });
    }

    return res.json({ ok: true, saved: toSave.length });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error('[geocode-cache] Save error:', err);
    return res.status(500).json({ ok: false, error: "Error guardando caché" });
  }
}

/**
 * POST /api/geocode-cache/manual-set
 * Body: { organization_id: string, address_key: string, lat: number, lng: number, formatted_address?: string }
 * Allows manually setting/correcting a geocode entry.
 * Returns: { ok: true }
 */
export async function handleGeocodeCacheManualSet(req: Request, res: Response) {
  try {
    const { userId } = await authenticateSupabaseRequest(req.headers.authorization);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { organization_id, address_key, lat, lng, formatted_address } = req.body;
    if (!organization_id || !address_key || lat == null || lng == null) {
      return res.status(400).json({ ok: false, error: "Faltan campos requeridos" });
    }

    const client = getServiceClient();
    const { error } = await client
      .from('geocode_cache')
      .upsert({
        organization_id,
        address_key: String(address_key).toLowerCase().trim(),
        lat: Number(lat),
        lng: Number(lng),
        formatted_address: formatted_address || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,address_key' });

    if (error) {
      console.error('[geocode-cache] Manual set error:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(401).json({ ok: false, error: err.message });
    }
    console.error('[geocode-cache] Manual set error:', err);
    return res.status(500).json({ ok: false, error: "Error guardando coordenadas" });
  }
}
