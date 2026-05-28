import { createClient } from '@supabase/supabase-js';

// Get Rently credentials from Supabase settings
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://quilsunfhfqqnibheqzl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function getRentlyCredentials() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await supabase.from('settings').select('*').eq('key', 'rently_credentials').single();
  if (!data) {
    // Try to get from env or hardcoded
    throw new Error('No rently credentials found in settings');
  }
  return JSON.parse(data.value);
}

async function getRentlyToken() {
  // Read from the rentlyHub.ts pattern
  const fs = await import('fs');
  const path = await import('path');
  
  // Look for .env file or use the existing token mechanism
  const envPath = path.join(process.cwd(), '.env');
  let host, user, pass;
  
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf-8');
    const lines = env.split('\n');
    for (const line of lines) {
      if (line.startsWith('RENTLY_HOST=')) host = line.split('=')[1]?.trim();
      if (line.startsWith('RENTLY_USER=')) user = line.split('=')[1]?.trim();
      if (line.startsWith('RENTLY_PASS=')) pass = line.split('=')[1]?.trim();
    }
  }
  
  // Fallback: read from rentlyHub.ts source to find the credentials pattern
  if (!host) {
    // Read from Supabase settings table
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: settings } = await supabase.from('settings').select('*');
    console.log('Available settings:', settings?.map(s => s.key));
    
    const rentlySetting = settings?.find(s => s.key === 'rently_credentials' || s.key === 'rently_config' || s.key?.includes('rently'));
    if (rentlySetting) {
      console.log('Found rently setting:', rentlySetting.key);
      const val = typeof rentlySetting.value === 'string' ? JSON.parse(rentlySetting.value) : rentlySetting.value;
      host = val.host || val.url;
      user = val.user || val.username || val.email;
      pass = val.pass || val.password;
    }
  }
  
  if (!host) {
    throw new Error('Could not find Rently credentials');
  }
  
  console.log('Host:', host);
  
  // Get token
  const tokenRes = await fetch(`https://${host}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=password&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`
  });
  
  const tokenData = await tokenRes.json();
  return { token: tokenData.access_token, host };
}

async function main() {
  const { token, host } = await getRentlyToken();
  const baseUrl = `https://${host}`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  // Test the exact endpoints from Swagger
  const endpoints = [
    { method: 'GET', path: '/api/services/types' },
    { method: 'GET', path: '/api/services/1' },
  ];
  
  for (const ep of endpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${ep.method} ${baseUrl}${ep.path}`);
    console.log('='.repeat(60));
    
    const res = await fetch(`${baseUrl}${ep.path}`, { method: ep.method, headers });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(text.substring(0, 500));
    }
  }
  
  // Also try to get a car by plate to see the CarId format
  console.log(`\n${'='.repeat(60)}`);
  console.log('GET /api/cars - looking for car with plate 2691MTL');
  console.log('='.repeat(60));
  
  const carsRes = await fetch(`${baseUrl}/api/cars`, { headers });
  console.log(`Status: ${carsRes.status}`);
  if (carsRes.ok) {
    const cars = await carsRes.json();
    const target = cars.find(c => c.CurrentPlate === '2691MTL' || c.Plate === '2691MTL' || (c.CurrentPlate && c.CurrentPlate.includes('2691')));
    if (target) {
      console.log('Found car:', JSON.stringify(target, null, 2));
    } else {
      console.log(`Total cars: ${cars.length}`);
      if (cars.length > 0) {
        console.log('First car sample:', JSON.stringify(cars[0], null, 2));
        // Search all plates
        const withPlate = cars.filter(c => c.CurrentPlate);
        console.log(`\nCars with plates: ${withPlate.length}`);
        const match = withPlate.find(c => c.CurrentPlate.includes('2691'));
        if (match) console.log('Matched:', JSON.stringify(match, null, 2));
      }
    }
  }
}

main().catch(console.error);
