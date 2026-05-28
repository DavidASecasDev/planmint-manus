/**
 * Find cars by plate in Rently to understand the CarId format.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: settings } = await supabase
    .from('integration_settings')
    .select('rently_api_host, rently_client_id, rently_client_secret')
    .limit(1)
    .single();

  const host = settings.rently_api_host || 'azul.rently.com.ar';

  const tokenRes = await fetch(`https://${host}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: settings.rently_client_id,
      client_secret: settings.rently_client_secret,
    }),
  });

  const { access_token: token } = await tokenRes.json();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // Get cars with pagination
  const res = await fetch(`https://${host}/api/cars?Limit=200&Offset=0`, { headers });
  const data = await res.json();
  const cars = data.Results || data;
  
  console.log(`Total cars: ${data.Total || cars.length}`);
  console.log(`First car keys:`, Object.keys(cars[0]));
  console.log(`\nFirst car sample:`);
  console.log(JSON.stringify(cars[0], null, 2));
  
  // The CarId in services is a string like "9589MTB" — it's the PLATE!
  // Let's verify by finding 2691MTL
  const target = cars.find(c => {
    const plate = c.CurrentPlate || c.Plate || c.Id || '';
    return String(plate).includes('2691');
  });
  
  if (target) {
    console.log('\n\nFound 2691MTL car:');
    console.log(JSON.stringify(target, null, 2));
  } else {
    // Show plates
    console.log('\nSample plates (first 30):');
    cars.slice(0, 30).forEach(c => {
      console.log(`  Id=${c.Id}, CurrentPlate=${c.CurrentPlate}, Plate=${c.Plate}`);
    });
  }
}

main().catch(console.error);
