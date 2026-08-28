import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = new URL('../../supabase/migrations/20260828190000_ses_exact_reconciliation_and_exceptions.sql', import.meta.url);
const sql = readFileSync(path, 'utf8');

describe('SES exact reconciliation migration proposal', () => {
  it('is forward-only, transactional and free of production-specific references', () => {
    expect((sql.match(/^BEGIN;/gm) ?? [])).toHaveLength(1);
    expect((sql.match(/^COMMIT;/gm) ?? [])).toHaveLength(1);
    expect(sql).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE)\b/gim);
    expect(sql).not.toMatch(/\b(4942|5164|5343|0000065825)\b/);
  });

  it('adds only the exception table with RLS, service-role access and strict audit fields', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.ses_eligibility_exceptions');
    expect(sql).toContain('protocol_reference text NOT NULL');
    expect(sql).toContain('approved_by uuid NOT NULL');
    expect(sql).toContain('expires_at timestamptz NOT NULL');
    expect(sql).toContain('revoked_at timestamptz');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('GRANT ALL ON TABLE public.ses_eligibility_exceptions TO service_role');
  });

  it('asserts that every existing SES row count is preserved before commit', () => {
    for (const table of [
      'ses_contract_drafts', 'ses_batches', 'ses_batch_items', 'ses_settings',
      'ses_audit_events', 'ses_official_communications', 'ses_historical_snapshots',
    ]) expect(sql).toContain(`FROM public.${table}`);
    expect(sql).toContain('Postcondición fallida: cambió el número de filas de una tabla SES histórica');
  });
});
