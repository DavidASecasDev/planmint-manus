/**
 * Add rently_service_id column to repairs table in Supabase.
 * Uses the Supabase Management API or direct pg connection.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Supabase doesn't expose raw SQL via REST, but we can use the pg_net extension
// or create a helper function. Let's try a different approach:
// We'll use the Supabase SQL editor API (management API)

// Actually, let's just use the Supabase project's database connection string
// from the dashboard. Since we have the service role key, we can use
// the pg endpoint at /pg/query

async function main() {
  // Try the Supabase Management API approach
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  console.log('Project ref:', projectRef);
  
  // Alternative: Use pg2 package to connect directly
  // The Supabase postgres connection is at db.{ref}.supabase.co:5432
  // But we need the database password which is different from the service role key
  
  // Let's try using the PostgREST approach - create a function first
  // Actually, the simplest approach is to use the Supabase Dashboard SQL editor API
  
  // For now, let's just verify the column doesn't exist and provide manual instructions
  const { data, error } = await supabase
    .from('repairs')
    .select('id')
    .limit(1);
  
  if (error) {
    console.error('Error accessing repairs:', error);
  } else {
    console.log('Repairs table accessible, sample:', data);
  }
  
  // Try to select the column to see if it exists
  const { error: colError } = await supabase
    .from('repairs')
    .select('rently_service_id')
    .limit(1);
  
  if (colError && colError.code === '42703') {
    console.log('\nColumn rently_service_id does NOT exist yet.');
    console.log('Need to add it via SQL:');
    console.log('ALTER TABLE repairs ADD COLUMN rently_service_id INTEGER DEFAULT NULL;');
  } else if (!colError) {
    console.log('\nColumn rently_service_id already exists!');
  } else {
    console.log('\nUnexpected error:', colError);
  }
}

main();
