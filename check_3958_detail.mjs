import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from('reservations')
  .select('id, external_reservation_id, extras_contratados, rently_detail_synced_at, cliente_nombre, cliente_apellido')
  .eq('external_reservation_id', '3958')
  .limit(5);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Results:', JSON.stringify(data, null, 2));
}
