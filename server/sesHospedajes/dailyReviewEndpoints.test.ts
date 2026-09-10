import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const endpoints = fs.readFileSync(path.resolve('server/sesHospedajes/sesEndpoints.ts'), 'utf8');
const index = fs.readFileSync(path.resolve('server/_core/index.ts'), 'utf8');
const heartbeat = fs.readFileSync(path.resolve('server/sesHospedajes/dailyReviewHeartbeat.ts'), 'utf8');

describe('SES daily review route and authorization contract', () => {
  it('registers the complete review route surface without a send or XML route', () => {
    for (const route of [
      '/api/ses/reviews/daily/start',
      '/api/ses/reviews/historical/start',
      '/api/ses/reviews/continue',
      '/api/ses/reviews/list',
      '/api/ses/reviews/detail',
      '/api/ses/reviews/gmail-draft',
      '/api/ses/reviews/evidence/accredit',
      '/api/ses/reviews/proposals/submit',
      '/api/ses/reviews/proposals/decide',
      '/api/ses/reviews/conflicts/resolve',
    ]) expect(index).toContain(route);
    expect(index).not.toContain('/api/ses/reviews/send');
    expect(index).not.toContain('/api/ses/reviews/xml');
  });

  it('uses SES view for reads and SES edit for every mutation', () => {
    expect(endpoints.match(/authorize\(req, 'ses_hospedajes\.view'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(endpoints.match(/authorize\(req, 'ses_hospedajes\.edit'\)/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it('scopes batches, items and proposals by the authenticated organization', () => {
    expect(endpoints).toContain(".eq('organization_id', ctx.organizationId)");
    expect(endpoints).toContain('p_organization_id: ctx.organizationId');
    expect(endpoints).toContain(".eq('batch_id', input.batchId).eq('organization_id', ctx.organizationId)");
  });

  it('requires typed linked proposal targets and commits decisions through the fenced transaction', () => {
    expect(endpoints).toContain("targetType: z.enum(['draft', 'person', 'pickup_location', 'return_location'])");
    expect(endpoints).toContain('assertSesReviewProposalTarget');
    expect(endpoints).toContain(".eq('id', input.targetId).eq('organization_id', ctx.organizationId)");
    expect(endpoints).toContain('target_updated_at: target.updated_at');
    expect(endpoints).toContain("rpc('apply_ses_review_proposal_decision'");
  });

  it('resolves only an open conflict for the authenticated organization through the audited CAS function', () => {
    expect(endpoints).toContain('ResolveSesReviewConflictSchema');
    expect(endpoints).toContain("authorize(req, 'ses_hospedajes.edit')");
    expect(endpoints).toContain("getSesReviewConflictKey(candidate) === input.conflictKey");
    expect(endpoints).toContain("rpc('resolve_ses_review_item_conflict'");
    expect(endpoints).toContain('p_expected_item_updated_at: expectedItemUpdatedAt');
    expect(endpoints).toContain('p_evidence_reference: input.evidenceReference');
  });

  it('reuses completed periods without executing a new review step', () => {
    expect(endpoints).toContain("input.runFirstStep && !['completed', 'cancelled'].includes(batch.status)");
  });

  it('registers a cron-only callback that resolves the organization by task uid', () => {
    expect(index).toContain('/api/scheduled/ses-daily-review');
    expect(heartbeat).toContain('user.isCron');
    expect(heartbeat).toContain(".eq('schedule_task_uid', taskUid)");
    expect(heartbeat).toContain("setting.time_zone !== 'Europe/Madrid'");
    expect(heartbeat).toContain('automation-actor-not-configured');
    expect(heartbeat).not.toContain('req.body.organization');
  });
});
