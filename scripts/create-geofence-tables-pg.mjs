/**
 * Create geofence tables in Supabase PostgreSQL.
 * Uses the Supabase connection pooler (port 6543) with the service role key as password.
 */
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
console.log('Project ref:', projectRef);

// Supabase pooler connection string format:
// postgresql://postgres.{ref}:{service_role_key}@aws-0-{region}.pooler.supabase.com:6543/postgres
// We'll try the transaction mode pooler

// Alternative: use supabase-js to call a raw SQL function
// Since exec_sql doesn't exist, let's create it first via the REST API
// Actually, let's try the Supabase SQL API endpoint that accepts raw SQL

// The Supabase platform has a /pg endpoint for direct SQL execution
// Available at: POST {supabase_url}/pg with Authorization: Bearer {service_role_key}
async function tryDirectSQL(sql) {
  // Try the undocumented /rest/v1/ endpoint with raw SQL via RPC
  // Actually, Supabase has a /sql endpoint in newer versions
  const endpoints = [
    '/rest/v1/rpc/exec_sql',
    '/pg/query',
  ];
  
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(supabaseUrl + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': 'Bearer ' + serviceKey,
        },
        body: JSON.stringify({ query: sql, sql_query: sql }),
      });
      console.log(`${endpoint}: ${resp.status}`);
      if (resp.ok) {
        const data = await resp.text();
        console.log('Success:', data.substring(0, 200));
        return true;
      }
    } catch (e) {
      console.log(`${endpoint}: Error - ${e.message}`);
    }
  }
  return false;
}

// Try using pg package directly
async function tryPgDirect() {
  try {
    const { default: pg } = await import('pg');
    
    // Supabase direct connection (port 5432) or pooler (port 6543)
    // Format: postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres
    const connectionString = `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
    
    console.log('Trying pg connection to pooler...');
    const client = new pg.Client({ 
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    
    await client.connect();
    console.log('Connected!');
    
    // Run DDL
    await client.query(getCreateSQL());
    console.log('Tables created successfully!');
    
    await client.end();
    return true;
  } catch (e) {
    console.log('pg connection failed:', e.message);
    return false;
  }
}

function getCreateSQL() {
  return `
CREATE TABLE IF NOT EXISTS geofences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('circle', 'polygon')),
  center_lat double precision,
  center_lng double precision,
  radius_meters double precision,
  coordinates jsonb,
  color text NOT NULL DEFAULT '#3B82F6',
  opacity double precision NOT NULL DEFAULT 0.2,
  is_active boolean NOT NULL DEFAULT true,
  alert_on_enter boolean NOT NULL DEFAULT true,
  alert_on_exit boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_geofences_org ON geofences(organization_id);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON geofences(organization_id, is_active);

CREATE TABLE IF NOT EXISTS geofence_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  vehicle_id text NOT NULL,
  vehicle_plate text,
  device_id text,
  event_type text NOT NULL CHECK (event_type IN ('enter', 'exit')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed double precision,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_alerts_org ON geofence_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_geofence ON geofence_alerts(geofence_id);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_vehicle ON geofence_alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_time ON geofence_alerts(triggered_at DESC);

CREATE TABLE IF NOT EXISTS geofence_vehicle_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  vehicle_id text,
  is_inside boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  last_transition_at timestamptz,
  UNIQUE(geofence_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_geofence_vehicle_state_org ON geofence_vehicle_state(organization_id);
CREATE INDEX IF NOT EXISTS idx_geofence_vehicle_state_device ON geofence_vehicle_state(device_id);
`;
}

async function main() {
  console.log('=== Create Geofence Tables ===\n');
  
  // Try pg direct connection first
  const installed = await tryPgDirect();
  if (installed) {
    console.log('\n✓ All tables created via pg!');
    return;
  }
  
  // Try REST API
  console.log('\nTrying REST API...');
  const restOk = await tryDirectSQL('SELECT 1');
  if (!restOk) {
    console.log('\n✗ Could not connect. Please run the SQL manually in Supabase SQL Editor.');
    console.log('\nSQL:\n' + getCreateSQL());
  }
}

main().catch(console.error);
