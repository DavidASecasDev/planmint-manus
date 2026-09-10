import { describe, expect, it } from 'vitest';
import {
  buildSesReviewCandidateWindow,
  createSesReviewLeaseGuard,
  deriveSesReviewBatchCounts,
  executeWithSesReviewLease,
} from './dailyReviewService';

describe('SES daily review service contract', () => {
  it('keeps the 5582-style next-day planned booking inside the bounded candidate window', () => {
    expect(buildSesReviewCandidateWindow({
      id: 'batch-1', organization_id: 'org-1', review_date: '2026-09-09',
      period_start: '2026-09-08T22:00:00.000Z', period_end: '2026-09-09T22:00:00.000Z',
      batch_kind: 'daily', source_channel: 'manual', status: 'queued', phase: 'discover_deliveries',
      cursor: {}, pages_complete: false, coverage_complete: false,
    })).toMatchObject({ dateFrom: '2026-09-09', dateTo: '2026-09-09' });
    const window = buildSesReviewCandidateWindow({
      id: 'batch-1', organization_id: 'org-1', review_date: '2026-09-09',
      period_start: '2026-09-08T22:00:00.000Z', period_end: '2026-09-09T22:00:00.000Z',
      batch_kind: 'daily', source_channel: 'manual', status: 'queued', phase: 'discover_deliveries',
      cursor: {}, pages_complete: false, coverage_complete: false,
    });
    expect(new Date('2026-09-10T10:00:00Z').getTime()).toBeLessThan(new Date(window.planned.end).getTime());
  });

  it('discovers from persisted list events and only requests detail for verified selected expedients', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('./dailyReviewService.ts', import.meta.url), 'utf8'));
    expect(source).toContain('rently_delivery_actual_literal');
    expect(source).toContain("const needsDetail = evidence.status === 'verified_delivery'");
    expect(source).toContain('needsDetail ? await fetchBookingDetail');
    expect(source).toContain('fetchBookingDetail(');
    expect(source).not.toContain('/api/operations/deliveries');
  });

  it('executes only one concurrent worker for the same atomic lease', async () => {
    let held = false;
    let executions = 0;
    const run = () => executeWithSesReviewLease({
      claim: async () => {
        if (held) return null;
        held = true;
        return { id: 'batch-1' };
      },
      execute: async () => {
        executions += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'ok';
      },
    });
    const results = await Promise.all([run(), run()]);
    expect(results.filter((result) => result.executed)).toHaveLength(1);
    expect(executions).toBe(1);
  });

  it('stops before a write when renewal reports that the worker lost its lease', async () => {
    let writes = 0;
    const serviceClient = {
      rpc: async () => ({ data: false, error: null }),
    } as any;
    const guard = createSesReviewLeaseGuard(serviceClient, 'org-1', 'batch-1', 'lease-1');
    await expect((async () => {
      await guard();
      writes += 1;
    })()).rejects.toThrow('perdió el lease');
    expect(writes).toBe(0);
  });

  it('renews the same lease token before allowing the next group', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const serviceClient = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { data: true, error: null };
      },
    } as any;
    const guard = createSesReviewLeaseGuard(serviceClient, 'org-1', 'batch-1', 'lease-1');
    await guard();
    await guard();
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.p_lease_token === 'lease-1')).toBe(true);
  });

  it('keeps verified deliveries unresolved while conflicts remain or the draft is not ready', () => {
    const withConflict = deriveSesReviewBatchCounts([
      { status: 'verified_delivery', draft_id: 'draft-1', conflicts: [{ field: 'licence_number' }] },
    ], ['draft-1']);
    expect(withConflict).toMatchObject({ verifiedCount: 1, pendingCount: 1, openConflictCount: 1, unresolvedCount: 1 });

    const notReady = deriveSesReviewBatchCounts([
      { status: 'verified_delivery', draft_id: 'draft-2', conflicts: [] },
    ], []);
    expect(notReady).toMatchObject({ verifiedCount: 1, pendingCount: 1, draftNotReadyCount: 1, unresolvedCount: 1 });

    const resolved = deriveSesReviewBatchCounts([
      { status: 'verified_delivery', draft_id: 'draft-3', conflicts: [] },
    ], ['draft-3']);
    expect(resolved).toMatchObject({ pendingCount: 0, unresolvedCount: 0, readyForXml: 1 });

    const outsidePeriod = deriveSesReviewBatchCounts([
      { status: 'outside_period', draft_id: null, conflicts: [] },
    ], []);
    expect(outsidePeriod).toMatchObject({ pendingCount: 0, unresolvedCount: 0, draftNotReadyCount: 0 });
  });
});
