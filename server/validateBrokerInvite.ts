/**
 * POST /api/validate-broker-invite
 * 
 * Public endpoint (no auth required) that validates a broker invite code
 * and returns the organization info if valid.
 * 
 * This endpoint uses the service role client to bypass RLS policies,
 * since the broker is not authenticated when visiting the registration page.
 */
import { Request, Response } from "express";
import { getServiceClient } from "./supabaseAdmin";

interface InvitePayload {
  /** Organization ID */
  o: string;
  /** Timestamp (ms) when the invite was created */
  t: number;
}

function decodeInviteCode(code: string): string | null {
  try {
    // Restore standard Base64 from URL-safe variant
    let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const payload: InvitePayload = JSON.parse(json);

    // Validate payload shape
    if (!payload.o || typeof payload.o !== 'string') {
      return null;
    }

    // UUID format check
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.o)) {
      return null;
    }

    return payload.o;
  } catch {
    return null;
  }
}

export async function handleValidateBrokerInvite(req: Request, res: Response) {
  try {
    const { invite_code } = req.body;

    if (!invite_code || typeof invite_code !== 'string') {
      return res.status(400).json({ valid: false, error: 'missing_code' });
    }

    const orgId = decodeInviteCode(invite_code);
    if (!orgId) {
      return res.status(400).json({ valid: false, error: 'invalid_code' });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return res.json({ valid: false, error: 'org_not_found' });
    }

    return res.json({
      valid: true,
      organization: { id: data.id, name: data.name },
    });
  } catch (err: any) {
    console.error("[validate-broker-invite] Error:", err);
    return res.status(500).json({ valid: false, error: 'server_error' });
  }
}
