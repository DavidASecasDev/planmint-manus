import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get org and a valid user token
const { data: orgs } = await sb.from('organizations').select('id').limit(1);
const orgId = orgs?.[0]?.id;

// Get a user to authenticate
const { data: members } = await sb.from('organization_members').select('user_id').eq('organization_id', orgId).limit(1);
const userId = members?.[0]?.user_id;

// Create a session for this user
const { data: authData } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'test@test.com', // won't work, let's use service role directly
});

// Instead, let's call the endpoint directly with the service role key
const today = new Date().toISOString().substring(0, 10);

// We need to simulate the request. Let's use fetch against the dev server
const port = 3000;
const baseUrl = `http://localhost:${port}`;

// Get a valid access token - use the admin user
const { data: profiles } = await sb.from('profiles').select('id, name').limit(1);
const testUserId = profiles?.[0]?.id;

// Generate a magic link to get a token
// Actually, let's just use the Supabase service role to sign in as a user
const { data: signInData, error: signInError } = await sb.auth.admin.listUsers();
const firstUser = signInData?.users?.[0];

if (!firstUser) {
  console.log('No users found');
  process.exit(1);
}

// Generate a link for the user
const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: firstUser.email,
});

if (linkError) {
  console.log('Error generating link:', linkError);
  // Try alternative: use the service role key as bearer
}

// Let's just test the logic manually
console.log('=== Manual capacity calculation test ===');
console.log('Date:', today);

// Get schedules
const { data: schedules } = await sb
  .from('staff_schedules')
  .select(`user_id, team_id, shift_templates!inner(name, start_time, end_time, is_day_off)`)
  .eq('organization_id', orgId)
  .eq('date', today);

const { data: teams } = await sb.from('teams').select('id, name').eq('organization_id', orgId);
const teamMap = new Map(teams.map(t => [t.id, t.name]));

const { data: teamMembers } = await sb
  .from('team_members')
  .select('user_id, team_id')
  .eq('organization_id', orgId);

const userTeamMap = new Map();
teamMembers.forEach(tm => {
  if (!userTeamMap.has(tm.user_id)) userTeamMap.set(tm.user_id, tm.team_id);
});

// Get profiles
const userIds = schedules.map(s => s.user_id);
const { data: profs } = await sb.from('profiles').select('id, name').in('id', userIds);
const nameMap = new Map(profs.map(p => [p.id, p.name]));

// Classify staff (same logic as endpoint)
const staffByTeam = { rentals: [], preparacion: [], mostrador: [], directiva: [] };

for (const s of schedules) {
  const tmpl = s.shift_templates;
  if (tmpl.is_day_off) continue;
  
  const effectiveTeamId = s.team_id || userTeamMap.get(s.user_id);
  const teamName = effectiveTeamId ? (teamMap.get(effectiveTeamId) || 'Unknown') : 'Unknown';
  const tn = teamName.toLowerCase();
  
  if (tn.includes('directiva') || tn.includes('direcci')) {
    staffByTeam.directiva.push({ name: nameMap.get(s.user_id), team: teamName, shift: `${tmpl.start_time}-${tmpl.end_time}` });
    continue; // EXCLUDED
  }
  
  if (tn.includes('rental')) {
    staffByTeam.rentals.push({ name: nameMap.get(s.user_id), shift: `${tmpl.start_time}-${tmpl.end_time}` });
  } else if (tn.includes('preparaci') || tn.includes('preparacion')) {
    staffByTeam.preparacion.push({ name: nameMap.get(s.user_id), shift: `${tmpl.start_time}-${tmpl.end_time}` });
  } else if (tn.includes('mostrador')) {
    staffByTeam.mostrador.push({ name: nameMap.get(s.user_id), shift: `${tmpl.start_time}-${tmpl.end_time}` });
  }
}

console.log('\n--- EXCLUDED (Directiva) ---');
staffByTeam.directiva.forEach(s => console.log(`  ${s.name} (${s.team}) ${s.shift}`));

console.log('\n--- INCLUDED ---');
console.log('Rentals (can do Rental + Escoba):');
staffByTeam.rentals.forEach(s => console.log(`  ${s.name} ${s.shift}`));
console.log('Mostrador (can do Rental + Escoba at 50%):');
staffByTeam.mostrador.forEach(s => console.log(`  ${s.name} ${s.shift}`));
console.log('Preparación (can ONLY do Escoba):');
staffByTeam.preparacion.forEach(s => console.log(`  ${s.name} ${s.shift}`));

// Get operations for today
const { data: reservations } = await sb
  .from('reservations')
  .select('id, desde, hasta, tipo_actividad, confirmed_entrega_datetime, confirmed_devolucion_datetime, lugar_entrega, lugar_devolucion, entrega_completada, devolucion_completada')
  .eq('organization_id', orgId)
  .is('archived_at', null)
  .neq('estado', 'Cancelada');

const ops = [];
for (const r of reservations || []) {
  const entregaDt = r.confirmed_entrega_datetime || r.desde;
  if (entregaDt && entregaDt.substring(0, 10) === today) {
    const loc = r.lugar_entrega || '';
    const isBase = ['aeropuerto', 'son oms', 'oficina azul', 'pmi'].some(kw => loc.toLowerCase().includes(kw));
    ops.push({ type: r.tipo_actividad === 'Transfer' ? 'Transfer' : 'Entrega', time: entregaDt.substring(11, 16), location: loc, isBase, completed: r.entrega_completada });
  }
  if (r.tipo_actividad !== 'Transfer') {
    const devolDt = r.confirmed_devolucion_datetime || r.hasta;
    if (devolDt && devolDt.substring(0, 10) === today) {
      const loc = r.lugar_devolucion || '';
      const isBase = ['aeropuerto', 'son oms', 'oficina azul', 'pmi'].some(kw => loc.toLowerCase().includes(kw));
      ops.push({ type: 'Devolución', time: devolDt.substring(11, 16), location: loc, isBase, completed: r.devolucion_completada });
    }
  }
}

console.log(`\n--- Operations today (${ops.length}) ---`);
ops.sort((a, b) => a.time.localeCompare(b.time));
for (const op of ops) {
  console.log(`  ${op.time} ${op.type} @ ${op.location || 'base'} ${op.isBase ? '(BASE)' : '(DOMICILIO)'} ${op.completed ? '[DONE]' : ''}`);
}

const baseOps = ops.filter(o => o.isBase).length;
const domicilioOps = ops.filter(o => !o.isBase).length;
console.log(`\nBase operations: ${baseOps} (need Rental only)`);
console.log(`Domicilio operations: ${domicilioOps} (need Rental + Escoba)`);
console.log(`\nCapacity model:`);
console.log(`  Rental demand = base_ops * 10min + domicilio_ops * (roundtrip + 10min)`);
console.log(`  Escoba demand = domicilio_ops * roundtrip`);
console.log(`  Rental capacity = Rentals * 60 + Mostrador * 30`);
console.log(`  Escoba capacity = Preparación * 60 (+ leftover Rental capacity)`);
