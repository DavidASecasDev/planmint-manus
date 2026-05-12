import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get distinct roles and count per role
const { data } = await supabase
  .from("role_permissions")
  .select("role, enabled");

const roleCounts = {};
const roleEnabled = {};
for (const row of data || []) {
  roleCounts[row.role] = (roleCounts[row.role] || 0) + 1;
  if (row.enabled) {
    roleEnabled[row.role] = (roleEnabled[row.role] || 0) + 1;
  }
}
console.log("Roles and counts:");
for (const [role, count] of Object.entries(roleCounts)) {
  console.log(`  ${role}: ${count} entries (${roleEnabled[role] || 0} enabled)`);
}

// Check if there are any with enabled=false
const disabledCount = (data || []).filter(r => !r.enabled).length;
console.log(`\nTotal disabled entries: ${disabledCount}`);
