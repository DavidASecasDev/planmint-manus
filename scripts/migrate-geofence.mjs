import dotenv from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

dotenv.config();

const projectRef = 'exayzwdudssyegxjiyrk';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `
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

async function main() {
  // Try different pooler regions
  const regions = ['eu-central-1', 'us-east-1', 'ap-southeast-1', 'eu-west-2', 'eu-west-1'];
  
  for (const region of regions) {
    const connStr = `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    console.log(`Trying region: ${region}...`);
    
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    
    try {
      await client.connect();
      console.log(`  Connected to ${region}!`);
      await client.query(SQL);
      console.log('  Tables created successfully!');
      await client.end();
      return;
    } catch (e) {
      console.log(`  Failed: ${e.message.substring(0, 100)}`);
      try { await client.end(); } catch {}
    }
  }
  
  // Try direct connection (port 5432)
  console.log('\nTrying direct connection (port 5432)...');
  const directConn = `postgresql://postgres.${projectRef}:${serviceKey}@db.${projectRef}.supabase.co:5432/postgres`;
  const client = new Client({
    connectionString: directConn,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  
  try {
    await client.connect();
    console.log('  Connected directly!');
    await client.query(SQL);
    console.log('  Tables created successfully!');
    await client.end();
  } catch (e) {
    console.log(`  Failed: ${e.message.substring(0, 100)}`);
    try { await client.end(); } catch {}
    console.log('\n\nCould not connect. Please run the SQL in Supabase SQL Editor.');
  }
}

main().catch(console.error);
