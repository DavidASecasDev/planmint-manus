import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('service_requests').select('id').limit(1);
console.log('Data:', data);
console.log('Error:', error);
