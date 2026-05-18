import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema: 'public' }
});

async function executeSQLViaAPI(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceRoleKey,
      'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ sql })
  });
  const text = await response.text();
  console.log(`exec_sql status: ${response.status}, body: ${text}`);
  return response.status;
}

async function run() {
  console.log('=== Creating schedule_notes table ===');
  
  // Step 1: Create a temporary function that creates the tables
  const createFnSQL = `
    CREATE OR REPLACE FUNCTION _create_schedule_notes_tables()
    RETURNS void AS $$
    BEGIN
      -- Create schedule_notes table
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
      
      -- Create schedule_note_history table
      CREATE TABLE IF NOT EXISTS public.schedule_note_history (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        note_id uuid NOT NULL REFERENCES public.schedule_notes(id) ON DELETE CASCADE,
        content text,
        action text NOT NULL DEFAULT 'created',
        changed_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_schedule_notes_org_date ON public.schedule_notes(org_id, date);
      CREATE INDEX IF NOT EXISTS idx_schedule_note_history_note ON public.schedule_note_history(note_id);
      
      -- Enable RLS
      ALTER TABLE public.schedule_notes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.schedule_note_history ENABLE ROW LEVEL SECURITY;
      
      -- RLS policies
      DROP POLICY IF EXISTS "Service role full access schedule_notes" ON public.schedule_notes;
      CREATE POLICY "Service role full access schedule_notes"
        ON public.schedule_notes FOR ALL USING (true) WITH CHECK (true);
        
      DROP POLICY IF EXISTS "Service role full access schedule_note_history" ON public.schedule_note_history;
      CREATE POLICY "Service role full access schedule_note_history"
        ON public.schedule_note_history FOR ALL USING (true) WITH CHECK (true);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  console.log('Step 1: Creating helper function...');
  const status1 = await executeSQLViaAPI(createFnSQL);
  
  if (status1 !== 200) {
    console.log('exec_sql not available, trying direct rpc approach...');
    
    // Alternative: try to just insert into the table to see if it exists
    const { data: testData, error: testError } = await supabase
      .from('schedule_notes')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('Table does not exist yet. Error:', testError.message);
      console.log('');
      console.log('=== MANUAL SQL REQUIRED ===');
      console.log('Please run the following SQL in the Supabase Dashboard SQL Editor:');
      console.log('');
      console.log(`
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
      `);
    } else {
      console.log('Table already exists! Data:', testData);
    }
    return;
  }
  
  // Step 2: Call the function
  console.log('Step 2: Executing function...');
  const { data, error } = await supabase.rpc('_create_schedule_notes_tables');
  if (error) {
    console.log('RPC error:', error.message);
  } else {
    console.log('Tables created successfully!');
  }
  
  // Step 3: Clean up the function
  console.log('Step 3: Cleaning up...');
  await executeSQLViaAPI('DROP FUNCTION IF EXISTS _create_schedule_notes_tables();');
  
  // Verify
  const { data: verifyData, error: verifyError } = await supabase
    .from('schedule_notes')
    .select('id')
    .limit(1);
  
  if (verifyError) {
    console.log('Verification failed:', verifyError.message);
  } else {
    console.log('Verification successful! Table is accessible.');
  }
}

run().catch(console.error);
