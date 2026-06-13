import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://quilsunfhfqqnibheqzl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aWxzdW5maGZxcW5pYmhlcXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MDk0OTgsImV4cCI6MjA4MDk4NTQ5OH0.dZPc_kv0qlYnGp3EvLhD2sjBAsoeRlSihfedYjDoroQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get one reservation and see all its columns
const { data, error } = await supabase
  .from('reservations')
  .select('*')
  .limit(1);

if (error) {
  console.log('Error:', JSON.stringify(error, null, 2));
} else if (data && data.length > 0) {
  console.log('Columns:', Object.keys(data[0]).sort().join('\n'));
}
