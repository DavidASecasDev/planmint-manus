/**
 * Migration script: Create geofences, geofence_alerts, and geofence_vehicle_state tables in Supabase.
 * Run with: node scripts/create-geofence-tables.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env file
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(sql, label) {
  console.log(`\n--- ${label} ---`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // Try alternative: use the REST API directly
    console.log(`  RPC not available, trying direct fetch...`);
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.log(`  Direct fetch also failed: ${text}`);
      return false;
    }
    console.log(`  ✓ Success via direct fetch`);
    return true;
  }
  console.log(`  ✓ Success`);
  return true;
}

async function createTablesViaInsert() {
  // Since we can't run DDL via RPC, let's test if the tables already exist
  // by trying to select from them
  console.log('\nChecking if geofences table exists...');
  const { data, error } = await supabase.from('geofences').select('id').limit(1);
  if (!error) {
    console.log('✓ geofences table already exists');
  } else if (error.code === '42P01') {
    console.log('✗ geofences table does not exist - needs to be created via Supabase dashboard SQL editor');
    console.log('\nPlease run the following SQL in the Supabase SQL Editor:');
    console.log(getCreateSQL());
    return false;
  } else {
    console.log(`  Unexpected error: ${error.message} (code: ${error.code})`);
  }

  console.log('\nChecking if geofence_alerts table exists...');
  const { error: err2 } = await supabase.from('geofence_alerts').select('id').limit(1);
  if (!err2) {
    console.log('✓ geofence_alerts table already exists');
  } else if (err2.code === '42P01') {
    console.log('✗ geofence_alerts table does not exist');
    return false;
  }

  console.log('\nChecking if geofence_vehicle_state table exists...');
  const { error: err3 } = await supabase.from('geofence_vehicle_state').select('id').limit(1);
  if (!err3) {
    console.log('✓ geofence_vehicle_state table already exists');
  } else if (err3.code === '42P01') {
    console.log('✗ geofence_vehicle_state table does not exist');
    return false;
  }

  return true;
}

function getCreateSQL() {
  return `
-- Table: geofences (geographic zones for alerts)
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

-- Table: geofence_alerts (history of enter/exit events)
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

-- Table: geofence_vehicle_state (tracks whether each vehicle is inside/outside each geofence)
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
  console.log('=== Geofence Tables Migration ===');
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  const exists = await createTablesViaInsert();
  if (!exists) {
    console.log('\n\n========================================');
    console.log('SQL to run in Supabase SQL Editor:');
    console.log('========================================');
    console.log(getCreateSQL());
  } else {
    console.log('\n✓ All geofence tables exist!');
  }
}

main().catch(console.error);
