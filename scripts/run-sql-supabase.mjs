/**
 * Run SQL against Supabase using the Management API (requires service role key)
 * Uses the pg_net extension or direct SQL execution endpoint
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
console.log('Project ref:', projectRef);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema: 'public' }
});

// Try using the Supabase SQL API endpoint (available in newer versions)
async function runSQLViaManagementAPI(sql) {
  // The Supabase Management API endpoint for SQL
  const url = `https://${projectRef}.supabase.co/rest/v1/rpc/`;
  
  // First, let's try to create a function via the PostgREST interface
  // We need to use a workaround since PostgREST doesn't support DDL directly
  
  // Try the pg_query endpoint (Supabase internal)
  const endpoints = [
    `https://${projectRef}.supabase.co/pg/query`,
    `https://${projectRef}.supabase.co/sql`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceRoleKey,
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql })
      });
      const text = await response.text();
      console.log(`[${endpoint}] Status: ${response.status}`);
      if (response.status === 200 || response.status === 201) {
        console.log('Success:', text.substring(0, 200));
        return true;
      }
    } catch (e) {
      console.log(`[${endpoint}] Error:`, e.message);
    }
  }
  return false;
}

// Alternative: Use the database connection string directly via pg
async function runSQLViaPg(sql) {
  try {
    // Check if DATABASE_URL is available (it's the TiDB connection)
    // But we need the Supabase PostgreSQL connection
    // The Supabase PostgreSQL connection is typically:
    // postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    
    // Let's try using the Supabase client's rpc to create a function first
    // We'll create a temporary SQL executor function
    
    // Step 1: Try to create the function using a workaround
    // PostgREST allows calling existing functions, but not creating new ones
    // However, if we have the service role key, we might be able to use
    // the Supabase Database API
    
    const dbApiUrl = `https://${projectRef}.supabase.co/rest/v1/`;
    
    // Let's check what functions exist
    const { data: functions, error } = await supabase.rpc('version');
    if (!error) {
      console.log('PostgreSQL version:', data);
    }
    
    return false;
  } catch (e) {
    console.log('pg error:', e.message);
    return false;
  }
}

async function main() {
  const sql = `
CREATE TABLE IF NOT EXISTS public.schedule_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  date date NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, date)
);

CREATE TABLE IF NOT EXISTS public.schedule_note_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id uuid NOT NULL REFERENCES public.schedule_notes(id) ON DELETE CASCADE,
  content text,
  action text NOT NULL DEFAULT 'created',
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_notes_org_date ON public.schedule_notes(org_id, date);
CREATE INDEX IF NOT EXISTS idx_schedule_note_history_note ON public.schedule_note_history(note_id);

ALTER TABLE public.schedule_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_note_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access schedule_notes"
  ON public.schedule_notes FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access schedule_note_history"
  ON public.schedule_note_history FOR ALL USING (true) WITH CHECK (true);
  `;

  console.log('Attempting to run SQL via Management API...');
  const success = await runSQLViaManagementAPI(sql);
  
  if (!success) {
    console.log('\\n=== Could not run SQL automatically ===');
    console.log('The table needs to be created manually in the Supabase Dashboard.');
    console.log('Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
    console.log('\\nSQL to run:');
    console.log(sql);
  }
}

main().catch(console.error);
