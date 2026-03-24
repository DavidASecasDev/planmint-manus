/**
 * Execute SQL against Supabase PostgreSQL using the connection pooler.
 * Supabase provides a PostgreSQL database accessible via:
 * - Direct connection: db.<project_ref>.supabase.co:5432
 * - Pooler: <project_ref>.pooler.supabase.com:6543
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from SUPABASE_URL
const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
if (!match) {
  console.error("Could not extract project ref from SUPABASE_URL");
  process.exit(1);
}
const projectRef = match[1];
console.log(`Project ref: ${projectRef}`);

// Supabase PostgreSQL connection details
// Direct: db.<ref>.supabase.co:5432
// Pooler: aws-0-<region>.pooler.supabase.com:6543
// User: postgres.<ref>
// Password: from service role key or project password

// The service role key is a JWT, not a database password
// We need the database password which is typically set during project creation
// However, we can use the Supabase Management API to execute SQL

async function executeViaManagementAPI() {
  console.log("\nTrying Supabase Management API...");
  
  // The Supabase Management API requires a personal access token or service role key
  // Try using the service role key as bearer token
  
  const sqlFile = path.join(__dirname, "fix-missing-tables.sql");
  const fullSQL = fs.readFileSync(sqlFile, "utf-8");
  
  // Split into blocks (separated by double newlines after semicolons)
  const blocks = fullSQL.split(/\n\n+/).filter(b => b.trim());
  
  // Group related statements (CREATE TABLE + ALTER TABLE + CREATE POLICY + CREATE INDEX)
  const sqlBlocks = [];
  let currentBlock = "";
  
  for (const line of fullSQL.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !currentBlock.trim()) {
      // Comment at start of new block
      currentBlock += line + "\n";
    } else if (trimmed === "" && currentBlock.includes(";")) {
      // Empty line after a complete statement - might be end of block
      // But only if the next non-empty line starts a new CREATE/ALTER
      currentBlock += line + "\n";
    } else {
      currentBlock += line + "\n";
    }
  }
  if (currentBlock.trim()) {
    sqlBlocks.push(currentBlock.trim());
  }
  
  // Actually, let's just send the entire SQL as one block
  console.log(`Sending full SQL (${fullSQL.length} chars)...`);
  
  // Try the Supabase SQL API endpoint
  // POST https://<project_ref>.supabase.co/pg/query
  const endpoints = [
    `${supabaseUrl}/pg/query`,
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTrying endpoint: ${endpoint}`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: fullSQL }),
      });
      
      const text = await response.text();
      console.log(`  Status: ${response.status}`);
      console.log(`  Response: ${text.substring(0, 500)}`);
      
      if (response.ok) {
        console.log("  ✓ SQL executed successfully!");
        return true;
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
  
  return false;
}

async function executeViaPooler() {
  console.log("\nTrying Supabase Pooler connection...");
  
  // Common pooler patterns
  const poolerHosts = [
    `aws-0-us-east-1.pooler.supabase.com`,
    `aws-0-us-west-1.pooler.supabase.com`,
    `aws-0-eu-west-1.pooler.supabase.com`,
    `aws-0-ap-southeast-1.pooler.supabase.com`,
  ];
  
  // We don't have the database password, so this won't work without it
  console.log("  Skipped: No database password available (service role key is JWT, not DB password)");
  return false;
}

async function main() {
  const success = await executeViaManagementAPI();
  
  if (!success) {
    await executeViaPooler();
  }
  
  // Verify
  console.log("\n\n=== Verification ===");
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl, serviceKey);
  
  for (const t of ["transfer_status_history", "transfer_request_notes", "vehicle_audits", "task_comments"]) {
    const { error } = await sb.from(t).select("*").limit(0);
    console.log(`  ${t}: ${error ? "✗ MISSING" : "✓ EXISTS"}`);
  }
  
  for (const c of ["email", "phone", "company", "user_id"]) {
    const { error } = await sb.from("transfer_brokers").select(c).limit(0);
    console.log(`  transfer_brokers.${c}: ${error ? "✗ MISSING" : "✓ EXISTS"}`);
  }
}

main().catch(console.error);
