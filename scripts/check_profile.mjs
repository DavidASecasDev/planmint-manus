import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

// Find the user by email
const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
if (userErr) {
  console.error("Error listing users:", userErr.message);
  process.exit(1);
}

const david = users.users.find(u => u.email === 'david.marente15@gmail.com');
if (!david) {
  console.log("User david.marente15@gmail.com NOT FOUND in auth.users");
  // Check if there's a similar email
  const similar = users.users.filter(u => u.email && u.email.includes('david'));
  console.log("Similar users:", similar.map(u => u.email));
  process.exit(1);
}

console.log("=== Auth User ===");
console.log("ID:", david.id);
console.log("Email:", david.email);
console.log("Created:", david.created_at);

// Check profile
const { data: profile, error: profErr } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', david.id)
  .single();

if (profErr) {
  console.log("\n=== Profile ERROR ===");
  console.log(profErr.message);
  console.log("Code:", profErr.code);
} else {
  console.log("\n=== Profile ===");
  console.log("Name:", profile.name);
  console.log("Organization ID:", profile.organization_id);
  console.log("Role:", profile.role);
}

// Check organization_members
const { data: memberships, error: memErr } = await supabase
  .from('organization_members')
  .select('*, organizations(name)')
  .eq('user_id', david.id);

if (memErr) {
  console.log("\n=== Memberships ERROR ===");
  console.log(memErr.message);
} else {
  console.log("\n=== Organization Memberships ===");
  console.log("Count:", memberships.length);
  for (const m of memberships) {
    console.log(`  Org: ${m.organization_id} (${m.organizations?.name}), Role: ${m.role}, Status: ${m.status}`);
  }
}

// Also check the Azul Cars org ID
const { data: orgs } = await supabase.from('organizations').select('id, name');
console.log("\n=== All Organizations ===");
for (const o of (orgs || [])) {
  console.log(`  ${o.id}: ${o.name}`);
}
