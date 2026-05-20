/**
 * Transfer Automation Endpoint
 * 
 * Exposes a POST /api/fire-transfer-automation endpoint that the frontend
 * calls after creating or updating a transfer request. This triggers the
 * automation engine to evaluate and execute matching rules.
 */
import { Request, Response } from "express";
import { authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { fireTransferAutomation, TransferTriggerType } from "./automationEngine";

interface FireTransferAutomationBody {
  request_id: string;
  trigger_type: TransferTriggerType;
  status?: string;
  previous_status?: string | null;
  broker_id?: string | null;
  broker_name?: string;
  client_name?: string;
  service_type?: string;
  request_number?: string;
}

export async function handleFireTransferAutomation(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    if (!organizationId) {
      return res.status(400).json({ error: "No organization context" });
    }

    const body: FireTransferAutomationBody = req.body;

    if (!body.request_id || !body.trigger_type) {
      return res.status(400).json({
        error: "request_id and trigger_type are required",
      });
    }

    // Validate trigger type
    const validTriggers: TransferTriggerType[] = [
      'transfer_created',
      'transfer_status_changed',
      'transfer_due_soon',
      'transfer_completed',
      'transfer_cancelled',
    ];

    if (!validTriggers.includes(body.trigger_type)) {
      return res.status(400).json({
        error: `Invalid trigger_type: ${body.trigger_type}`,
      });
    }

    // Fire automation asynchronously (don't block the response)
    fireTransferAutomation({
      request_id: body.request_id,
      organization_id: organizationId,
      trigger_type: body.trigger_type,
      status: body.status,
      previous_status: body.previous_status,
      broker_id: body.broker_id,
      broker_name: body.broker_name,
      client_name: body.client_name,
      service_type: body.service_type,
      request_number: body.request_number,
      triggered_by_id: userId,
    }).catch(err => {
      console.error('[TransferAutomation] Background execution error:', err);
    });

    return res.json({ success: true, message: "Automation triggered" });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[TransferAutomation] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
