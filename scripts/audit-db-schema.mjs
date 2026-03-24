/**
 * Audit script: Query the actual Supabase database schema
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// All tables referenced anywhere in the codebase
const knownTables = [
  // Auth/Org
  "profiles", "organizations", "organization_members", "roles", "permissions",
  "role_permissions", "member_roles", "invitations",
  // Transfers
  "transfer_brokers", "transfer_requests", "transfer_items", "transfer_documents",
  "transfer_notes", "transfer_status_history", "transfer_providers",
  "transfer_invoice_settings", "transfer_item_vehicles", "transfer_reports",
  // Broker portal
  "broker_profiles", "broker_registration_requests", "broker_notifications",
  // Fleet
  "vehicles", "vehicle_categories", "vehicle_maintenance", "vehicle_documents",
  "vehicle_prep_checklists", "vehicle_prep_items", "vehicle_prep_alerts",
  "fleet_audit_logs", "fleet_categories",
  // Billing
  "billing_records", "billing_settings",
  // Properties / Reservations
  "properties", "property_units", "reservations",
  // Drivers
  "drivers", "driver_documents",
  // Notifications
  "notifications", "notification_preferences",
  // Settings
  "user_preferences", "app_settings",
  // Additional possible tables
  "transfer_pricing_rules", "transfer_vehicle_assignments",
  "organization_settings", "audit_logs",
  "member_permissions",
];

async function checkTables() {
  console.log("=== TABLE EXISTENCE CHECK ===\n");
  
  const existing = [];
  const missing = [];
  
  for (const table of knownTables) {
    try {
      const { data, error } = await sb
        .from(table)
        .select("*")
        .limit(0);
      
      if (!error) {
        existing.push(table);
        console.log(`✓ ${table}`);
      } else if (error.code === "PGRST204" || error.message?.includes("does not exist") || error.code === "42P01") {
        missing.push(table);
        console.log(`✗ ${table} — MISSING (${error.message})`);
      } else {
        // Could be a permissions issue or other error
        existing.push(table); // Assume exists if error is not "not found"
        console.log(`? ${table} — ${error.code}: ${error.message}`);
      }
    } catch (e) {
      missing.push(table);
      console.log(`✗ ${table} — EXCEPTION: ${e.message}`);
    }
  }
  
  console.log(`\n--- Summary: ${existing.length} exist, ${missing.length} missing ---`);
  console.log("Missing:", missing.join(", "));
  
  // Get column details for existing tables
  console.log("\n\n=== COLUMN DETAILS ===\n");
  
  for (const table of existing) {
    try {
      const { data, error } = await sb
        .from(table)
        .select("*")
        .limit(1);
      
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`\n${table} (${columns.length} columns):`);
        for (const col of columns.sort()) {
          const val = data[0][col];
          const type = val === null ? "null" : Array.isArray(val) ? "array" : typeof val;
          const sample = JSON.stringify(val)?.substring(0, 60) || "null";
          console.log(`  ${col} [${type}] = ${sample}`);
        }
      } else if (data && data.length === 0) {
        console.log(`\n${table}: (empty — no rows to infer columns)`);
      } else if (error) {
        console.log(`\n${table}: Error — ${error.message}`);
      }
    } catch (e) {
      console.log(`\n${table}: Exception — ${e.message}`);
    }
  }
}

checkTables().catch(console.error);
