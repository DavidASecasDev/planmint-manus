/**
 * Extended audit: Check ALL tables referenced in code
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ALL tables referenced in code (from grep)
const allTables = [
  // High usage (>= 5 refs)
  "tasks", "reservations", "notifications", "areas", "vehicles", "profiles",
  "transfer_requests", "repairs", "reminders", "fleet_vehicle_damages",
  "damage_reports", "task_assignees", "organization_invitations", "usage_events",
  "organizations", "fleet_vehicles", "task_subtasks", "task_milestones", "tags",
  "organization_members", "transfer_items", "transfer_brokers", "task_updates",
  "subscriptions", "vehicle_movements", "team_members", "area_access_rules",
  "accidents", "workshops", "user_templates", "user_feedback", "time_entries",
  "referrals", "forms", "form_fields", "custom_roles", "vehicle_quality_audits",
  "vehicle_cleaning_tasks", "user_sessions", "super_admin_alerts", "saml_connections",
  "org_security_settings", "fleet_vehicle_inspections", "broker_registration_requests",
  "transfer_providers", "transfer_item_vehicles", "task_tags", "task_areas",
  "repair_invoices", "repair_history", "operation_legs", "damage_catalog",
  "coupon_redemptions", "automation_rules", "user_permissions", "vehicle_locations",
  "vehicle_audit_photos", "teams", "scim_tokens", "organization_modules",
  "kanban_columns", "fleet_inspection_photos", "coupons", "transfer_documents",
  "role_permissions", "rently_sync_status", "transfer_invoice_settings",
  "integration_settings", "daily_task_templates", "daily_task_completions",
  "audit_logs", "transfer_status_history", "transfer_request_notes",
  "template_ratings", "template_favorites", "super_admin_actions",
  "repair_photos", "repair_invoice_items", "repair_comments", "push_subscriptions",
  "notification_preferences", "form_responses", "broker_profiles",
  "vehicle_cleaning_history", "trials", "templates", "task_update_images",
  "scim_identities", "fleet_inspection_damages", "dropdown_options",
  "damage_report_items", "vehicle_audits", "template_versions", "template_reports",
  "template_installs", "template_applies", "task_update_mentions", "super_admins",
  "subscription_items", "scim_groups", "scim_group_memberships",
  "provisioning_logs", "outbound_notifications", "leads", "feature_flags",
  "billing_products_public", "billing_events", "automation_runs",
  "task_comments",
  // Storage buckets referenced with .from()
  // "repair-files", "transfer-documents", "movement-photos", "fleet-vehicle-photos",
  // "task-update-images", "organization-assets", "damage-report-photos", "avatars",
];

async function checkAll() {
  const existing = [];
  const missing = [];
  
  for (const table of allTables) {
    try {
      const { error } = await sb.from(table).select("*").limit(0);
      if (!error) {
        existing.push(table);
      } else {
        missing.push(table);
      }
    } catch {
      missing.push(table);
    }
  }
  
  console.log(`EXISTING (${existing.length}):`);
  existing.forEach(t => console.log(`  ✓ ${t}`));
  
  console.log(`\nMISSING (${missing.length}):`);
  missing.forEach(t => console.log(`  ✗ ${t}`));
  
  // For existing tables, check column count
  console.log("\n\n=== COLUMN COUNTS ===");
  for (const table of existing) {
    try {
      const { data } = await sb.from(table).select("*").limit(1);
      if (data && data.length > 0) {
        console.log(`${table}: ${Object.keys(data[0]).length} columns`);
      } else {
        console.log(`${table}: (empty)`);
      }
    } catch {
      console.log(`${table}: error`);
    }
  }
}

checkAll().catch(console.error);
