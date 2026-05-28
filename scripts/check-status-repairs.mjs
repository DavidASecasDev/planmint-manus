import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Check distinct status values
  console.log("=== VEHICLE STATUS VALUES ===");
  const { data: allVeh } = await supabase
    .from("vehicles")
    .select("status, service_type, service_notes")
    .eq("is_archived", false);
  
  const statuses = [...new Set((allVeh || []).map(v => v.status))];
  console.log("Distinct status values:", statuses);
  for (const s of statuses) {
    const count = (allVeh || []).filter(v => v.status === s).length;
    console.log(`  ${s}: ${count}`);
  }

  const serviceTypes = [...new Set((allVeh || []).map(v => v.service_type).filter(Boolean))];
  console.log("\nDistinct service_type values:", serviceTypes);

  // Show vehicles with non-null service_type
  const inService = (allVeh || []).filter(v => v.service_type);
  console.log(`Vehicles with service_type set: ${inService.length}`);
  
  // 2. Check vehicles currently in service (status != 'disponible' or similar)
  console.log("\n=== VEHICLES NOT AVAILABLE ===");
  const { data: notAvailable } = await supabase
    .from("vehicles")
    .select("matricula, modelo, status, service_type, service_notes")
    .eq("is_archived", false)
    .neq("status", "disponible");
  console.log("Vehicles not 'disponible':", JSON.stringify(notAvailable, null, 2));

  // 3. Check active repairs (not finalizado)
  console.log("\n=== ACTIVE REPAIRS ===");
  const { data: activeRepairs } = await supabase
    .from("repairs")
    .select("id, vehicle_id, status, description, scheduled_date, started_at")
    .neq("status", "finalizado");
  console.log("Active repairs:", JSON.stringify(activeRepairs, null, 2));

  // 4. Check distinct repair statuses
  const { data: allRepairs } = await supabase
    .from("repairs")
    .select("status");
  const repairStatuses = [...new Set((allRepairs || []).map(r => r.status))];
  console.log("\nDistinct repair statuses:", repairStatuses);
}

main().catch(console.error);
