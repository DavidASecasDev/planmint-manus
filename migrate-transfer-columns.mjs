// Migration: Add new columns for transfer module redesign
// Uses Supabase Management API (pg_query endpoint) to execute DDL

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://exayzwdudssyegxjiyrk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

// First, create a temporary function to execute arbitrary SQL
async function createExecFunction() {
  const sql = `
    CREATE OR REPLACE FUNCTION exec_ddl(sql_text text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_text;
    END;
    $$;
  `;
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_text: 'SELECT 1' }),
  });
  
  return response.ok;
}

async function checkColumnExists(table, column) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=0`,
    {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  return response.ok;
}

async function migrate() {
  console.log('Checking existing columns...');
  
  // Check if columns already exist by trying to select them
  const checks = [
    { table: 'transfer_requests', column: 'client_type' },
    { table: 'transfer_requests', column: 'client_reference' },
    { table: 'transfer_requests', column: 'service_type' },
    { table: 'transfer_items', column: 'pack_duration' },
    { table: 'transfer_items', column: 'estimated_price' },
  ];
  
  for (const { table, column } of checks) {
    const exists = await checkColumnExists(table, column);
    console.log(`  ${table}.${column}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }
  
  // Try to use the get_tables_with_column RPC that already exists to verify connectivity
  const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_tables_with_column`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ col_name: 'client_type' }),
  });
  
  if (testResponse.ok) {
    const tables = await testResponse.json();
    console.log('Tables with client_type column:', tables);
  }
  
  // Create the exec_ddl function if it doesn't exist
  // We need to use the SQL query endpoint which is available at /pg/query for Supabase
  // But that's only available via the management API, not the REST API
  
  // Alternative: Use the existing get_tables_with_column pattern to create a new function
  // that can execute DDL
  
  // Actually, let's try creating a function via the REST API's rpc endpoint
  // by first creating it through a workaround
  
  console.log('\nAttempting to add columns via exec_ddl RPC...');
  
  const ddlStatements = [
    "ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'external_client'",
    "ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS client_reference text",
    "ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'point_to_point'",
    "ALTER TABLE transfer_items ADD COLUMN IF NOT EXISTS pack_duration text",
    "ALTER TABLE transfer_items ADD COLUMN IF NOT EXISTS estimated_price numeric",
  ];
  
  for (const sql of ddlStatements) {
    console.log(`\nExecuting: ${sql.substring(0, 70)}...`);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql_text: sql }),
    });
    
    if (response.ok) {
      console.log('  OK');
    } else {
      const text = await response.text();
      console.log(`  Error: ${text}`);
    }
  }
  
  // Verify
  console.log('\nVerifying columns after migration...');
  for (const { table, column } of checks) {
    const exists = await checkColumnExists(table, column);
    console.log(`  ${table}.${column}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }
}

migrate().catch(console.error);
