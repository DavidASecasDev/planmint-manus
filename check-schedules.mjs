/**
 * Diagnostic script: Check staff_schedules for a given date.
 * Usage: node check-schedules.mjs [YYYY-MM-DD]
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const date = process.argv[2] || "2026-05-13";
console.log(`\n=== Checking staff_schedules for date: ${date} ===\n`);

// 1. Check staff_schedules
const { data: schedules, error: schedErr } = await sb
  .from("staff_schedules")
  .select(`
    id, user_id, team_id, date, shift_template_id,
    shift_templates(id, name, start_time, end_time, is_day_off)
  `)
  .eq("date", date)
  .limit(50);

if (schedErr) {
  console.error("Error fetching staff_schedules:", schedErr);
} else {
  console.log(`Found ${schedules?.length || 0} schedule entries for ${date}`);
  if (schedules && schedules.length > 0) {
    for (const s of schedules) {
      console.log(`  user_id=${s.user_id}, team_id=${s.team_id}, template=${JSON.stringify(s.shift_templates)}`);
    }
  }
}

// 2. Check teams
const { data: teams, error: teamErr } = await sb
  .from("teams")
  .select("id, name")
  .limit(20);

if (teamErr) {
  console.error("Error fetching teams:", teamErr);
} else {
  console.log(`\n=== Teams (${teams?.length || 0}) ===`);
  for (const t of teams || []) {
    console.log(`  ${t.id}: ${t.name}`);
  }
}

// 3. Check shift_templates
const { data: templates, error: tplErr } = await sb
  .from("shift_templates")
  .select("id, name, start_time, end_time, is_day_off")
  .limit(20);

if (tplErr) {
  console.error("Error fetching shift_templates:", tplErr);
} else {
  console.log(`\n=== Shift Templates (${templates?.length || 0}) ===`);
  for (const t of templates || []) {
    console.log(`  ${t.id}: ${t.name} (${t.start_time}-${t.end_time}) day_off=${t.is_day_off}`);
  }
}

// 4. Check if there are ANY schedules at all
const { data: anySchedules, error: anyErr } = await sb
  .from("staff_schedules")
  .select("date, count")
  .limit(5)
  .order("date", { ascending: false });

if (!anyErr && anySchedules) {
  console.log(`\n=== Most recent staff_schedules entries ===`);
  for (const s of anySchedules) {
    console.log(`  date=${s.date}`);
  }
}

// 5. Check total count
const { count } = await sb
  .from("staff_schedules")
  .select("id", { count: "exact", head: true });

console.log(`\n=== Total staff_schedules rows: ${count} ===`);

// 6. Check reservations for this date
const { data: reservations, error: resErr } = await sb
  .from("reservations")
  .select("id, desde, hasta, tipo_actividad, estado, confirmed_entrega_datetime, confirmed_devolucion_datetime, entrega_completada, devolucion_completada")
  .is("archived_at", null)
  .neq("estado", "Cancelada")
  .limit(100);

const opsForDate = [];
for (const r of reservations || []) {
  const entregaDt = r.confirmed_entrega_datetime || r.desde;
  const devolDt = r.confirmed_devolucion_datetime || r.hasta;
  
  if (entregaDt && entregaDt.substring(0, 10) === date) {
    opsForDate.push({ type: r.tipo_actividad === "Transfer" ? "Transfer" : "Entrega", dt: entregaDt, resId: r.id });
  }
  if (r.tipo_actividad !== "Transfer" && devolDt && devolDt.substring(0, 10) === date) {
    opsForDate.push({ type: "Devolución", dt: devolDt, resId: r.id });
  }
}

console.log(`\n=== Operations for ${date}: ${opsForDate.length} ===`);
for (const op of opsForDate.sort((a, b) => a.dt.localeCompare(b.dt))) {
  console.log(`  ${op.type} at ${op.dt} (res: ${op.resId})`);
}
