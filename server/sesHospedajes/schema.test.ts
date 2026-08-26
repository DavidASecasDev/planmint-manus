import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe('SES Supabase schema', () => {
  it.skipIf(!configured)('contains all required tables and the official INE catalogue', async () => {
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const requiredTables = [
      'ses_settings', 'ses_municipalities', 'ses_person_profiles', 'ses_locations',
      'ses_contract_drafts', 'ses_batches', 'ses_batch_items', 'ses_audit_events',
    ];
    for (const table of requiredTables) {
      const { error } = await client.from(table).select('*', { head: true, count: 'exact' }).limit(1);
      expect(error, `La tabla ${table} debe estar disponible`).toBeNull();
    }
    const { count, error } = await client.from('ses_municipalities').select('code', { head: true, count: 'exact' });
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(8_000);

    const { error: settingsError } = await client.from('ses_settings')
      .select('lessor_code,establishment_code,government_service_enabled')
      .limit(1);
    expect(settingsError, 'ses_settings debe contener la configuración operativa usada por la interfaz').toBeNull();
  }, 30_000);
});
