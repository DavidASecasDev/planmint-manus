import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET');
console.log('SERVICE_KEY:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.substring(0, 20) + '...' : 'NOT SET');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('Missing env vars. Checking .env file...');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnose() {
  console.log('=== COMPREHENSIVE PERMISSIONS DIAGNOSTIC ===\n');

  // 1. Get all organizations
  const { data: orgs, error: orgsError } = await supabase.from('organizations').select('id, name');
  console.log('Organizations:', JSON.stringify(orgs));
  if (orgsError) console.log('Orgs error:', orgsError.message);

  if (!orgs || orgs.length === 0) {
    console.log('No organizations found. Trying to get org from organization_members...');
    const { data: allMembers } = await supabase.from('organization_members').select('organization_id').limit(5);
    console.log('Sample members:', JSON.stringify(allMembers));
    if (!allMembers || allMembers.length === 0) return;
  }

  // Use the second org (Azul Cars) or first available
  const orgId = orgs && orgs.length > 1 ? orgs[1].id : (orgs && orgs[0]?.id);
  console.log(`\nUsing org ID: ${orgId}\n`);

  // 2. Get all members of this org
  const { data: members } = await supabase
    .from('organization_members')
    .select('id, user_id, role, status')
    .eq('organization_id', orgId);
  
  console.log('=== ORGANIZATION MEMBERS ===');
  for (const m of members || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', m.user_id)
      .single();
    console.log(`  ${profile?.name || 'Unknown'} (${m.user_id})`);
    console.log(`    Role: "${m.role}" | Status: ${m.status}`);
    console.log(`    Is custom role: ${!['owner', 'admin', 'manager', 'member', 'read_only'].includes(m.role)}`);
  }

  // 3. Get role_permissions for this org
  const { data: rolePerms, error: rpError } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('organization_id', orgId);
  
  console.log(`\n=== ROLE_PERMISSIONS for org ${orgId} ===`);
  console.log(`  Count: ${rolePerms?.length || 0}`);
  if (rpError) console.log(`  Error: ${rpError.message}`);
  
  // Group by role
  const byRole = {};
  for (const rp of rolePerms || []) {
    if (!byRole[rp.role]) byRole[rp.role] = [];
    byRole[rp.role].push(rp.permission_key);
  }
  for (const [role, perms] of Object.entries(byRole)) {
    console.log(`  Role "${role}": ${perms.length} permissions`);
    console.log(`    ${perms.join(', ')}`);
  }

  // Also check role_permissions WITHOUT org filter (global defaults)
  const { data: globalRolePerms } = await supabase
    .from('role_permissions')
    .select('*');
  
  console.log(`\n=== ALL ROLE_PERMISSIONS (global) ===`);
  console.log(`  Total count: ${globalRolePerms?.length || 0}`);
  const globalByRole = {};
  for (const rp of globalRolePerms || []) {
    const key = `${rp.role} (org: ${rp.organization_id || 'NULL'})`;
    if (!globalByRole[key]) globalByRole[key] = [];
    globalByRole[key].push(rp.permission_key);
  }
  for (const [role, perms] of Object.entries(globalByRole)) {
    console.log(`  ${role}: ${perms.length} permissions`);
  }

  // 4. Get custom_roles for this org
  const { data: customRoles } = await supabase
    .from('custom_roles')
    .select('*')
    .eq('organization_id', orgId);
  
  console.log(`\n=== CUSTOM_ROLES for org ===`);
  for (const cr of customRoles || []) {
    console.log(`  ${cr.name} (${cr.id})`);
    console.log(`    is_system: ${cr.is_system}`);
    console.log(`    permissions_json keys: ${JSON.stringify(Object.keys(cr.permissions_json || {}))}`);
    // Show transfers and reservations permissions specifically
    const pj = cr.permissions_json;
    console.log(`    transfers: ${JSON.stringify(pj?.transfers)}`);
    console.log(`    reservations: ${JSON.stringify(pj?.reservations)}`);
  }

  // 5. Get user_permissions (overrides) for this org
  const { data: userPerms } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('organization_id', orgId);
  
  console.log(`\n=== USER_PERMISSIONS (overrides) for org ===`);
  const byUser = {};
  for (const up of userPerms || []) {
    if (!byUser[up.user_id]) byUser[up.user_id] = [];
    byUser[up.user_id].push({ key: up.permission_key, enabled: up.enabled });
  }
  for (const [userId, perms] of Object.entries(byUser)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    console.log(`  ${profile?.name || userId}:`);
    for (const p of perms) {
      console.log(`    ${p.key}: ${p.enabled}`);
    }
  }

  // 6. Get organization_modules for this org
  const { data: orgModules } = await supabase
    .from('organization_modules')
    .select('*')
    .eq('organization_id', orgId);
  
  console.log(`\n=== ORGANIZATION_MODULES for org ===`);
  for (const m of orgModules || []) {
    console.log(`  ${m.module_key}: ${m.enabled}`);
  }

  // 7. Simulate the exact permission resolution for each member
  console.log('\n=== SIMULATED PERMISSION RESOLUTION ===');
  for (const m of members || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', m.user_id)
      .single();
    
    const name = profile?.name || 'Unknown';
    const role = m.role;
    const isCustomRole = !['owner', 'admin', 'manager', 'member', 'read_only'].includes(role);
    
    console.log(`\n--- ${name} (role: "${role}", custom: ${isCustomRole}) ---`);
    
    // Step 1: Base view permissions
    const permissions = {};
    const baseView = [
      'tasks.view', 'areas.view', 'tags.view', 'templates.view', 'teams.view',
      'members.view', 'reservations.view', 'vehicles.view', 'movements.view',
      'daily_tasks.view', 'fleet.view', 'garatech.view', 'transfers.view',
      'forms.view', 'time_tracking.view'
    ];
    for (const k of baseView) permissions[k] = true;
    console.log(`  Step 1 (base view): ${Object.keys(permissions).filter(k => permissions[k]).length} permissions`);

    // Step 2: Role-specific defaults from role_permissions table
    const roleSpecificPerms = (rolePerms || []).filter(rp => rp.role === role);
    for (const rp of roleSpecificPerms) {
      permissions[rp.permission_key] = true;
    }
    console.log(`  Step 2 (role_permissions table for "${role}"): found ${roleSpecificPerms.length} entries`);

    // Step 3: Hardcoded role defaults
    if (role === 'manager') {
      const managerDefaults = [
        'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.change_status',
        'areas.create', 'areas.update',
        'tags.create', 'tags.update',
        'templates.apply',
        'automations.view',
        'reports.view',
        'reservations.create',
        'garatech.create', 'garatech.update', 'garatech.change_status',
        'transfers.create', 'transfers.update', 'transfers.change_status',
        'forms.create', 'forms.update', 'forms.view_responses',
        'vehicles.update', 'vehicles.manage_daily_tasks', 'vehicles.change_status', 'vehicles.complete_tasks', 'vehicles.manage_locations',
        'time_tracking.view_team', 'time_tracking.create',
        'movements.create', 'movements.manage', 'movements.edit_photos', 'movements.upload_receipt',
        'daily_tasks.view_other_days', 'daily_tasks.complete', 'daily_tasks.manage',
      ];
      for (const k of managerDefaults) permissions[k] = true;
      console.log(`  Step 3 (hardcoded manager defaults): added ${managerDefaults.length} permissions`);
    } else if (role === 'member') {
      const memberDefaults = [
        'tasks.create', 'tasks.update',
        'vehicles.change_status', 'vehicles.complete_tasks',
        'movements.create', 'movements.upload_receipt',
        'daily_tasks.complete',
        'time_tracking.create',
      ];
      for (const k of memberDefaults) permissions[k] = true;
      console.log(`  Step 3 (hardcoded member defaults): added ${memberDefaults.length} permissions`);
    }

    // Step 4: Custom role resolution
    if (isCustomRole) {
      const customRoleId = role.startsWith('custom:') ? role.replace('custom:', '') : role;
      const customRole = (customRoles || []).find(cr => cr.id === customRoleId);
      
      if (!customRole) {
        // Try by name
        const byName = (customRoles || []).find(cr => cr.name.toLowerCase() === customRoleId.toLowerCase());
        if (byName) {
          console.log(`  Step 4 (custom role): Found by name "${byName.name}"`);
        } else {
          console.log(`  Step 4 (custom role): NOT FOUND for id="${customRoleId}" - THIS IS A PROBLEM!`);
        }
      } else {
        console.log(`  Step 4 (custom role): Found "${customRole.name}"`);
        console.log(`    transfers permissions: ${JSON.stringify(customRole.permissions_json?.transfers)}`);
        console.log(`    reservations permissions: ${JSON.stringify(customRole.permissions_json?.reservations)}`);
      }
    } else {
      console.log(`  Step 4 (custom role): N/A - system role`);
    }

    // Step 5: User overrides
    const userOverrides = (userPerms || []).filter(up => up.user_id === m.user_id);
    for (const ov of userOverrides) {
      permissions[ov.permission_key] = ov.enabled;
    }
    console.log(`  Step 5 (user overrides): ${userOverrides.length} overrides applied`);
    for (const ov of userOverrides) {
      console.log(`    ${ov.permission_key}: ${ov.enabled}`);
    }

    // Final result for key permissions
    console.log(`  FINAL transfers.view: ${permissions['transfers.view']}`);
    console.log(`  FINAL transfers.create: ${permissions['transfers.create']}`);
    console.log(`  FINAL transfers.manage: ${permissions['transfers.manage']}`);
    console.log(`  FINAL reservations.view: ${permissions['reservations.view']}`);
    console.log(`  FINAL reservations.create: ${permissions['reservations.create']}`);
    console.log(`  FINAL reservations.manage: ${permissions['reservations.manage']}`);
  }

  // 8. Check profiles.organization_id vs organization_members
  console.log('\n=== PROFILE vs ORGANIZATION_MEMBERS CONSISTENCY ===');
  for (const m of members || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, organization_id')
      .eq('id', m.user_id)
      .single();
    
    const match = profile?.organization_id === orgId;
    console.log(`  ${profile?.name}: profile.org_id=${profile?.organization_id} | member.org_id=${orgId} | match=${match}`);
  }
}

diagnose().catch(console.error);
