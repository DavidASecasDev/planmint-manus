/**
 * Script to create the sync_fleet_vehicle_to_vehicles trigger in Supabase.
 * Uses the Supabase service role client to execute raw SQL via rpc.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Step 1: Ensure fleet_vehicle_id column exists
const step1SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'fleet_vehicle_id'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN fleet_vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_vehicle_id ON public.vehicles(fleet_vehicle_id);
  END IF;
END $$;
`;

// Step 2: Create the trigger function
const step2SQL = `
CREATE OR REPLACE FUNCTION public.sync_fleet_vehicle_to_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_existing_id
    FROM public.vehicles
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.vehicles
      SET fleet_vehicle_id = NEW.id,
          modelo = COALESCE(NEW.modelo, modelo),
          categoria = COALESCE(NEW.categoria, categoria),
          is_archived = false,
          archived_at = NULL,
          archived_by = NULL,
          updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.vehicles (
        organization_id, matricula, modelo, categoria,
        status, is_archived, fleet_vehicle_id, created_at, updated_at
      ) VALUES (
        NEW.organization_id, UPPER(TRIM(NEW.matricula)), NEW.modelo, NEW.categoria,
        'sucio', false, NEW.id, NOW(), NOW()
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.vehicles
    SET matricula = UPPER(TRIM(NEW.matricula)),
        modelo = COALESCE(NEW.modelo, modelo),
        categoria = COALESCE(NEW.categoria, categoria),
        updated_at = NOW()
    WHERE fleet_vehicle_id = NEW.id
       OR (organization_id = NEW.organization_id
           AND UPPER(TRIM(matricula)) = UPPER(TRIM(OLD.matricula))
           AND fleet_vehicle_id IS NULL);

    UPDATE public.vehicles
    SET fleet_vehicle_id = NEW.id
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
      AND fleet_vehicle_id IS NULL;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.vehicles
    SET is_archived = true,
        archived_at = NOW(),
        fleet_vehicle_id = NULL,
        updated_at = NOW()
    WHERE fleet_vehicle_id = OLD.id
       OR (organization_id = OLD.organization_id
           AND UPPER(TRIM(matricula)) = UPPER(TRIM(OLD.matricula))
           AND fleet_vehicle_id IS NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
`;

// Step 3: Create the trigger
const step3SQL = `
DROP TRIGGER IF EXISTS trg_sync_fleet_to_vehicles ON public.fleet_vehicles;
CREATE TRIGGER trg_sync_fleet_to_vehicles
AFTER INSERT OR UPDATE OR DELETE ON public.fleet_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.sync_fleet_vehicle_to_vehicles();
`;

// Step 4: Backfill - link existing fleet_vehicles to vehicles
const step4SQL = `
UPDATE public.vehicles v
SET fleet_vehicle_id = fv.id
FROM public.fleet_vehicles fv
WHERE v.organization_id = fv.organization_id
  AND UPPER(TRIM(v.matricula)) = UPPER(TRIM(fv.matricula))
  AND v.fleet_vehicle_id IS NULL;
`;

// Step 5: Create missing vehicles for fleet_vehicles that have no match
const step5SQL = `
INSERT INTO public.vehicles (organization_id, matricula, modelo, categoria, status, is_archived, fleet_vehicle_id, created_at, updated_at)
SELECT fv.organization_id, UPPER(TRIM(fv.matricula)), fv.modelo, fv.categoria, 'sucio', false, fv.id, NOW(), NOW()
FROM public.fleet_vehicles fv
WHERE NOT EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.organization_id = fv.organization_id
    AND UPPER(TRIM(v.matricula)) = UPPER(TRIM(fv.matricula))
);
`;

async function runSQL(label, sql) {
  console.log(`\n--- ${label} ---`);
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    // If exec_sql doesn't exist, try using the REST API directly
    console.log(`rpc error: ${error.message}. Trying direct fetch...`);
    
    // Use the Supabase REST SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP ${response.status}: ${text}`);
      return false;
    }
    console.log(`Success via REST`);
    return true;
  }
  console.log(`Success:`, data);
  return true;
}

async function main() {
  console.log("=== Creating Fleet-to-Vehicles Sync Trigger ===\n");
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  // Try each step
  for (const [label, sql] of [
    ["Step 1: Ensure fleet_vehicle_id column", step1SQL],
    ["Step 2: Create trigger function", step2SQL],
    ["Step 3: Create trigger", step3SQL],
    ["Step 4: Backfill fleet_vehicle_id links", step4SQL],
    ["Step 5: Create missing vehicles", step5SQL],
  ]) {
    const ok = await runSQL(label, sql);
    if (!ok) {
      console.error(`Failed at: ${label}`);
    }
  }
  
  console.log("\n=== Done ===");
}

main().catch(console.error);
