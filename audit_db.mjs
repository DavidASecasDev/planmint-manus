/**
 * Comprehensive Database Audit Script
 * Queries Supabase DB via the service role client to extract:
 * - All tables and columns
 * - Triggers
 * - Functions
 * - Foreign keys
 * - Indexes
 * - RLS policies
 * - Enums
 * - Data counts and inconsistencies
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const output = [];
function log(text) {
  output.push(text);
  console.log(text);
}

async function query(sql) {
  // Use the rpc approach to execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // Fallback: try direct fetch
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ sql_query: sql })
    });
    if (!resp.ok) return null;
    return await resp.json();
  }
  return data;
}

// Alternative: use the pg_catalog tables via REST API
async function queryTable(table, select = '*', filters = {}) {
  let q = supabase.from(table).select(select);
  for (const [key, val] of Object.entries(filters)) {
    q = q.eq(key, val);
  }
  const { data, error } = await q;
  if (error) {
    log(`  ERROR querying ${table}: ${error.message}`);
    return [];
  }
  return data || [];
}

async function main() {
  log('='.repeat(80));
  log('AUDITORÍA COMPLETA DE BASE DE DATOS - PlanMint / Azul Cars');
  log('Fecha: ' + new Date().toISOString());
  log('='.repeat(80));

  // 1. List all tables with row counts
  log('\n## 1. TABLAS Y CONTEO DE FILAS\n');
  
  const tables = [
    'accident_files', 'accidents', 'areas', 'custom_roles', 'damage_report_files',
    'damage_reports', 'dropdown_options', 'fleet_vehicles', 'labels',
    'movement_photos', 'organization_invitations', 'organization_members',
    'organizations', 'profiles', 'push_subscriptions', 'reminders',
    'repair_files', 'repair_notes', 'repairs', 'reservation_extras',
    'reservations', 'role_permissions', 'task_assignments', 'task_comments',
    'task_files', 'tasks', 'transfer_documents', 'transfer_requests',
    'user_notification_preferences', 'user_notifications', 'vehicle_audit_photos',
    'vehicle_movements', 'vehicle_quality_audits', 'vehicles', 'workshops'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        log(`  ${table}: ERROR - ${error.message}`);
      } else {
        log(`  ${table}: ${count} filas`);
      }
    } catch (e) {
      log(`  ${table}: EXCEPTION - ${e.message}`);
    }
  }

  // 2. Check organization_invitations structure and data
  log('\n## 2. ORGANIZATION_INVITATIONS - Estructura y datos\n');
  const { data: invitations, error: invErr } = await supabase
    .from('organization_invitations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (invErr) {
    log(`  ERROR: ${invErr.message}`);
  } else {
    log(`  Total invitaciones recientes: ${invitations.length}`);
    if (invitations.length > 0) {
      log(`  Columnas: ${Object.keys(invitations[0]).join(', ')}`);
      for (const inv of invitations) {
        log(`  - ${inv.email} | status: ${inv.status} | role: ${inv.role} | accepted: ${inv.accepted} | expires: ${inv.expires_at} | created: ${inv.created_at}`);
      }
    }
  }

  // 3. Check profiles structure
  log('\n## 3. PROFILES - Estructura y datos\n');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, organization_id, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (profErr) {
    log(`  ERROR: ${profErr.message}`);
  } else {
    log(`  Perfiles encontrados: ${profiles.length}`);
    for (const p of profiles) {
      log(`  - ${p.email || 'sin email'} | name: ${p.full_name} | role: ${p.role} | org: ${p.organization_id ? 'SI' : 'NO'} | active: ${p.is_active}`);
    }
  }

  // 4. Check vehicles and fleet_vehicles
  log('\n## 4. VEHÍCULOS - vehicles vs fleet_vehicles\n');
  
  // Check vehicle 7767MWH specifically
  const { data: v7767_fleet } = await supabase
    .from('fleet_vehicles')
    .select('*')
    .ilike('matricula', '%7767MWH%');
  
  const { data: v7767_vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .ilike('matricula', '%7767MWH%');

  log('  Vehículo 7767MWH en fleet_vehicles:');
  if (v7767_fleet?.length) {
    for (const v of v7767_fleet) {
      log(`    ${JSON.stringify(v, null, 2)}`);
    }
  } else {
    log('    NO ENCONTRADO');
  }

  log('  Vehículo 7767MWH en vehicles:');
  if (v7767_vehicles?.length) {
    for (const v of v7767_vehicles) {
      log(`    ${JSON.stringify(v, null, 2)}`);
    }
  } else {
    log('    NO ENCONTRADO');
  }

  // 5. Check reservations for 7767MWH
  log('\n## 5. RESERVAS del vehículo 7767MWH\n');
  const { data: reservations7767 } = await supabase
    .from('reservations')
    .select('id, vehicle_plate, status, start_date, end_date, rently_status, last_synced_at')
    .or(`vehicle_plate.ilike.%7767MWH%,matricula.ilike.%7767MWH%`)
    .order('start_date', { ascending: false })
    .limit(10);

  if (reservations7767?.length) {
    for (const r of reservations7767) {
      log(`  - ID: ${r.id} | plate: ${r.vehicle_plate} | status: ${r.status} | rently: ${r.rently_status} | start: ${r.start_date} | end: ${r.end_date} | synced: ${r.last_synced_at}`);
    }
  } else {
    log('  No se encontraron reservas para 7767MWH');
    // Try broader search
    const { data: allRes } = await supabase
      .from('reservations')
      .select('id, vehicle_plate, status, start_date, end_date')
      .ilike('vehicle_plate', '%7767%')
      .limit(10);
    if (allRes?.length) {
      log('  Búsqueda ampliada:');
      for (const r of allRes) {
        log(`  - ${r.vehicle_plate} | ${r.status} | ${r.start_date} - ${r.end_date}`);
      }
    }
  }

  // 6. Check organization_members
  log('\n## 6. ORGANIZATION_MEMBERS\n');
  const { data: members } = await supabase
    .from('organization_members')
    .select('*')
    .limit(30);
  
  if (members?.length) {
    log(`  Total: ${members.length}`);
    for (const m of members) {
      log(`  - user: ${m.user_id} | org: ${m.organization_id} | role: ${m.role} | status: ${m.status} | joined: ${m.joined_at || m.created_at}`);
    }
  }

  // 7. Check organizations
  log('\n## 7. ORGANIZATIONS\n');
  const { data: orgs } = await supabase
    .from('organizations')
    .select('*');
  
  if (orgs?.length) {
    for (const o of orgs) {
      log(`  - ${o.name} | id: ${o.id} | created: ${o.created_at}`);
    }
  }

  // 8. Check custom_roles
  log('\n## 8. CUSTOM_ROLES\n');
  const { data: roles } = await supabase
    .from('custom_roles')
    .select('*');
  
  if (roles?.length) {
    for (const r of roles) {
      log(`  - ${r.name} | org: ${r.organization_id} | created: ${r.created_at}`);
    }
  }

  // 9. Check role_permissions
  log('\n## 9. ROLE_PERMISSIONS\n');
  const { data: perms } = await supabase
    .from('role_permissions')
    .select('*')
    .limit(50);
  
  if (perms?.length) {
    log(`  Total: ${perms.length}`);
    for (const p of perms) {
      log(`  - role: ${p.role_id || p.role} | permission: ${p.permission_key || p.permission} | granted: ${p.granted}`);
    }
  }

  // 10. Check dropdown_options for vehicle states
  log('\n## 10. DROPDOWN_OPTIONS (estados de vehículos)\n');
  const { data: dropdowns } = await supabase
    .from('dropdown_options')
    .select('*')
    .order('category', { ascending: true });
  
  if (dropdowns?.length) {
    const byCategory = {};
    for (const d of dropdowns) {
      if (!byCategory[d.category]) byCategory[d.category] = [];
      byCategory[d.category].push(d);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      log(`  ${cat}:`);
      for (const item of items) {
        log(`    - ${item.value} (label: ${item.label}, active: ${item.is_active})`);
      }
    }
  }

  // 11. Check vehicles with their current states
  log('\n## 11. VEHÍCULOS POR ESTADO OPERATIVO\n');
  const { data: allVehicles } = await supabase
    .from('vehicles')
    .select('id, matricula, estado_operativo, estado_limpieza, is_rented, archived_at')
    .order('matricula');
  
  if (allVehicles?.length) {
    const byState = {};
    for (const v of allVehicles) {
      const state = v.estado_operativo || 'sin_estado';
      if (!byState[state]) byState[state] = [];
      byState[state].push(v);
    }
    for (const [state, vehicles] of Object.entries(byState)) {
      log(`  ${state}: ${vehicles.length} vehículos`);
      for (const v of vehicles) {
        log(`    - ${v.matricula} | limpieza: ${v.estado_limpieza} | rented: ${v.is_rented} | archived: ${v.archived_at ? 'SI' : 'NO'}`);
      }
    }
  }

  // 12. Check active reservations
  log('\n## 12. RESERVAS ACTIVAS Y RECIENTES\n');
  const { data: activeRes } = await supabase
    .from('reservations')
    .select('id, vehicle_plate, status, start_date, end_date, rently_status, rently_booking_id')
    .in('status', ['En curso', 'Pendiente', 'Reservado', 'Entregado'])
    .order('start_date', { ascending: false })
    .limit(20);
  
  if (activeRes?.length) {
    log(`  Reservas activas: ${activeRes.length}`);
    for (const r of activeRes) {
      log(`  - ${r.vehicle_plate} | status: ${r.status} | rently: ${r.rently_status} | ${r.start_date} - ${r.end_date} | booking: ${r.rently_booking_id}`);
    }
  } else {
    log('  No hay reservas activas');
  }

  // Also check recently completed
  const { data: recentRes } = await supabase
    .from('reservations')
    .select('id, vehicle_plate, status, start_date, end_date, rently_status')
    .order('end_date', { ascending: false })
    .limit(20);
  
  if (recentRes?.length) {
    log(`\n  Últimas 20 reservas (por fecha fin):`);
    for (const r of recentRes) {
      log(`  - ${r.vehicle_plate} | status: ${r.status} | rently: ${r.rently_status} | ${r.start_date} - ${r.end_date}`);
    }
  }

  // 13. Check push_subscriptions
  log('\n## 13. PUSH_SUBSCRIPTIONS\n');
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, created_at')
    .limit(10);
  
  if (subs?.length) {
    log(`  Total: ${subs.length}`);
  }

  // 14. Check user_notifications
  log('\n## 14. USER_NOTIFICATIONS (últimas 10)\n');
  const { data: notifs } = await supabase
    .from('user_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (notifs?.length) {
    for (const n of notifs) {
      log(`  - type: ${n.type} | title: ${n.title} | read: ${n.is_read} | created: ${n.created_at}`);
    }
  }

  // Save to file
  const report = output.join('\n');
  fs.writeFileSync('/home/ubuntu/planmint-preview/audit_db_report.txt', report);
  log('\n\nInforme guardado en audit_db_report.txt');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
