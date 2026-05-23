/**
 * Creates the reservation_status_history table in Supabase.
 * Run with: node scripts/create-reservation-status-history.mjs
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Check if table already exists by trying to select from it
  const { error: checkError } = await sb
    .from("reservation_status_history")
    .select("id")
    .limit(1);

  if (!checkError) {
    console.log("Table reservation_status_history already exists.");
    return;
  }

  if (checkError.code === "42P01" || checkError.message?.includes("does not exist")) {
    console.log("Table does not exist, creating via rpc...");
    // Use Supabase's rpc to execute raw SQL (requires a helper function or direct REST)
    // Since we can't run DDL via the JS client directly, we'll use the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    });
    console.log("Cannot create table via JS client. Please run the following SQL in Supabase SQL Editor:");
    console.log(`
CREATE TABLE reservation_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  external_reservation_id TEXT,
  old_status TEXT,
  new_status TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'manual',
  changed_by_user_id UUID,
  changed_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_reservation_status_history_reservation ON reservation_status_history(reservation_id);
CREATE INDEX idx_reservation_status_history_org ON reservation_status_history(organization_id);
    `);
  } else {
    console.error("Unexpected error:", checkError);
  }
}

main().catch(console.error);
