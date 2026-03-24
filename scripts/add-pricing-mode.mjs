import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  // 1. Add pricing_mode column to transfer_requests
  console.log('Adding pricing_mode column to transfer_requests...');
  const { error: err1 } = await supabase.rpc('exec_sql', {
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'transfer_requests' AND column_name = 'pricing_mode'
        ) THEN
          ALTER TABLE transfer_requests 
          ADD COLUMN pricing_mode TEXT DEFAULT 'zone_tariff';
        END IF;
      END $$;
    `
  });
  
  if (err1) {
    // Try direct approach - Supabase may not have exec_sql RPC
    console.log('RPC not available, trying via postgrest...');
    
    // Check if column exists by querying
    const { data: testData, error: testErr } = await supabase
      .from('transfer_requests')
      .select('id, pricing_mode')
      .limit(1);
    
    if (testErr && testErr.message.includes('pricing_mode')) {
      console.log('Column does not exist, need to add it via SQL...');
      // We'll need to use the Supabase SQL editor API or psql
    } else if (!testErr) {
      console.log('Column pricing_mode already exists!');
    } else {
      console.error('Unexpected error:', testErr);
    }
  } else {
    console.log('pricing_mode column added successfully');
  }

  // 2. Add provider_cost column to transfer_items  
  console.log('Checking provider_cost column on transfer_items...');
  const { data: itemTest, error: itemErr } = await supabase
    .from('transfer_items')
    .select('id, provider_cost')
    .limit(1);
  
  if (itemErr && itemErr.message.includes('provider_cost')) {
    console.log('provider_cost column does not exist on transfer_items');
  } else if (!itemErr) {
    console.log('provider_cost column already exists on transfer_items!');
  } else {
    console.error('Error checking transfer_items:', itemErr);
  }

  // 3. Check current state
  const { data: requests, error: reqErr } = await supabase
    .from('transfer_requests')
    .select('id, pricing_mode, provider_cost, client_total, internal_margin')
    .limit(5);
  
  if (reqErr) {
    console.error('Error querying transfer_requests:', reqErr);
  } else {
    console.log('Sample transfer_requests:', JSON.stringify(requests, null, 2));
  }
}

run().catch(console.error);
