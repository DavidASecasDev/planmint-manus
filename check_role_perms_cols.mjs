import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check actual columns in role_permissions
const { data, error } = await supabase
  .from("role_permissions")
  .select("*")
  .limit(3);

if (error) {
  console.log("ERROR:", error.message);
} else {
  console.log("role_permissions sample rows:");
  console.log(JSON.stringify(data, null, 2));
  if (data.length > 0) {
    console.log("\nColumns:", Object.keys(data[0]));
  }
}

// Try to count all
const { count } = await supabase
  .from("role_permissions")
  .select("*", { count: "exact", head: true });
console.log("\nTotal rows:", count);
