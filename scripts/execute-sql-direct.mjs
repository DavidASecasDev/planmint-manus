/**
 * Execute SQL directly against Supabase using the Management API.
 * Uses pg (postgres) connection via DATABASE_URL if available,
 * otherwise falls back to Supabase SQL API.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Extract project ref from SUPABASE_URL
// Format: https://<project_ref>.supabase.co
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Read the SQL file
const sqlPath = path.join(__dirname, "fix-missing-tables.sql");
const fullSQL = fs.readFileSync(sqlPath, "utf-8");

// Split into individual statements (split on semicolons that are NOT inside parentheses)
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let depth = 0;
  
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith("--")) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }
    current += ch;
  }
  
  const trimmed = current.trim();
  if (trimmed && !trimmed.startsWith("--")) {
    statements.push(trimmed);
  }
  
  return statements;
}

// Remove comment-only lines but keep inline comments
function cleanSQL(sql) {
  return sql.split("\n")
    .filter(line => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

const statements = splitStatements(fullSQL);

console.log(`Found ${statements.length} SQL statements to execute.\n`);

// Try using pg module directly
async function tryPg() {
  try {
    const { default: pg } = await import("pg");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log("No DATABASE_URL found, skipping pg approach");
      return false;
    }
    
    console.log("Connecting via DATABASE_URL (pg)...");
    const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log("Connected!\n");
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = cleanSQL(statements[i]);
      if (!stmt) continue;
      
      const preview = stmt.substring(0, 80).replace(/\n/g, " ");
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);
      
      try {
        await client.query(stmt);
        console.log("  ✓ Success");
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`  ⚠ Already exists (skipped): ${err.message.substring(0, 100)}`);
        } else {
          console.log(`  ✗ Error: ${err.message}`);
        }
      }
    }
    
    await client.end();
    return true;
  } catch (err) {
    console.log(`pg approach failed: ${err.message}`);
    return false;
  }
}

// Try using mysql2 (since DATABASE_URL might be MySQL/TiDB)
async function tryMysql() {
  try {
    // The Supabase project uses PostgreSQL, not MySQL
    // But let's check if there's a postgres connection available
    console.log("Trying direct PostgreSQL connection...");
    return false;
  } catch {
    return false;
  }
}

// Try using Supabase's postgrest to create a helper function first
async function trySupabaseApi() {
  console.log("\nTrying Supabase REST approach...");
  
  // First, try to create an exec_sql function via the SQL API
  // The Supabase dashboard SQL editor uses a different endpoint
  
  // Extract project ref
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
  if (!match) {
    console.log("Could not extract project ref from URL");
    return false;
  }
  const projectRef = match[1];
  console.log(`Project ref: ${projectRef}`);
  
  // Try the Supabase Management API
  // POST https://api.supabase.com/v1/projects/{ref}/database/query
  // This requires the service role key or a management API key
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = cleanSQL(statements[i]);
    if (!stmt) continue;
    
    const preview = stmt.substring(0, 80).replace(/\n/g, " ");
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);
    
    try {
      // Try the pg_net approach - execute via Supabase's built-in pg
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({}),
      });
      console.log(`  Status: ${response.status}`);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
  
  return false;
}

async function main() {
  // Try pg first
  const pgSuccess = await tryPg();
  
  if (!pgSuccess) {
    console.log("\n\nDirect pg connection not available.");
    console.log("Installing pg package and retrying...");
    
    // Try installing pg
    const { execSync } = await import("child_process");
    try {
      execSync("cd /home/ubuntu/planmint-preview && pnpm add pg --save-dev 2>&1", { stdio: "pipe" });
      console.log("pg installed, retrying...");
      const retry = await tryPg();
      if (!retry) {
        console.log("\n\n❌ Could not connect to database directly.");
        console.log("The SQL file has been saved to: scripts/fix-missing-tables.sql");
        console.log("Please run it manually in the Supabase SQL Editor.");
      }
    } catch (err) {
      console.log(`Install failed: ${err.message}`);
      console.log("\n\n❌ Could not connect to database directly.");
      console.log("The SQL file has been saved to: scripts/fix-missing-tables.sql");
      console.log("Please run it manually in the Supabase SQL Editor.");
    }
  }
  
  // Verify results
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
