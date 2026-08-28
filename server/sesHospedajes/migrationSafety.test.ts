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

  it('preserves the accepted pilot and blocks the protected references', () => {
    expect(sql).toContain("reference = '4942'");
    expect(sql).toContain("reference = '5164'");
    expect(sql).toContain("reference = '5343'");
    expect(sql).toContain("ready_for_xml = true");
  });

  it('does not invent or populate an XSD', () => {
    expect(sql).toContain('official_xsd_storage_key');
    expect(sql).not.toMatch(/UPDATE\s+public\.ses_settings[\s\S]{0,500}official_xsd_(hash|version|url)\s*=/i);
  });
});
