import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check if role_permissions table exists and has data
console.log("=== role_permissions table ===");
const { data, error } = await supabase.from("role_permissions").select("*").limit(20);
if (error) console.error("Error:", error.message);
else {
  console.log(`Found ${data.length} entries`);
  if (data.length > 0) console.log("Columns:", Object.keys(data[0]).join(", "));
  console.log(JSON.stringify(data.slice(0, 10), null, 2));
}
