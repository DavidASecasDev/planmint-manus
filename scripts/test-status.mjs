import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await client.from('service_requests').select('id').limit(1).single();
  const id = data.id;
  
  // Try updating to in_progress
  const { error } = await client.from('service_requests').update({ status: 'in_progress' }).eq('id', id);
  if (error) {
    console.log('Update to in_progress FAILED:', error.message);
  } else {
    console.log('Update to in_progress SUCCESS');
    // Revert back
    await client.from('service_requests').update({ status: 'approved' }).eq('id', id);
    console.log('Reverted back to approved');
  }
}

run();
