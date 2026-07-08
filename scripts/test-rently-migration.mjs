/**
 * Test script: Verify /api/bookings/list endpoint works after migration.
 * Also tests /api/places and /odata/bookings.
 * 
 * Usage: node scripts/test-rently-migration.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getCredentials() {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("rently_api_host, rently_client_id, rently_client_secret")
    .limit(1)
    .single();
  if (error) throw new Error(`Failed to get credentials: ${error.message}`);
  return {
    host: data.rently_api_host || "azul.rently.com.ar",
    clientId: data.rently_client_id,
    clientSecret: data.rently_client_secret,
  };
}

async function getToken(host, clientId, clientSecret) {
  const response = await fetch(`https://${host}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) throw new Error(`Auth failed: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

async function testBookingsList(host, token) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 1: /api/bookings/list (nuevo endpoint)");
  console.log("═══════════════════════════════════════════════════════════");
  
  const url = `https://${host}/api/bookings/list?offset=0&limit=3`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  
  console.log(`Status: ${response.status}`);
  if (!response.ok) {
    const text = await response.text();
    console.error(`ERROR: ${text}`);
    return null;
  }
  
  const data = await response.json();
  console.log(`Results count: ${data.Results?.length || 0}`);
  console.log(`NextOffset: ${data.NextOffset}`);
  
  if (data.Results?.length > 0) {
    const booking = data.Results[0];
    console.log("\n--- Primera reserva (campos presentes) ---");
    console.log(`Id: ${booking.Id}`);
    console.log(`CurrentStatus: ${booking.CurrentStatus}`);
    console.log(`FromDate: ${booking.FromDate}`);
    console.log(`ToDate: ${booking.ToDate}`);
    console.log(`TotalDays: ${booking.TotalDays}`);
    console.log(`CustomerPrice: ${booking.CustomerPrice}`);
    
    // Customer fields
    console.log("\n--- Customer DTO ---");
    console.log(`  Firstname: ${booking.Customer?.Firstname ?? "❌ MISSING"}`);
    console.log(`  Lastname: ${booking.Customer?.Lastname ?? "❌ MISSING"}`);
    console.log(`  EmailAddress: ${booking.Customer?.EmailAddress ?? "❌ MISSING"}`);
    console.log(`  CellPhone: ${booking.Customer?.CellPhone ?? "(empty/null)"}`);
    console.log(`  DocumentTypeId: ${booking.Customer?.DocumentTypeId ?? "(empty/null)"}`);
    console.log(`  DocumentId: ${booking.Customer?.DocumentId ?? "(empty/null)"}`);
    
    // Car fields
    console.log("\n--- Car DTO ---");
    console.log(`  Id: ${booking.Car?.Id ?? "❌ MISSING"}`);
    console.log(`  Plate: ${booking.Car?.Plate ?? "❌ MISSING"}`);
    console.log(`  Model.Name: ${booking.Car?.Model?.Name ?? "❌ MISSING"}`);
    console.log(`  Model.Category.Name: ${booking.Car?.Model?.Category?.Name ?? "❌ MISSING"}`);
    
    // Places - new format
    console.log("\n--- Places (new format) ---");
    console.log(`  DeliveryPlaceId: ${booking.DeliveryPlaceId ?? "(null)"}`);
    console.log(`  ReturnPlaceId: ${booking.ReturnPlaceId ?? "(null)"}`);
    console.log(`  DeliveryPlace (legacy obj): ${JSON.stringify(booking.DeliveryPlace) ?? "(null)"}`);
    console.log(`  ReturnPlace (legacy obj): ${JSON.stringify(booking.ReturnPlace) ?? "(null)"}`);
    
    // New fields
    console.log("\n--- New fields ---");
    console.log(`  IsFullBonus: ${booking.IsFullBonus ?? "(null)"}`);
    console.log(`  FeeNoShow: ${booking.FeeNoShow ?? "(null)"}`);
    
    // Other fields
    console.log("\n--- Other ---");
    console.log(`  Origin: ${JSON.stringify(booking.Origin)}`);
    console.log(`  DropoffInfo: ${JSON.stringify(booking.DropoffInfo)}`);
    console.log(`  CreationDate: ${booking.CreationDate}`);
    
    // Check for removed fields
    console.log("\n--- Removed fields (should be undefined) ---");
    console.log(`  PriceItems: ${booking.PriceItems !== undefined ? "⚠️ STILL PRESENT" : "✅ removed"}`);
    console.log(`  Attributes: ${booking.Attributes !== undefined ? "⚠️ STILL PRESENT" : "✅ removed"}`);
    console.log(`  AvailablePromotions: ${booking.AvailablePromotions !== undefined ? "⚠️ STILL PRESENT" : "✅ removed"}`);
    console.log(`  TotalDaysString: ${booking.TotalDaysString !== undefined ? "⚠️ STILL PRESENT" : "✅ removed"}`);
    
    // Print full first booking for reference
    console.log("\n--- RAW first booking (all keys) ---");
    console.log(JSON.stringify(Object.keys(booking).sort(), null, 2));
  }
  
  return data;
}

async function testPlaces(host, token) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 2: /api/places (para resolver IDs)");
  console.log("═══════════════════════════════════════════════════════════");
  
  const url = `https://${host}/api/places`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  
  console.log(`Status: ${response.status}`);
  if (!response.ok) {
    const text = await response.text();
    console.error(`ERROR: ${text}`);
    return null;
  }
  
  const data = await response.json();
  const places = Array.isArray(data) ? data : (data?.Results || []);
  console.log(`Places count: ${places.length}`);
  
  if (places.length > 0) {
    console.log("\n--- Primeros 5 places ---");
    places.slice(0, 5).forEach(p => {
      console.log(`  Id: ${p.Id}, Name: ${p.Name}, Address: ${p.Address || "(no address)"}`);
    });
  }
  
  return places;
}

async function testOData(host, token) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 3: /odata/bookings (alternativa recomendada)");
  console.log("═══════════════════════════════════════════════════════════");
  
  // Try basic OData query with $top and $select
  const url = `https://${host}/odata/bookings?$top=2&$select=Id,CurrentStatus,FromDate,ToDate,CustomerPrice`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  
  console.log(`Status: ${response.status}`);
  if (!response.ok) {
    const text = await response.text();
    console.error(`ERROR: ${text}`);
    return null;
  }
  
  const data = await response.json();
  console.log(`OData response keys: ${Object.keys(data)}`);
  const items = data.value || data.Results || [];
  console.log(`Items count: ${items.length}`);
  
  if (items.length > 0) {
    console.log("\n--- First OData item ---");
    console.log(JSON.stringify(items[0], null, 2));
  }
  
  // Try with $expand to get Customer
  console.log("\n--- Testing $expand=Customer ---");
  const url2 = `https://${host}/odata/bookings?$top=1&$expand=Customer`;
  const response2 = await fetch(url2, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  console.log(`$expand Status: ${response2.status}`);
  if (response2.ok) {
    const data2 = await response2.json();
    const items2 = data2.value || [];
    if (items2.length > 0) {
      console.log(`Customer expanded: ${JSON.stringify(items2[0].Customer)}`);
    }
  }
  
  // Try $filter
  console.log("\n--- Testing $filter (CurrentStatus eq 2) ---");
  const url3 = `https://${host}/odata/bookings?$top=2&$filter=CurrentStatus eq 2&$select=Id,CurrentStatus,FromDate`;
  const response3 = await fetch(url3, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  console.log(`$filter Status: ${response3.status}`);
  if (response3.ok) {
    const data3 = await response3.json();
    const items3 = data3.value || [];
    console.log(`Filtered items: ${items3.length}`);
    if (items3.length > 0) console.log(JSON.stringify(items3[0], null, 2));
  }
  
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log("🔑 Obteniendo credenciales de Rently...");
    const creds = await getCredentials();
    console.log(`Host: ${creds.host}`);
    
    console.log("🔐 Obteniendo token...");
    const token = await getToken(creds.host, creds.clientId, creds.clientSecret);
    console.log("✅ Token obtenido");
    
    await testBookingsList(creds.host, token);
    await testPlaces(creds.host, token);
    await testOData(creds.host, token);
    
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("✅ TESTS COMPLETADOS");
    console.log("═══════════════════════════════════════════════════════════");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
