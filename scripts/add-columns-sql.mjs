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

async function runSQL(sql) {
  // Use the Supabase PostgREST rpc endpoint to execute raw SQL
  // Since exec_sql doesn't exist, we'll create a temporary function
  const { data, error } = await supabase.rpc('_exec_sql_temp', { query: sql });
  return { data, error };
}

async function createExecFunction() {
  // First, try to create a helper function via PostgREST
  // This won't work directly - we need another approach
  
  // Alternative: Use the Supabase HTTP API directly
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceRoleKey,
      'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({})
  });
  
  console.log('Response status:', response.status);
}

// Alternative approach: use pg directly through the connection string
// But we don't have the direct connection string, so let's use a workaround

// The simplest approach: create the columns via Supabase client by attempting an insert
// with the new column and catching the error, then using the Supabase Dashboard SQL editor

// Actually, let's try using the Supabase SQL API endpoint
async function executeSQLViaAPI(sql) {
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  // Try the SQL endpoint
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
  console.log(`Status: ${response.status}, Body: ${text}`);
  return response.status;
}

async function run() {
  // Try different approaches to add columns
  
  // Approach 1: Try creating a temporary SQL execution function
  console.log('Approach 1: Creating temporary exec function...');
  const createFnSQL = `
    CREATE OR REPLACE FUNCTION _temp_add_columns()
    RETURNS void AS $$
    BEGIN
      -- Add pricing_mode to transfer_requests
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transfer_requests' AND column_name = 'pricing_mode'
      ) THEN
        ALTER TABLE public.transfer_requests ADD COLUMN pricing_mode TEXT DEFAULT 'zone_tariff';
      END IF;
      
      -- Add provider_cost to transfer_items
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transfer_items' AND column_name = 'provider_cost'
      ) THEN
        ALTER TABLE public.transfer_items ADD COLUMN provider_cost NUMERIC DEFAULT NULL;
      END IF;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  await executeSQLViaAPI(createFnSQL);
  
  // Approach 2: Try calling the function
  console.log('Approach 2: Calling function...');
  const { data, error } = await supabase.rpc('_temp_add_columns');
  if (error) {
    console.log('RPC error:', error.message);
  } else {
    console.log('Function executed successfully!');
  }
}

run().catch(console.error);
