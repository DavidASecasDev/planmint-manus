import { createClient } from '@supabase/supabase-js';

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await client
    .from('service_requests')
    .select('id, client_email, client_address, passport_url, driving_license_url')
    .limit(1);
  
  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('SUCCESS: All new columns exist');
    console.log('Data:', data);
  }
}

run();
