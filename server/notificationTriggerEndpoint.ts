/**
 * Notification Trigger Endpoint
 * 
 * POST /api/notifications/trigger
 * 
 * Called by the frontend after successful operations to create notifications
 * respecting org-level event config and user preferences.
 */
import { Router, Request, Response } from 'express';
import { authenticateSupabaseRequest, getServiceClient } from './supabaseAdmin';
import { sendOperationalNotification } from './notificationHelper';

const router = Router();

interface TriggerBody {
  eventKey: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  targetUserId?: string; // Optional: notify specific user only
}

router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const { eventKey, title, body, entityType, entityId, targetUserId } = req.body as TriggerBody;

    if (!eventKey || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields: eventKey, title, body' });
    }

    const sb = getServiceClient();

    await sendOperationalNotification(sb, {
      organizationId,
      eventKey,
      notificationType: eventKey,
      title,
      body,
      entityType: entityType || 'reservation',
      entityId: entityId || '',
      targetUserId: targetUserId || undefined,
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return res.status(error.status || 401).json({ error: error.message });
    }
    console.error('[notificationTrigger] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
