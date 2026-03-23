import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Try reading from .env
  const envContent = fs.readFileSync('.env', 'utf-8');
  const lines = envContent.split('\n');
  const env = {};
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
  }
  var url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  var key = env.SUPABASE_SERVICE_ROLE_KEY;
}

const supabase = createClient(supabaseUrl || url, supabaseKey || key);

async function runSQL(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // Try direct query approach
    return null;
  }
  return data;
}

async function queryTable(table, select = '*', limit = 1000) {
  const { data, error } = await supabase.from(table).select(select).limit(limit);
  if (error) return { error: error.message };
  return data;
}

async function audit() {
  const report = [];
  
  // 1. Get all tables via pg_catalog
  report.push('=== 1. ALL PUBLIC TABLES ===');
  const tables = await queryTable('pg_tables', 'tablename', 200);
  // This won't work because pg_tables is not exposed. Use information_schema approach
  
  // Try getting column info for key tables
  const keyTables = [
    'organizations', 'profiles', 'organization_members', 'organization_invitations',
    'vehicles', 'fleet_vehicles', 'reservations', 'tasks', 'task_assignments',
    'custom_roles', 'notifications', 'areas', 'labels', 'reminders',
    'transfers', 'damage_reports', 'damage_report_items', 'accidents',
    'vehicle_movements', 'vehicle_locations', 'vehicle_quality_audits',
    'vehicle_audit_photos', 'vehicle_cleaning_tasks', 'vehicle_cleaning_history',
    'forms', 'form_responses', 'automation_rules', 'automation_runs',
    'audit_logs', 'user_permissions', 'user_role_assignments',
    'daily_task_templates', 'feature_flags', 'workshops',
    'operation_legs', 'billing_events', 'billing_products',
    'user_feedback', 'user_sessions', 'user_templates',
    'broker_rate_limits', 'broker_registration_requests', 'broker_registration_incidents',
    'coupon_redemptions', 'trials', 'usage_events',
    'area_access_rules', 'automation_throttle', 'billing_products_public',
    'accident_files'
  ];
  
  for (const table of keyTables) {
    report.push(`\n=== TABLE: ${table} ===`);
    try {
      // Get one row to see columns
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        report.push(`  ERROR: ${error.message}`);
      } else if (data && data.length > 0) {
        const cols = Object.keys(data[0]);
        report.push(`  COLUMNS (${cols.length}): ${cols.join(', ')}`);
        // Show sample values for type inference
        const sample = data[0];
        for (const col of cols) {
          const val = sample[col];
          const type = val === null ? 'null' : typeof val;
          report.push(`    ${col}: ${type} = ${JSON.stringify(val)?.substring(0, 100)}`);
        }
      } else {
        // Empty table - try to get columns from error
        report.push(`  EMPTY TABLE (0 rows)`);
        // Try selecting with a bad filter to get column names
        const { data: d2, error: e2 } = await supabase.from(table).select('*').limit(0);
        if (d2) report.push(`  (confirmed exists)`);
      }
    } catch (e) {
      report.push(`  EXCEPTION: ${e.message}`);
    }
    
    // Get row count
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error) {
        report.push(`  ROW COUNT: ${count}`);
      }
    } catch (e) {}
  }
  
  // 2. Check organization_invitations in detail
  report.push('\n\n=== ORGANIZATION_INVITATIONS - ALL ROWS ===');
  const { data: invitations, error: invErr } = await supabase
    .from('organization_invitations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (invErr) {
    report.push(`ERROR: ${invErr.message}`);
  } else {
    report.push(`Total visible: ${invitations.length}`);
    for (const inv of invitations) {
      report.push(JSON.stringify(inv));
    }
  }
  
  // 3. Check organization_members
  report.push('\n\n=== ORGANIZATION_MEMBERS - ALL ROWS ===');
  const { data: members, error: memErr } = await supabase
    .from('organization_members')
    .select('*')
    .limit(50);
  if (memErr) {
    report.push(`ERROR: ${memErr.message}`);
  } else {
    report.push(`Total: ${members.length}`);
    for (const m of members) {
      report.push(JSON.stringify(m));
    }
  }
  
  // 4. Check organizations
  report.push('\n\n=== ORGANIZATIONS - ALL ROWS ===');
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .limit(50);
  if (orgErr) {
    report.push(`ERROR: ${orgErr.message}`);
  } else {
    report.push(`Total: ${orgs.length}`);
    for (const o of orgs) {
      report.push(JSON.stringify(o));
    }
  }
  
  // 5. Check profiles
  report.push('\n\n=== PROFILES - ALL ROWS ===');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .limit(50);
  if (profErr) {
    report.push(`ERROR: ${profErr.message}`);
  } else {
    report.push(`Total: ${profiles.length}`);
    for (const p of profiles) {
      report.push(JSON.stringify(p));
    }
  }
  
  // 6. Check custom_roles
  report.push('\n\n=== CUSTOM_ROLES - ALL ROWS ===');
  const { data: roles, error: roleErr } = await supabase
    .from('custom_roles')
    .select('*')
    .limit(50);
  if (roleErr) {
    report.push(`ERROR: ${roleErr.message}`);
  } else {
    report.push(`Total: ${roles.length}`);
    for (const r of roles) {
      report.push(JSON.stringify(r));
    }
  }
  
  // 7. Check reservations
  report.push('\n\n=== RESERVATIONS - RECENT 20 ===');
  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (resErr) {
    report.push(`ERROR: ${resErr.message}`);
  } else {
    report.push(`Total visible: ${reservations.length}`);
    if (reservations.length > 0) {
      report.push(`COLUMNS: ${Object.keys(reservations[0]).join(', ')}`);
    }
    for (const r of reservations) {
      report.push(JSON.stringify(r));
    }
  }
  
  // 8. Check vehicles
  report.push('\n\n=== VEHICLES - SAMPLE 5 ===');
  const { data: vehicles, error: vehErr } = await supabase
    .from('vehicles')
    .select('*')
    .limit(5);
  if (vehErr) {
    report.push(`ERROR: ${vehErr.message}`);
  } else {
    if (vehicles.length > 0) {
      report.push(`COLUMNS: ${Object.keys(vehicles[0]).join(', ')}`);
    }
    for (const v of vehicles) {
      report.push(JSON.stringify(v));
    }
  }
  
  // 9. Check fleet_vehicles
  report.push('\n\n=== FLEET_VEHICLES - SAMPLE 5 ===');
  const { data: fleet, error: fleetErr } = await supabase
    .from('fleet_vehicles')
    .select('*')
    .limit(5);
  if (fleetErr) {
    report.push(`ERROR: ${fleetErr.message}`);
  } else {
    if (fleet.length > 0) {
      report.push(`COLUMNS: ${Object.keys(fleet[0]).join(', ')}`);
    }
    for (const f of fleet) {
      report.push(JSON.stringify(f));
    }
  }
  
  // 10. Check tasks
  report.push('\n\n=== TASKS - SAMPLE 5 ===');
  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .limit(5);
  if (taskErr) {
    report.push(`ERROR: ${taskErr.message}`);
  } else {
    if (tasks.length > 0) {
      report.push(`COLUMNS: ${Object.keys(tasks[0]).join(', ')}`);
    }
    for (const t of tasks) {
      report.push(JSON.stringify(t));
    }
  }
  
  // 11. Check transfers
  report.push('\n\n=== TRANSFERS - SAMPLE 5 ===');
  const { data: transfers, error: transErr } = await supabase
    .from('transfers')
    .select('*')
    .limit(5);
  if (transErr) {
    report.push(`ERROR: ${transErr.message}`);
  } else {
    if (transfers.length > 0) {
      report.push(`COLUMNS: ${Object.keys(transfers[0]).join(', ')}`);
    }
    for (const t of transfers) {
      report.push(JSON.stringify(t));
    }
  }

  // Write report
  fs.writeFileSync('/home/ubuntu/audit_comprehensive_report.txt', report.join('\n'), 'utf-8');
  console.log(`Report written with ${report.length} lines`);
}

audit().catch(e => console.error('Audit failed:', e));
