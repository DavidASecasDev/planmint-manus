import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'public' }
});

async function migrate() {
  console.log('Adding new columns to service_requests table...');
  
  // We can't run raw SQL via PostgREST, so we'll use a workaround:
  // Try to update a non-existent row with the new columns to test if they exist
  // If they don't exist, we need to use the Supabase dashboard or pg connection
  
  // Let's test if columns exist by trying to select them
  const { data, error } = await supabase
    .from('service_requests')
    .select('id')
    .limit(1);
  
  console.log('Table exists:', !error);
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Try selecting new columns
  const { error: colErr } = await supabase
    .from('service_requests')
    .select('id, client_email')
    .limit(1);
  
  if (colErr && colErr.code === '42703') {
    console.log('New columns do NOT exist yet. Need to add them via SQL.');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log(`
ALTER TABLE service_requests 
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS passport_url text,
  ADD COLUMN IF NOT EXISTS driving_license_url text;
    `);
  } else {
    console.log('Columns already exist or different error:', colErr);
  }
}

migrate();
