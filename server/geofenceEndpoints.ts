/**
 * Geofence Endpoints — CRUD for geographic zones (geofences)
 * Stored in Supabase `geofences` table.
 * 
 * Endpoints:
 * - POST /api/geofences/list     → List all geofences for the org
 * - POST /api/geofences/create   → Create a new geofence
 * - POST /api/geofences/update   → Update an existing geofence
 * - POST /api/geofences/delete   → Delete a geofence
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GeofenceCoordinate {
  lat: number;
  lng: number;
}

export interface GeofenceData {
  id?: string;
  organization_id: string;
  name: string;
  type: "circle" | "polygon"; // circle or polygon
  center_lat?: number; // for circles
  center_lng?: number; // for circles
  radius_meters?: number; // for circles
  coordinates?: GeofenceCoordinate[]; // for polygons
  color: string;
  opacity: number;
  is_active: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── List Geofences ─────────────────────────────────────────────────────────

export async function handleListGeofences(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const orgId = req.body.organization_id || organizationId;

    if (!orgId) {
      return res.status(400).json({ ok: false, error: "No organization" });
    }

    const sb = getServiceClient();

    // Permission check: fleet.gps
    const { allowed } = await checkUserPermission(sb, orgId, userId, "fleet.gps");
    if (!allowed) {
      return res.status(403).json({ ok: false, error: "No permission" });
    }

    const { data, error } = await sb
      .from("geofences")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ ok: true, geofences: data || [] });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[geofences/list]", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal error" });
  }
}

// ─── Create Geofence ────────────────────────────────────────────────────────

export async function handleCreateGeofence(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const orgId = req.body.organization_id || organizationId;

    if (!orgId) {
      return res.status(400).json({ ok: false, error: "No organization" });
    }

    const sb = getServiceClient();

    // Permission check: fleet.gps (only admins/managers should create geofences)
    const { allowed } = await checkUserPermission(sb, orgId, userId, "fleet.gps");
    if (!allowed) {
      return res.status(403).json({ ok: false, error: "No permission" });
    }

    const {
      name,
      type,
      center_lat,
      center_lng,
      radius_meters,
      coordinates,
      color,
      opacity,
      is_active,
      alert_on_enter,
      alert_on_exit,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ ok: false, error: "Name and type are required" });
    }

    if (type === "circle" && (!center_lat || !center_lng || !radius_meters)) {
      return res.status(400).json({ ok: false, error: "Circle requires center and radius" });
    }

    if (type === "polygon" && (!coordinates || coordinates.length < 3)) {
      return res.status(400).json({ ok: false, error: "Polygon requires at least 3 coordinates" });
    }

    const { data, error } = await sb
      .from("geofences")
      .insert({
        organization_id: orgId,
        name,
        type,
        center_lat: type === "circle" ? center_lat : null,
        center_lng: type === "circle" ? center_lng : null,
        radius_meters: type === "circle" ? radius_meters : null,
        coordinates: type === "polygon" ? coordinates : null,
        color: color || "#3B82F6",
        opacity: opacity ?? 0.2,
        is_active: is_active ?? true,
        alert_on_enter: alert_on_enter ?? true,
        alert_on_exit: alert_on_exit ?? false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return res.json({ ok: true, geofence: data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[geofences/create]", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal error" });
  }
}

// ─── Update Geofence ────────────────────────────────────────────────────────

export async function handleUpdateGeofence(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const orgId = req.body.organization_id || organizationId;

    if (!orgId) {
      return res.status(400).json({ ok: false, error: "No organization" });
    }

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, orgId, userId, "fleet.gps");
    if (!allowed) {
      return res.status(403).json({ ok: false, error: "No permission" });
    }

    const { id, ...updates } = req.body;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Geofence ID is required" });
    }

    // Remove fields that shouldn't be updated
    delete updates.organization_id;
    delete updates.created_by;
    delete updates.created_at;

    const { data, error } = await sb
      .from("geofences")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) throw error;

    return res.json({ ok: true, geofence: data });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[geofences/update]", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal error" });
  }
}

// ─── Delete Geofence ────────────────────────────────────────────────────────

export async function handleDeleteGeofence(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const orgId = req.body.organization_id || organizationId;

    if (!orgId) {
      return res.status(400).json({ ok: false, error: "No organization" });
    }

    const sb = getServiceClient();

    const { allowed } = await checkUserPermission(sb, orgId, userId, "fleet.gps");
    if (!allowed) {
      return res.status(403).json({ ok: false, error: "No permission" });
    }

    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Geofence ID is required" });
    }

    const { error } = await sb
      .from("geofences")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof AuthError) return res.status(401).json({ ok: false, error: err.message });
    console.error("[geofences/delete]", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal error" });
  }
}
