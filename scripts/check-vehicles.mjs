import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Find DummyCar
  console.log("=== DUMMYCAR SEARCH ===");
  const { data: dummyCars } = await supabase
    .from("vehicles")
    .select("id, matricula, modelo, categoria, is_archived")
    .or("matricula.ilike.%dummy%,modelo.ilike.%dummy%");
  console.log("DummyCar in vehicles:", JSON.stringify(dummyCars, null, 2));

  const { data: dummyFleet } = await supabase
    .from("fleet_vehicles")
    .select("id, matricula, marca, modelo, categoria")
    .or("matricula.ilike.%dummy%,modelo.ilike.%dummy%,marca.ilike.%dummy%");
  console.log("DummyCar in fleet_vehicles:", JSON.stringify(dummyFleet, null, 2));

  // Also check 6513MFG specifically
  const { data: plate6513 } = await supabase
    .from("vehicles")
    .select("id, matricula, modelo, categoria, is_archived")
    .eq("matricula", "6513MFG");
  console.log("6513MFG in vehicles:", JSON.stringify(plate6513, null, 2));

  // 2. Find V Class vehicles
  console.log("\n=== V CLASS SEARCH ===");
  const { data: vClassVehicles } = await supabase
    .from("vehicles")
    .select("id, matricula, modelo, categoria, is_archived, fleet_vehicle_id")
    .ilike("modelo", "%V Class%");
  console.log("V Class in vehicles:", JSON.stringify(vClassVehicles, null, 2));

  const { data: vClassFleet } = await supabase
    .from("fleet_vehicles")
    .select("id, matricula, marca, modelo, categoria")
    .ilike("modelo", "%V%Class%");
  console.log("V Class in fleet_vehicles:", JSON.stringify(vClassFleet, null, 2));

  // Also search by marca Mercedes + modelo containing V
  const { data: mercedesV } = await supabase
    .from("fleet_vehicles")
    .select("id, matricula, marca, modelo, categoria")
    .ilike("marca", "%Mercedes%")
    .ilike("modelo", "%V %");
  console.log("Mercedes V* in fleet_vehicles:", JSON.stringify(mercedesV, null, 2));

  // 3. Check vehicle statuses (for in-service)
  console.log("\n=== VEHICLE STATUS FIELDS ===");
  const { data: sampleVehicles } = await supabase
    .from("vehicles")
    .select("id, matricula, modelo, estado_operativo, is_archived")
    .eq("is_archived", false)
    .limit(5);
  console.log("Sample vehicles (with estado_operativo):", JSON.stringify(sampleVehicles, null, 2));

  // Check distinct estado_operativo values
  const { data: allVehicles } = await supabase
    .from("vehicles")
    .select("estado_operativo")
    .eq("is_archived", false);
  const statuses = [...new Set((allVehicles || []).map(v => v.estado_operativo))];
  console.log("Distinct estado_operativo values:", statuses);

  // Count vehicles by estado_operativo
  for (const status of statuses) {
    const count = (allVehicles || []).filter(v => v.estado_operativo === status).length;
    console.log(`  ${status}: ${count} vehicles`);
  }

  // 4. Count total active vehicles
  const { count } = await supabase
    .from("vehicles")
    .select("id", { count: "exact" })
    .eq("is_archived", false);
  console.log(`\nTotal active vehicles: ${count}`);

  // 5. Count Luxury Van category specifically
  console.log("\n=== LUXURY VAN CATEGORY ===");
  const { data: luxuryVan } = await supabase
    .from("vehicles")
    .select("id, matricula, modelo, categoria, is_archived")
    .ilike("categoria", "%luxury%van%")
    .eq("is_archived", false);
  console.log("Luxury Van vehicles:", JSON.stringify(luxuryVan, null, 2));
}

main().catch(console.error);
