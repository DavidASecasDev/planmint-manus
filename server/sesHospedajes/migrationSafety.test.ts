import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve('supabase/migrations/20260828143000_ses_hospedajes_compatibility_restore.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

describe('SES compatibility migration safety', () => {
  it('is transactional, forward-only and contains explicit pre/postconditions', () => {
    expect(sql).toMatch(/^--[\s\S]*\nBEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;$/);
    expect(sql).toContain('SES recovery precondition failed');
    expect(sql).toContain('SES recovery postcondition failed');
    expect(sql).not.toMatch(/\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
  });

  it('uses generic historical evidence and contains no nominal business branches', () => {
    expect(sql).toContain("item.result_status = 'accepted'");
    expect(sql).toContain('draft.ready_for_xml = true');
    expect(sql).toContain('migration.revalidation_required');
    expect(sql).not.toMatch(/\b(4942|5164|5343|0000065825)\b/);
    expect(sql).not.toMatch(/DROP\s+CONSTRAINT/i);
  });

  it('does not invent or populate an XSD', () => {
    expect(sql).toContain('official_xsd_storage_key');
    expect(sql).not.toMatch(/UPDATE\s+public\.ses_settings[\s\S]{0,500}official_xsd_(hash|version|url)\s*=/i);
  });
});
