import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Check repairs table structure
  console.log("=== REPAIRS TABLE ===");
  const { data: repairs, error } = await supabase
    .from("repairs")
    .select("*")
    .limit(5);
  
  if (error) {
    console.log("Error querying repairs:", error.message);
    // Try alternative table names
    const { data: r2, error: e2 } = await supabase.from("repair_orders").select("*").limit(3);
    if (e2) console.log("repair_orders error:", e2.message);
    else console.log("repair_orders sample:", JSON.stringify(r2, null, 2));
    
    const { data: r3, error: e3 } = await supabase.from("workshop_orders").select("*").limit(3);
    if (e3) console.log("workshop_orders error:", e3.message);
    else console.log("workshop_orders sample:", JSON.stringify(r3, null, 2));
  } else {
    console.log("Repairs sample:", JSON.stringify(repairs, null, 2));
    
    // Count active repairs
    const { data: activeRepairs } = await supabase
      .from("repairs")
      .select("id, vehicle_id, matricula, status, start_date, end_date")
      .or("status.eq.in_progress,status.eq.pending,status.eq.active,status.is.null")
      .limit(20);
    console.log("\nActive repairs:", JSON.stringify(activeRepairs, null, 2));
  }

  // 2. Check vehicles table columns
  console.log("\n=== VEHICLES TABLE COLUMNS ===");
  const { data: sampleVeh } = await supabase
    .from("vehicles")
    .select("*")
    .limit(1);
  if (sampleVeh && sampleVeh[0]) {
    console.log("Vehicle columns:", Object.keys(sampleVeh[0]).sort().join(", "));
  }

  // 3. Check if there's a vehicle_status or service_status table
  for (const table of ['vehicle_status', 'service_records', 'maintenance', 'vehicle_events', 'garatech_orders']) {
    const { data, error } = await supabase.from(table).select("*").limit(2);
    if (!error) {
      console.log(`\n${table} exists:`, JSON.stringify(data, null, 2));
    }
  }
}

main().catch(console.error);
