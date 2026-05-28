/**
 * Script to explore Rently API service endpoints.
 * Uses the same auth mechanism as the existing integration.
 */

const RENTLY_HOST = "azul.rently.com.ar";

// We need the credentials from integration_settings
// For this exploration, we'll call our own API endpoint (explore action)
// But since we need to authenticate, let's use the Rently auth directly

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getRentlyCredentials() {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("rently_api_host, rently_client_id, rently_client_secret")
    .single();

  if (error || !data) {
    console.error("Error fetching credentials:", error);
    process.exit(1);
  }
  return data;
}

async function getRentlyToken(host, clientId, clientSecret) {
  const response = await fetch(`https://${host}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Auth failed:", response.status, text);
    process.exit(1);
  }

  const data = await response.json();
  return data.access_token;
}

async function callApi(host, token, endpoint, method = "GET") {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${method} https://${host}${endpoint}`);
  console.log("=".repeat(60));

  try {
    const response = await fetch(`https://${host}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    console.log(`Status: ${response.status}`);
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const data = await response.json();
      // Print first 2000 chars to avoid overwhelming output
      const str = JSON.stringify(data, null, 2);
      console.log(str.substring(0, 2000));
      if (str.length > 2000) console.log(`\n... (${str.length} total chars)`);
      return data;
    } else {
      const text = await response.text();
      console.log(text.substring(0, 500));
      return null;
    }
  } catch (err) {
    console.error("Error:", err.message);
    return null;
  }
}

async function main() {
  const creds = await getRentlyCredentials();
  const host = creds.rently_api_host || RENTLY_HOST;
  console.log(`Host: ${host}`);

  const token = await getRentlyToken(host, creds.rently_client_id, creds.rently_client_secret);
  console.log("Token obtained successfully");

  // Try various service-related endpoints
  const endpoints = [
    "/api/services",
    "/api/service",
    "/api/services?Limit=5",
    "/api/carservices",
    "/api/car-services",
    "/api/maintenance",
    "/api/service/types",
    "/api/servicetypes",
    "/api/service-types",
  ];

  for (const ep of endpoints) {
    await callApi(host, token, ep);
  }
}

main().catch(console.error);
