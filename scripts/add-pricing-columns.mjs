/**
 * Add pricing_mode column to transfer_requests
 * and provider_cost column to transfer_items
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const SQL_STATEMENTS = [
  // Add pricing_mode to transfer_requests (default zone_tariff)
  `ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'zone_tariff'`,
  
  // Add provider_cost to transfer_items (per-item provider cost before any markup)
  `ALTER TABLE public.transfer_items ADD COLUMN IF NOT EXISTS provider_cost NUMERIC DEFAULT NULL`,
];

async function executeSQL(sql) {
  // Try RPC first
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (!error) {
    return { success: true };
  }
  
  // Try REST endpoint
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });
    
    if (response.ok) {
      return { success: true };
    }
    
    const text = await response.text();
    return { success: false, error: text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('=== Adding pricing columns to Supabase ===\n');
  
  for (const sql of SQL_STATEMENTS) {
    console.log(`Executing: ${sql.substring(0, 80)}...`);
    const result = await executeSQL(sql);
    if (result.success) {
      console.log('  ✓ Success');
    } else {
      console.log(`  ✗ Failed: ${result.error?.substring(0, 200)}`);
    }
  }
  
  // Verify columns exist
  console.log('\n=== Verification ===');
  
  const { data: reqTest, error: reqErr } = await supabase
    .from('transfer_requests')
    .select('id, pricing_mode')
    .limit(1);
  
  if (reqErr) {
    console.log(`transfer_requests.pricing_mode: ✗ ${reqErr.message}`);
  } else {
    console.log(`transfer_requests.pricing_mode: ✓ exists (sample: ${JSON.stringify(reqTest)})`);
  }
  
  const { data: itemTest, error: itemErr } = await supabase
    .from('transfer_items')
    .select('id, provider_cost')
    .limit(1);
  
  if (itemErr) {
    console.log(`transfer_items.provider_cost: ✗ ${itemErr.message}`);
  } else {
    console.log(`transfer_items.provider_cost: ✓ exists (sample: ${JSON.stringify(itemTest)})`);
  }
  
  // Save SQL for manual execution if needed
  const fs = await import('fs');
  const sqlContent = SQL_STATEMENTS.join(';\n') + ';';
  fs.writeFileSync('/home/ubuntu/planmint-preview/scripts/add-pricing-columns.sql', sqlContent, 'utf-8');
  console.log('\nSQL saved to scripts/add-pricing-columns.sql for manual execution if needed.');
}

main().catch(console.error);
