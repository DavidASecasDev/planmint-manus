import pg from 'pg';
const { Client } = pg;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use Supabase pooler in session mode (port 5432) with the project ref in the user
// Format: postgres.[project-ref] as user, database password as password
// But since we only have the service role key, we need the actual DB password
// Let's try the Supabase Management API instead

// Alternative: Use the Supabase JS client with a workaround
// The Supabase JS client can call stored functions, but we need to create one first
// OR we can use the pooler with the correct credentials

// The pooler session mode uses port 5432 and transaction mode uses 6543
const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.exayzwdudssyegxjiyrk',
  password: serviceRoleKey,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('Connected to Supabase Postgres via pooler!');
  
  await client.query('ALTER TABLE reservations ADD COLUMN IF NOT EXISTS shuttle_entrega boolean DEFAULT false');
  console.log('Added shuttle_entrega column');
  
  await client.query('ALTER TABLE reservations ADD COLUMN IF NOT EXISTS shuttle_devolucion boolean DEFAULT false');
  console.log('Added shuttle_devolucion column');
  
  // Verify
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'reservations' AND column_name LIKE 'shuttle%'");
  console.log('Shuttle columns:', res.rows);
  
  await client.end();
  console.log('Migration complete!');
} catch (err) {
  console.error('Error:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
}
