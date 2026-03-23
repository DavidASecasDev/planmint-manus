/**
 * Diagnostic script: Query live Supabase to check actual permission data
 * for Jordan and Mikaela
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";

// Load env from project root
dotenv.config({ path: resolve(import.meta.dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("=== DIAGNOSTIC: Permission System ===\n");

  // 1. Get all organizations
  const { data: orgs } = await supabase.from("organizations").select("id, name");
  console.log("Organizations:", JSON.stringify(orgs, null, 2));

  if (!orgs?.length) {
    console.log("No organizations found!");
    return;
  }

  // Use Azul Cars org (the main one with Jordan and Mikaela)
  const azulCars = orgs.find(o => o.name === 'Azul Cars') || orgs[1] || orgs[0];
  const orgId = azulCars.id;
  console.log(`\nUsing org: ${azulCars.name} (${orgId})\n`);

  // 2. Get all members with their profiles
  const { data: members } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status, profile:profiles!organization_members_user_id_fkey(id, name)")
    .eq("organization_id", orgId);

  console.log("=== ORGANIZATION MEMBERS ===");
  for (const m of members || []) {
    const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    console.log(`  ${profile?.name || "Unknown"}: role="${m.role}", status="${m.status}", user_id="${m.user_id}"`);
  }

  // 3. Get profiles to check organization_id alignment
  console.log("\n=== PROFILES (organization_id check) ===");
  for (const m of members || []) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, name, organization_id, role")
      .eq("id", m.user_id)
      .single();
    
    const orgMatch = prof?.organization_id === orgId ? "✅ MATCH" : `❌ MISMATCH (profile.org=${prof?.organization_id})`;
    const roleMatch = prof?.role === m.role ? "✅ MATCH" : `⚠️ DIFFERS (profile.role=${prof?.role}, member.role=${m.role})`;
    console.log(`  ${prof?.name}: org=${orgMatch}, role=${roleMatch}`);
  }

  // 4. Get organization_modules
  const { data: modules } = await supabase
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", orgId);

  console.log("\n=== ORGANIZATION MODULES ===");
  if (!modules?.length) {
    console.log("  ⚠️ NO MODULE ROWS FOUND — all optional modules will use DEFAULT values");
    console.log("  DEFAULT reservations: false");
    console.log("  DEFAULT transfers: false");
  } else {
    for (const m of modules) {
      console.log(`  ${m.module_key}: ${m.enabled ? "✅ enabled" : "❌ disabled"}`);
    }
    // Check specific modules
    const reservations = modules.find(m => m.module_key === "reservations");
    const transfers = modules.find(m => m.module_key === "transfers");
    console.log(`\n  reservations: ${reservations ? (reservations.enabled ? "✅ enabled" : "❌ disabled") : "⚠️ NOT IN TABLE (default: false)"}`);
    console.log(`  transfers: ${transfers ? (transfers.enabled ? "✅ enabled" : "❌ disabled") : "⚠️ NOT IN TABLE (default: false)"}`);
  }

  // 5. Get role_permissions
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("role, permission_key")
    .eq("organization_id", orgId);

  console.log("\n=== ROLE PERMISSIONS (from role_permissions table) ===");
  if (!rolePerms?.length) {
    console.log("  No role_permissions entries — all roles use system defaults only");
  } else {
    const byRole = {};
    for (const rp of rolePerms) {
      if (!byRole[rp.role]) byRole[rp.role] = [];
      byRole[rp.role].push(rp.permission_key);
    }
    for (const [role, perms] of Object.entries(byRole)) {
      console.log(`  ${role}: ${perms.join(", ")}`);
    }
  }

  // 6. Get custom_roles
  const { data: customRoles } = await supabase
    .from("custom_roles")
    .select("id, name, permissions_json")
    .eq("organization_id", orgId);

  console.log("\n=== CUSTOM ROLES ===");
  if (!customRoles?.length) {
    console.log("  No custom roles defined");
  } else {
    for (const cr of customRoles) {
      console.log(`  ${cr.name} (id: ${cr.id})`);
      const pj = cr.permissions_json;
      if (pj) {
        // Show transfers and reservations specifically
        console.log(`    reservations: ${JSON.stringify(pj.reservations || "not defined")}`);
        console.log(`    transfers: ${JSON.stringify(pj.transfers || "not defined")}`);
      }
    }
  }

  // 7. Get user_permissions (overrides)
  const { data: userPerms } = await supabase
    .from("user_permissions")
    .select("user_id, permission_key, enabled")
    .eq("organization_id", orgId);

  console.log("\n=== USER PERMISSION OVERRIDES ===");
  if (!userPerms?.length) {
    console.log("  No user-specific overrides");
  } else {
    const byUser = {};
    for (const up of userPerms) {
      if (!byUser[up.user_id]) byUser[up.user_id] = [];
      byUser[up.user_id].push({ key: up.permission_key, enabled: up.enabled });
    }
    for (const [userId, perms] of Object.entries(byUser)) {
      const member = members?.find(m => m.user_id === userId);
      const profile = Array.isArray(member?.profile) ? member?.profile[0] : member?.profile;
      console.log(`  ${profile?.name || userId}:`);
      for (const p of perms) {
        console.log(`    ${p.key}: ${p.enabled ? "✅ GRANTED" : "❌ DENIED"}`);
      }
    }
  }

  // 8. Simulate permission resolution for each member
  console.log("\n=== SIMULATED EFFECTIVE PERMISSIONS (key modules) ===");
  for (const m of members || []) {
    const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    console.log(`\n  ${profile?.name || "Unknown"} (role: ${m.role}):`);
    
    // Check if role is custom
    const isCustom = m.role.startsWith("custom:") || !["owner", "admin", "manager", "member", "read_only"].includes(m.role);
    
    // Start with base view permissions
    const perms = {
      "reservations.view": true,
      "reservations.create": false,
      "reservations.manage": false,
      "transfers.view": true,
      "transfers.create": false,
      "transfers.manage": false,
    };

    // Apply role defaults
    if (m.role === "owner") {
      Object.keys(perms).forEach(k => perms[k] = true);
    } else if (m.role === "admin") {
      perms["reservations.create"] = true;
      perms["reservations.manage"] = true;
      perms["transfers.create"] = true;
      perms["transfers.update"] = true;
      perms["transfers.manage"] = true;
    } else if (m.role === "manager") {
      perms["reservations.create"] = true;
      perms["transfers.create"] = true;
      perms["transfers.update"] = true;
    }

    // Apply role_permissions
    const memberRolePerms = rolePerms?.filter(rp => rp.role === m.role) || [];
    for (const rp of memberRolePerms) {
      if (rp.permission_key in perms) {
        perms[rp.permission_key] = true;
      }
    }

    // Apply custom role
    if (isCustom) {
      const customRoleId = m.role.startsWith("custom:") ? m.role.replace("custom:", "") : m.role;
      const cr = customRoles?.find(c => c.id === customRoleId) || customRoles?.find(c => c.name.toLowerCase() === customRoleId.toLowerCase());
      if (cr?.permissions_json) {
        const pj = cr.permissions_json;
        if (pj.reservations) {
          if (pj.reservations.view !== undefined) perms["reservations.view"] = pj.reservations.view;
          if (pj.reservations.create !== undefined) perms["reservations.create"] = pj.reservations.create;
          if (pj.reservations.manage !== undefined) perms["reservations.manage"] = pj.reservations.manage;
        }
        if (pj.transfers) {
          if (pj.transfers.view !== undefined) perms["transfers.view"] = pj.transfers.view;
          if (pj.transfers.create !== undefined) perms["transfers.create"] = pj.transfers.create;
          if (pj.transfers.manage !== undefined) perms["transfers.manage"] = pj.transfers.manage;
        }
      } else {
        console.log(`    ⚠️ Custom role "${m.role}" NOT FOUND in custom_roles table!`);
      }
    }

    // Apply user overrides
    const memberOverrides = userPerms?.filter(up => up.user_id === m.user_id) || [];
    for (const ov of memberOverrides) {
      if (ov.permission_key in perms) {
        perms[ov.permission_key] = ov.enabled;
      }
    }

    for (const [key, value] of Object.entries(perms)) {
      console.log(`    ${key}: ${value ? "✅" : "❌"}`);
    }
  }
}

diagnose().catch(console.error);
