import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check orphaned profiles (users without org)
const { data: orphans } = await sb.from('profiles').select('id, name, organization_id, role').is('organization_id', null);
console.log('=== Orphaned profiles (no org) ===');
console.log(JSON.stringify(orphans, null, 2));

// Check the organization_members count vs profiles count
const { count: profileCount } = await sb.from('profiles').select('id', { count: 'exact', head: true });
const { count: memberCount } = await sb.from('organization_members').select('id', { count: 'exact', head: true });
console.log('\nProfiles:', profileCount, 'Members:', memberCount);

// Check for profiles that have org_id but no matching member entry
const { data: profiles } = await sb.from('profiles').select('id, name, organization_id').not('organization_id', 'is', null);
console.log('\n=== Profiles with org but no matching member entry ===');
for (const p of profiles || []) {
  const { data: member } = await sb.from('organization_members').select('id').eq('user_id', p.id).eq('organization_id', p.organization_id).maybeSingle();
  if (member === null) {
    console.log('ORPHAN:', p.name, '- has org', p.organization_id, 'but no member entry');
  }
}

// Check for members without matching profile
console.log('\n=== Members without matching profile ===');
const { data: members } = await sb.from('organization_members').select('id, user_id, organization_id, role, status');
for (const m of members || []) {
  const { data: profile } = await sb.from('profiles').select('id, name').eq('id', m.user_id).maybeSingle();
  if (profile === null) {
    console.log('ORPHAN MEMBER:', m.user_id, '- role:', m.role, 'org:', m.organization_id);
  }
}

// Check pending invitations
console.log('\n=== Pending invitations ===');
const { data: invitations } = await sb.from('organization_invitations').select('*').eq('status', 'pending');
console.log(JSON.stringify(invitations, null, 2));

// Check organizations
console.log('\n=== Organizations ===');
const { data: orgs } = await sb.from('organizations').select('id, name, created_at');
console.log(JSON.stringify(orgs, null, 2));

// Check super_admins
console.log('\n=== Super Admins ===');
const { data: superAdmins } = await sb.from('super_admins').select('*');
console.log(JSON.stringify(superAdmins, null, 2));
