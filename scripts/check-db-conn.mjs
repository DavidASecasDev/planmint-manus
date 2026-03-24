import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const url = process.env.DATABASE_URL || "";
console.log("Protocol:", url.split("://")[0]);
const afterProto = url.split("://")[1] || "";
const host = afterProto.includes("@") ? afterProto.split("@")[1]?.split("/")[0]?.split(":")[0] : "N/A";
console.log("Host:", host);
const port = afterProto.includes("@") ? afterProto.split("@")[1]?.split("/")[0]?.split(":")[1] : "N/A";
console.log("Port:", port);

// Try pg with different SSL modes
import pg from "pg";

async function tryConnect(sslOpt, label) {
  console.log(`\nTrying ${label}...`);
  try {
    const client = new pg.Client({ 
      connectionString: url, 
      ssl: sslOpt,
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    console.log(`  ✓ Connected with ${label}`);
    const res = await client.query("SELECT 1 as test");
    console.log(`  ✓ Query OK: ${JSON.stringify(res.rows)}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`  ✗ Failed: ${err.message}`);
    return false;
  }
}

async function main() {
  // Try various SSL options
  let connected = false;
  connected = await tryConnect(false, "ssl=false");
  if (!connected) connected = await tryConnect({ rejectUnauthorized: false }, "ssl={rejectUnauthorized:false}");
  if (!connected) connected = await tryConnect(true, "ssl=true");
  if (!connected) connected = await tryConnect("require", "ssl=require");
  if (!connected) connected = await tryConnect("no-verify", "ssl=no-verify");
  
  if (!connected) {
    // Try with sslmode in connection string
    const urlWithSSL = url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
    console.log("\nTrying with sslmode=require in URL...");
    try {
      const client = new pg.Client({ connectionString: urlWithSSL });
      await client.connect();
      console.log("  ✓ Connected!");
      await client.end();
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`);
    }
  }
}

main().catch(console.error);
