import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  console.log('DATABASE_URL available:', !!dbUrl);
  
  if (dbUrl) {
    // Use pg directly
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const sql = `
      ALTER TABLE en_camino_tracking 
      ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sharing_location BOOLEAN DEFAULT FALSE;
    `;
    
    const result = await client.query(sql);
    console.log('Columns added successfully:', result.command);
    
    // Verify
    const verify = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'en_camino_tracking' 
      ORDER BY ordinal_position;
    `);
    console.log('Current columns:');
    verify.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    await client.end();
  } else {
    console.log('No DATABASE_URL available. Need to add columns via Supabase SQL Editor.');
    console.log('Go to: https://supabase.com/dashboard/project/exayzwdudssyegxjiyrk/sql/new');
    console.log('Run this SQL:');
    console.log(`
ALTER TABLE en_camino_tracking 
ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sharing_location BOOLEAN DEFAULT FALSE;
    `);
  }
}

main().catch(console.error);
