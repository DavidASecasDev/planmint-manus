import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get the org ID
const { data: orgs } = await sb.from('organizations').select('id, name').limit(5);
console.log('Organizations:', orgs);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.log('No org found'); process.exit(1); }

// Get today's date
const today = new Date().toISOString().substring(0, 10);
console.log('\nDate:', today);

// 1. Get all teams
const { data: teams } = await sb.from('teams').select('id, name').eq('organization_id', orgId);
console.log('\nTeams:', teams?.map(t => `${t.name} (${t.id})`));

// 2. Get team_members for each team
for (const team of teams || []) {
  const { data: members } = await sb
    .from('team_members')
    .select('user_id, profile:profiles!team_members_user_id_fkey(id, name)')
    .eq('team_id', team.id);
  console.log(`\n${team.name} members:`, members?.map(m => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return `${p?.name || 'unknown'} (${m.user_id})`;
  }));
}

// 3. Get staff_schedules for today
const { data: schedules } = await sb
  .from('staff_schedules')
  .select(`
    user_id,
    team_id,
    shift_template_id,
    shift_templates!inner(id, name, start_time, end_time, is_day_off)
  `)
  .eq('organization_id', orgId)
  .eq('date', today);

console.log('\n--- Staff schedules for today ---');
for (const s of schedules || []) {
  const tmpl = s.shift_templates;
  // Look up team from team_members if team_id is null
  let teamName = 'NULL';
  if (s.team_id) {
    const team = teams?.find(t => t.id === s.team_id);
    teamName = team?.name || s.team_id;
  } else {
    // Fallback: look up in team_members
    const { data: tm } = await sb
      .from('team_members')
      .select('team_id')
      .eq('user_id', s.user_id)
      .eq('organization_id', orgId);
    if (tm && tm.length > 0) {
      const team = teams?.find(t => t.id === tm[0].team_id);
      teamName = `(fallback) ${team?.name || tm[0].team_id}`;
    }
  }
  
  // Get user name
  const { data: profile } = await sb.from('profiles').select('name').eq('id', s.user_id).maybeSingle();
  
  console.log(`  ${profile?.name || s.user_id} | team: ${teamName} | shift: ${tmpl.name} ${tmpl.start_time}-${tmpl.end_time} | dayOff: ${tmpl.is_day_off}`);
}

// 4. Check which ones the capacity endpoint would include
console.log('\n--- Capacity endpoint would include (excluding Directiva) ---');
const staffShifts = [];
for (const s of schedules || []) {
  const tmpl = s.shift_templates;
  if (tmpl.is_day_off) continue;
  
  let teamName = null;
  if (s.team_id) {
    const team = teams?.find(t => t.id === s.team_id);
    teamName = team?.name || null;
  }
  if (!teamName) {
    const { data: tm } = await sb
      .from('team_members')
      .select('team_id')
      .eq('user_id', s.user_id)
      .eq('organization_id', orgId);
    if (tm && tm.length > 0) {
      const team = teams?.find(t => t.id === tm[0].team_id);
      teamName = team?.name || null;
    }
  }
  
  const tn = (teamName || '').toLowerCase();
  const isDirectiva = tn.includes('directiva') || tn.includes('direcci');
  
  const { data: profile } = await sb.from('profiles').select('name').eq('id', s.user_id).maybeSingle();
  
  console.log(`  ${profile?.name || s.user_id} | team: ${teamName} | ${isDirectiva ? 'EXCLUDED (Directiva)' : 'INCLUDED'} | ${tmpl.start_time}-${tmpl.end_time}`);
  
  if (!isDirectiva) {
    staffShifts.push({
      name: profile?.name,
      team: teamName,
      start: tmpl.start_time,
      end: tmpl.end_time,
    });
  }
}

console.log(`\nTotal included staff: ${staffShifts.length}`);
console.log('Staff:', staffShifts.map(s => `${s.name} (${s.team})`));
