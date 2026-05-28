import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PLATES_TO_FIX = ['9806MSG', '9849MSG', '9786MSG'];

async function main() {
  console.log("Moving 3 V Class vehicles from 'Familiar' to 'Luxury Van'...");
  
  for (const plate of PLATES_TO_FIX) {
    // Update in vehicles table
    const { data: veh, error: vehErr } = await supabase
      .from("vehicles")
      .update({ categoria: "Luxury Van" })
      .eq("matricula", plate)
      .select("id, matricula, modelo, categoria");
    
    if (vehErr) {
      console.error(`Error updating ${plate} in vehicles:`, vehErr.message);
    } else {
      console.log(`✓ vehicles: ${plate} → Luxury Van`, veh);
    }

    // Update in fleet_vehicles table
    const { data: fleet, error: fleetErr } = await supabase
      .from("fleet_vehicles")
      .update({ categoria: "Luxury Van" })
      .eq("matricula", plate)
      .select("id, matricula, modelo, categoria");
    
    if (fleetErr) {
      console.error(`Error updating ${plate} in fleet_vehicles:`, fleetErr.message);
    } else {
      console.log(`✓ fleet_vehicles: ${plate} → Luxury Van`, fleet);
    }
  }

  // Verify
  console.log("\n=== VERIFICATION ===");
  const { data: vClassVehicles } = await supabase
    .from("vehicles")
    .select("matricula, modelo, categoria")
    .ilike("modelo", "%V Class%")
    .eq("is_archived", false);
  
  console.log("All V Class vehicles after fix:");
  for (const v of vClassVehicles || []) {
    console.log(`  ${v.matricula} - ${v.modelo} - ${v.categoria}`);
  }
}

main().catch(console.error);
