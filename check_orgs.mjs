import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key);

// Get all organizations
const { data: orgs } = await client.from('organizations').select('*');
console.log('=== Organizations ===');
console.table(orgs);

// Get organization_members with profiles
const { data: members } = await client.from('organization_members').select('user_id, organization_id, role, status').limit(20);
console.log('\n=== Organization Members (first 20) ===');
console.table(members);

// Get organization_modules
const { data: modules } = await client.from('organization_modules').select('*');
console.log('\n=== Organization Modules ===');
console.table(modules);

// Check if there's an org switcher or multi-org support
const { data: multiOrgUsers } = await client.rpc('get_multi_org_users').catch(() => ({ data: null }));
if (multiOrgUsers) {
  console.log('\n=== Multi-org users ===');
  console.table(multiOrgUsers);
}

// Count members per org
const { data: orgCounts } = await client.from('organization_members').select('organization_id').order('organization_id');
const counts = {};
orgCounts?.forEach(m => { counts[m.organization_id] = (counts[m.organization_id] || 0) + 1; });
console.log('\n=== Members per org ===');
console.log(counts);
