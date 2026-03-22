/**
 * GET /api/get-vapid-key
 * Migrated from Supabase Edge Function get-vapid-key.
 * Returns the VAPID public key for push notification subscriptions.
 */
import type { Request, Response } from "express";

export async function handleGetVapidKey(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";

  if (!vapidPublicKey) {
    return res.status(500).json({ error: "VAPID key not configured" });
  }

  return res.json({ vapidPublicKey });
}
