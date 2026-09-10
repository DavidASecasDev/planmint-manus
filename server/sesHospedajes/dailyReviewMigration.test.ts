import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../supabase/migrations/20260910100000_ses_daily_review_batches.sql', import.meta.url), 'utf8');

describe('SES daily review migration', () => {
  it('creates persistent batches, items, sources, proposals and automation settings', () => {
    for (const table of [
      'rently_booking_events', 'ses_review_batches', 'ses_review_items', 'ses_review_item_sources',
      'ses_review_evidence_proposals', 'ses_review_automation_settings',
    ]) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    expect(sql).toContain('idx_rently_booking_events_delivery');
  });

  it('prevents concurrent active batches for the same organization and date', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_ses_review_batches_period');
    expect(sql).toContain('ON public.ses_review_batches(organization_id, batch_kind, period_start, period_end)');
    expect(sql).toContain('uq_ses_review_batches_period');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('create_or_resume_ses_review_batch');
    expect(sql).toContain('acquire_ses_review_batch_lease');
    expect(sql).toContain('renew_ses_review_batch_lease');
    expect(sql).toContain("'ses-review-org:'");
    expect(sql).toContain("tstzrange(other.period_start, other.period_end, '[)')");
    expect(sql).toContain('claim_ses_review_proposal');
    expect(sql).toContain('apply_ses_review_proposal_decision');
    expect(sql).toContain('resolve_ses_review_item_conflict');
    expect(sql).toContain('apply_ses_verified_review_draft');
    expect(sql).toContain('p_expected_updated_at');
    expect(sql).toContain('p_expected_draft_version');
    expect(sql).toContain('batch_row.lease_token IS DISTINCT FROM p_lease_token');
    expect(sql).toContain('IS DISTINCT FROM draft.pickup_location_id');
    expect(sql).toContain('target_updated_at');
    expect(sql).toContain('jsonb_populate_record');
    expect(sql).toContain('daily_review_conflicts');
    expect(sql).toContain('daily_review_open_conflicts');
    expect(sql).toContain("'review_conflict_resolved'");
    expect(sql).toContain("conflict_value->>'status' = 'resolved'");
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain("processing_started_at < clock_timestamp() - interval '5 minutes'");
    expect(sql).toContain('lease_expires_at <= clock_timestamp()');
    expect(sql).toContain("status NOT IN ('completed','cancelled')");
  });

  it('forces RLS and exposes tables only to service_role', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE');
    expect(sql).toContain('GRANT ALL ON TABLE');
    expect(sql).toContain('TO service_role');
  });

  it('keeps historical loads explicitly bounded and external data as proposals', () => {
    expect(sql).toContain('historical_to - historical_from <= 90');
    expect(sql).toContain("source IN ('hubspot','respond','document')");
    expect(sql).toContain("status text NOT NULL DEFAULT 'proposed'");
    expect(sql).toContain('external_submission_id text NOT NULL');
    expect(sql).toContain('evidence_generated_at timestamptz');
    expect(sql).toContain('delivery_actual_literal text');
    expect(sql).toContain('evidence_generated_literal text');
    expect(sql).toContain('planned_pickup_literal text');
    expect(sql).toContain('pickup_at_source text');
    expect(sql).toContain("'rently','hubspot','respond','document','manual'");
    expect(sql).toContain("'evidence_conflict'");
    expect(sql).toContain("'outside_period'");
    expect(sql).toContain('coverage_version');
    expect(sql).toContain('coverage_scope');
  });

  it('does not delete or rewrite historical SES business rows', () => {
    const migrationStatements = sql.slice(0, sql.indexOf('CREATE OR REPLACE FUNCTION public.create_or_resume_ses_review_batch'));
    expect(migrationStatements).not.toMatch(/\b(TRUNCATE|DELETE FROM|UPDATE public\.ses_(contract_drafts|person_profiles|locations|batches|batch_items))\b/i);
    expect(sql).not.toMatch(/\b(TRUNCATE|DELETE FROM)\b/i);
    expect(sql).not.toContain('DROP TABLE');
  });
});
