import type { Request, Response } from 'express';
import { sdk } from '../_core/sdk';
import { getServiceClient } from '../supabaseAdmin';
import { getMadridDayRange, previousMadridDate } from './dailyReview';
import { runSesReviewBatchStep } from './dailyReviewService';
import { prepareSesDraftFromVerifiedReview } from './sesEndpoints';

export async function handleScheduledSesDailyReview(req: Request, res: Response) {
  let taskUid: string | null = null;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: 'cron-only' });
    taskUid = user.taskUid;
    const serviceClient = getServiceClient();
    const { data: setting, error: settingError } = await serviceClient.from('ses_review_automation_settings')
      .select('organization_id,enabled,time_zone,review_hour,schedule_task_uid,actor_user_id')
      .eq('schedule_task_uid', taskUid).maybeSingle();
    if (settingError) throw settingError;
    if (!setting) return res.json({ ok: true, skipped: 'orphan' });
    if (!setting.enabled) return res.json({ ok: true, skipped: 'disabled' });
    if (!setting.actor_user_id) return res.status(409).json({ error: 'automation-actor-not-configured' });
    if (setting.time_zone !== 'Europe/Madrid' || setting.review_hour !== 4) {
      return res.status(409).json({ error: 'invalid-automation-setting' });
    }

    const reviewDate = previousMadridDate();
    const period = getMadridDayRange(reviewDate);
    const { data: batchData, error: batchError } = await serviceClient.rpc('create_or_resume_ses_review_batch', {
      p_organization_id: setting.organization_id,
      p_review_date: reviewDate,
      p_period_start: period.start,
      p_period_end: period.end,
      p_batch_kind: 'daily',
      p_source_channel: 'heartbeat',
      p_created_by: null,
      p_historical_from: null,
      p_historical_to: null,
      p_schedule_task_uid: taskUid,
    });
    if (batchError) throw batchError;
    let batch = Array.isArray(batchData) ? batchData[0] : batchData;
    if (!batch?.id) throw new Error('No se pudo crear o reanudar el lote diario SES');
    if (batch.status === 'completed') return res.json({ ok: true, skipped: 'completed', batchId: batch.id });

    const deadline = Date.now() + 90_000;
    let steps = 0;
    let busy = false;
    while (Date.now() < deadline && steps < 4 && batch?.status !== 'completed') {
      const result = await runSesReviewBatchStep({
        serviceClient,
        batchId: batch.id,
        organizationId: setting.organization_id,
        actorUserId: setting.actor_user_id,
        pageSize: 20,
        prepareVerifiedDraft: ({ reservation, detail, assertLease, batchId, leaseToken, existingConflicts }) => prepareSesDraftFromVerifiedReview({
          serviceClient, organizationId: setting.organization_id, userId: setting.actor_user_id,
        }, reservation, detail, assertLease, batchId, leaseToken, existingConflicts),
      });
      busy = 'busy' in result && Boolean(result.busy);
      if (busy || !result.batch) break;
      batch = result.batch;
      steps += 1;
    }
    return res.json({ ok: true, batchId: batch.id, status: batch.status, steps, busy, resumable: batch.status !== 'completed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({
      error: message,
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
