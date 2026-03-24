/**
 * Add pricing columns using Supabase service role client
 * Strategy: Create a PL/pgSQL function via PostgREST, then call it
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false },
});

async function main() {
  console.log('=== Pricing Migration ===\n');

  // Step 1: Create a helper function for running DDL
  // We use the Supabase SQL API endpoint (available since Supabase v2)
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  // Try the Supabase platform SQL endpoint
  const sqlEndpoints = [
    `https://${projectRef}.supabase.co/rest/v1/rpc/pgmigrate`,
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  ];

  const ddlSQL = `
    ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'zone_tariff';
    ALTER TABLE public.transfer_items ADD COLUMN IF NOT EXISTS provider_cost NUMERIC DEFAULT NULL;
  `;

  // Approach: Use the Supabase dashboard SQL API
  console.log('Trying Supabase platform API...');
  for (const endpoint of sqlEndpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: ddlSQL }),
      });
      console.log(`  ${endpoint}: ${resp.status}`);
      if (resp.ok) {
        console.log('  ✓ Success!');
        break;
      }
      const text = await resp.text();
      console.log(`  Response: ${text.substring(0, 200)}`);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  // Approach 2: Create a temporary function using PostgREST
  // This requires that the function is already created in the DB
  // Let's try a different approach: use the Supabase client to create a migration
  
  // Approach 3: Use node-postgres directly
  console.log('\nTrying direct PostgreSQL connection...');
  try {
    const pg = await import('pg');
    const Pool = pg.default.Pool || pg.Pool;
    
    // Supabase direct connection
    const pool = new Pool({
      connectionString: `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
      ssl: { rejectUnauthorized: false },
    });
    
    const client = await pool.connect();
    console.log('  Connected!');
    
    await client.query(`ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'zone_tariff'`);
    console.log('  ✓ pricing_mode column added');
    
    await client.query(`ALTER TABLE public.transfer_items ADD COLUMN IF NOT EXISTS provider_cost NUMERIC DEFAULT NULL`);
    console.log('  ✓ provider_cost column added');
    
    client.release();
    await pool.end();
  } catch (err) {
    console.log(`  PostgreSQL error: ${err.message}`);
    
    // Try port 6543 (transaction pooler)
    console.log('\nTrying port 6543 (transaction pooler)...');
    try {
      const pg = await import('pg');
      const Pool = pg.default.Pool || pg.Pool;
      
      const pool = new Pool({
        connectionString: `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false },
      });
      
      const client = await pool.connect();
      console.log('  Connected!');
      
      await client.query(`ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'zone_tariff'`);
      console.log('  ✓ pricing_mode column added');
      
      await client.query(`ALTER TABLE public.transfer_items ADD COLUMN IF NOT EXISTS provider_cost NUMERIC DEFAULT NULL`);
      console.log('  ✓ provider_cost column added');
      
      client.release();
      await pool.end();
    } catch (err2) {
      console.log(`  Error: ${err2.message}`);
    }
  }

  // Verify
  console.log('\n=== Verification ===');
  const { data: r1, error: e1 } = await supabase.from('transfer_requests').select('id, pricing_mode').limit(1);
  console.log(`pricing_mode: ${e1 ? '✗ ' + e1.message : '✓ exists'}`);
  
  const { data: r2, error: e2 } = await supabase.from('transfer_items').select('id, provider_cost').limit(1);
  console.log(`provider_cost: ${e2 ? '✗ ' + e2.message : '✓ exists'}`);
}

main().catch(console.error);
