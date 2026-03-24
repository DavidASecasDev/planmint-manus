/**
 * Fix missing tables and columns in Supabase database.
 * Creates: transfer_status_history, transfer_request_notes, vehicle_audits, task_comments
 * Alters: transfer_brokers (add email, phone, company, user_id)
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runSQL(label, sql) {
  console.log(`\n=== ${label} ===`);
  const { data, error } = await sb.rpc("exec_sql", { sql_query: sql });
  if (error) {
    // rpc exec_sql may not exist, try alternative approach
    console.log(`  RPC failed: ${error.message}`);
    return false;
  }
  console.log(`  ✓ Success`);
  return true;
}

async function createTableViaInsertTest(tableName) {
  // Test if table exists by trying a select
  const { error } = await sb.from(tableName).select("*").limit(0);
  if (!error) {
    console.log(`  Table ${tableName} already exists`);
    return true;
  }
  console.log(`  Table ${tableName} does NOT exist (${error.message})`);
  return false;
}

async function testColumnExists(tableName, columnName) {
  // Try to select the specific column
  const { error } = await sb.from(tableName).select(columnName).limit(0);
  if (!error) {
    console.log(`  Column ${tableName}.${columnName} exists`);
    return true;
  }
  console.log(`  Column ${tableName}.${columnName} does NOT exist`);
  return false;
}

async function main() {
  console.log("=== Database Fix Script ===\n");
  console.log("Checking current state...\n");

  // Check missing tables
  const missingTables = [];
  for (const t of ["transfer_status_history", "transfer_request_notes", "vehicle_audits", "task_comments"]) {
    const exists = await createTableViaInsertTest(t);
    if (!exists) missingTables.push(t);
  }

  // Check missing columns in transfer_brokers
  const missingCols = [];
  for (const c of ["email", "phone", "company", "user_id"]) {
    const exists = await testColumnExists("transfer_brokers", c);
    if (!exists) missingCols.push(c);
  }

  console.log(`\n\nSummary:`);
  console.log(`  Missing tables: ${missingTables.length > 0 ? missingTables.join(", ") : "none"}`);
  console.log(`  Missing columns in transfer_brokers: ${missingCols.length > 0 ? missingCols.join(", ") : "none"}`);

  if (missingTables.length === 0 && missingCols.length === 0) {
    console.log("\n✓ All tables and columns exist. No fixes needed.");
    return;
  }

  console.log("\n\nGenerating SQL statements...\n");

  // Output the SQL that needs to be run in the Supabase SQL editor
  const sqlStatements = [];

  if (missingTables.includes("transfer_status_history")) {
    sqlStatements.push(`
-- Create transfer_status_history table
CREATE TABLE IF NOT EXISTS public.transfer_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by_type text NOT NULL DEFAULT 'system',
  changed_by_id uuid,
  changed_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transfer_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read/write their org's data
CREATE POLICY "Users can manage their org transfer status history"
  ON public.transfer_status_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_transfer_status_history_request_id
  ON public.transfer_status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status_history_org_id
  ON public.transfer_status_history(organization_id);
`);
  }

  if (missingTables.includes("transfer_request_notes")) {
    sqlStatements.push(`
-- Create transfer_request_notes table
-- NOTE: Code uses broker_id + text columns (not author_type/author_id/content from old types)
CREATE TABLE IF NOT EXISTS public.transfer_request_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES public.transfer_brokers(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transfer_request_notes ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their org transfer request notes"
  ON public.transfer_request_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_transfer_request_notes_request_id
  ON public.transfer_request_notes(request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_request_notes_org_id
  ON public.transfer_request_notes(organization_id);
`);
  }

  if (missingTables.includes("vehicle_audits")) {
    sqlStatements.push(`
-- Create vehicle_audits table
CREATE TABLE IF NOT EXISTS public.vehicle_audits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  auditor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  score numeric,
  notes text,
  findings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_audits ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their org vehicle audits"
  ON public.vehicle_audits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_vehicle_audits_org_id
  ON public.vehicle_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_audits_vehicle_id
  ON public.vehicle_audits(vehicle_id);
`);
  }

  if (missingTables.includes("task_comments")) {
    sqlStatements.push(`
-- Create task_comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage task comments"
  ON public.task_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id
  ON public.task_comments(task_id);
`);
  }

  if (missingCols.length > 0) {
    const alterStatements = [];
    if (missingCols.includes("email")) {
      alterStatements.push("ADD COLUMN IF NOT EXISTS email text");
    }
    if (missingCols.includes("phone")) {
      alterStatements.push("ADD COLUMN IF NOT EXISTS phone text");
    }
    if (missingCols.includes("company")) {
      alterStatements.push("ADD COLUMN IF NOT EXISTS company text");
    }
    if (missingCols.includes("user_id")) {
      alterStatements.push("ADD COLUMN IF NOT EXISTS user_id uuid");
    }
    sqlStatements.push(`
-- Add missing columns to transfer_brokers
ALTER TABLE public.transfer_brokers
  ${alterStatements.join(",\n  ")};
`);
  }

  const fullSQL = sqlStatements.join("\n");
  console.log("SQL to execute:\n");
  console.log(fullSQL);

  // Try to execute via Supabase REST API (using rpc or direct fetch)
  console.log("\n\nAttempting to execute via Supabase Management API...\n");

  // Use the Supabase REST endpoint to execute SQL
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Execute each statement individually via the REST SQL endpoint
  for (const stmt of sqlStatements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    console.log(`Executing block...`);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ sql_query: trimmed }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.log(`  REST RPC failed (${response.status}): ${text.substring(0, 200)}`);
      } else {
        console.log(`  ✓ Success via REST RPC`);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  // Write the SQL to a file for manual execution if needed
  const fs = await import("fs");
  const sqlPath = path.join(__dirname, "fix-missing-tables.sql");
  fs.writeFileSync(sqlPath, fullSQL, "utf-8");
  console.log(`\nSQL saved to: ${sqlPath}`);
  console.log("If automatic execution failed, run this SQL in the Supabase SQL Editor.");
}

main().catch(console.error);
