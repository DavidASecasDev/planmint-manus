/**
 * Migration: Add rently_lugar_* columns to reservations table.
 * These columns store the original Rently values so we can detect manual edits
 * and offer a "Restore from Rently" button.
 *
 * Run: node server/migrations/add-rently-original-columns.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("Adding rently_lugar_* columns to reservations table...");

  // Use Supabase's rpc to execute raw SQL
  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_entrega text DEFAULT NULL;
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_devolucion text DEFAULT NULL;
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_entrega_direccion text DEFAULT NULL;
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_devolucion_direccion text DEFAULT NULL;
    `,
  });

  if (error) {
    // If rpc doesn't exist, try individual column additions via REST
    console.log("rpc exec_sql not available, trying alternative approach...");
    
    // Try adding columns one by one using the Supabase REST API
    // Since Supabase doesn't support ALTER TABLE via REST, we'll just
    // populate the columns from the sync and let Supabase auto-create them
    // Actually, Supabase tables require explicit column creation.
    // Let's try using the management API or just document the SQL.
    console.error("Error:", error.message);
    console.log("\n=== MANUAL SQL REQUIRED ===");
    console.log("Run this SQL in the Supabase SQL Editor:");
    console.log(`
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_entrega text DEFAULT NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_devolucion text DEFAULT NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_entrega_direccion text DEFAULT NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS rently_lugar_devolucion_direccion text DEFAULT NULL;

-- Backfill: copy current values as the "original Rently" values
UPDATE reservations
SET rently_lugar_entrega = lugar_entrega,
    rently_lugar_devolucion = lugar_devolucion,
    rently_lugar_entrega_direccion = lugar_entrega_direccion,
    rently_lugar_devolucion_direccion = lugar_devolucion_direccion
WHERE rently_lugar_entrega IS NULL;
    `);
    process.exit(1);
  }

  console.log("Columns added successfully!");

  // Backfill existing data
  console.log("Backfilling existing reservations...");
  const { error: backfillError } = await supabase.rpc("exec_sql", {
    sql: `
      UPDATE reservations
      SET rently_lugar_entrega = lugar_entrega,
          rently_lugar_devolucion = lugar_devolucion,
          rently_lugar_entrega_direccion = lugar_entrega_direccion,
          rently_lugar_devolucion_direccion = lugar_devolucion_direccion
      WHERE rently_lugar_entrega IS NULL;
    `,
  });

  if (backfillError) {
    console.error("Backfill error:", backfillError.message);
  } else {
    console.log("Backfill complete!");
  }
}

migrate().catch(console.error);
