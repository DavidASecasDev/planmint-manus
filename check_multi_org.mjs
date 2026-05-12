import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key);

// Get all org members grouped by user
const { data: allMembers } = await client.from('organization_members').select('user_id, organization_id, role, status');
const userOrgs = {};
allMembers?.forEach(m => {
  if (!userOrgs[m.user_id]) userOrgs[m.user_id] = [];
  userOrgs[m.user_id].push({ org: m.organization_id, role: m.role, status: m.status });
});

// Find users in multiple orgs
const multiOrgUsers = Object.entries(userOrgs).filter(([_, orgs]) => orgs.length > 1);
console.log(`Users in multiple orgs: ${multiOrgUsers.length}`);
for (const [userId, orgs] of multiOrgUsers) {
  const { data: profile } = await client.from('profiles').select('name, organization_id').eq('id', userId).single();
  console.log(`  ${profile?.name || userId}: active org=${profile?.organization_id}`);
  for (const o of orgs) {
    console.log(`    - org ${o.org} (role: ${o.role}, status: ${o.status})`);
  }
}

// Get Bluebnc members
const { data: bluebncMembers } = await client.from('organization_members').select('user_id, role, status').eq('organization_id', '3091fe94-1de2-4d0f-a468-b7e6f36484bf');
console.log(`\nBluebnc members: ${bluebncMembers?.length}`);
for (const m of bluebncMembers || []) {
  const { data: p } = await client.from('profiles').select('name').eq('id', m.user_id).single();
  console.log(`  ${p?.name || m.user_id} (${m.role}, ${m.status})`);
}

// Check organizations table columns
const { data: orgDetail } = await client.from('organizations').select('*').limit(2);
console.log('\nOrganization columns:', Object.keys(orgDetail?.[0] || {}));
console.log('Orgs:');
orgDetail?.forEach(o => console.log(`  ${o.name} (${o.id}) - plan: ${o.plan || 'none'}, slug: ${o.slug || 'none'}`));
