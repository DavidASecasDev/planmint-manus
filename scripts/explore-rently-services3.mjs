/**
 * Explore Rently Services API using the same auth mechanism as the app.
 * We read credentials from the integration_settings table via Supabase.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  console.log('Trying to read from .env file...');
}

// Read .env
import { readFileSync } from 'fs';
import { join } from 'path';

let envVars = {};
try {
  const envContent = readFileSync(join(process.cwd(), '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) envVars[key.trim()] = rest.join('=').trim();
  }
} catch {}

const supabaseUrl = SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseKey = SUPABASE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Cannot find Supabase credentials. Exiting.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Get Rently credentials from integration_settings
  const { data: settings, error } = await supabase
    .from('integration_settings')
    .select('organization_id, rently_api_host, rently_client_id, rently_client_secret')
    .limit(1)
    .single();

  if (error || !settings) {
    console.error('Failed to get integration_settings:', error);
    process.exit(1);
  }

  const host = settings.rently_api_host || 'azul.rently.com.ar';
  const clientId = settings.rently_client_id;
  const clientSecret = settings.rently_client_secret;

  console.log(`Host: ${host}`);
  console.log(`Org: ${settings.organization_id}`);

  // 2. Get token
  const tokenRes = await fetch(`https://${host}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    console.error('Token failed:', await tokenRes.text());
    process.exit(1);
  }

  const { access_token: token } = await tokenRes.json();
  console.log('Token obtained successfully\n');

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // 3. Test service endpoints from Swagger docs
  const endpoints = [
    { method: 'GET', path: '/api/services/types', desc: 'Get all service types' },
    { method: 'GET', path: '/api/services/1', desc: 'Get service by ID (test)' },
  ];

  for (const ep of endpoints) {
    console.log('='.repeat(60));
    console.log(`${ep.method} ${ep.path} — ${ep.desc}`);
    console.log('='.repeat(60));

    const res = await fetch(`https://${host}${ep.path}`, { method: ep.method, headers });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(text.substring(0, 500));
    }
    console.log('');
  }

  // 4. Get a car by plate to understand the CarId format
  console.log('='.repeat(60));
  console.log('GET /api/cars — looking for 2691MTL');
  console.log('='.repeat(60));

  const carsRes = await fetch(`https://${host}/api/cars?Limit=200`, { headers });
  if (carsRes.ok) {
    const carsData = await carsRes.json();
    const cars = carsData.Results || carsData;
    console.log(`Total cars returned: ${Array.isArray(cars) ? cars.length : 'N/A'}`);
    
    if (Array.isArray(cars) && cars.length > 0) {
      // Find the target car
      const target = cars.find(c => 
        c.CurrentPlate === '2691MTL' || 
        c.Plate === '2691MTL' || 
        (c.CurrentPlate && c.CurrentPlate.includes('2691'))
      );
      
      if (target) {
        console.log('\nFound target car (2691MTL):');
        console.log(JSON.stringify(target, null, 2));
      } else {
        // Show first car as sample
        console.log('\nFirst car sample (to understand structure):');
        console.log(JSON.stringify(cars[0], null, 2));
        
        // List all plates
        const plates = cars.map(c => `${c.Id}: ${c.CurrentPlate || c.Plate || 'NO_PLATE'}`);
        console.log(`\nAll car IDs and plates (first 20):`);
        plates.slice(0, 20).forEach(p => console.log(`  ${p}`));
      }
    }
  } else {
    console.log(`Cars request failed: ${carsRes.status}`);
  }
}

main().catch(console.error);
