#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="planmint_schedule_order_fixture_$$"
PRELUDE_TMP="/tmp/planmint_schedule_order_prelude_$$.sql"
MIGRATION_TMP="/tmp/planmint_schedule_order_migration_$$.sql"
ORG="00000000-0000-0000-0000-000000000001"
TEAM="10000000-0000-0000-0000-000000000001"
ACTOR="20000000-0000-0000-0000-000000000100"
ORDER="ARRAY['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000006']::uuid[]"
CALL_SQL="select changed||'/'||member_count||'/'||stored_count||'/'||sequence_valid from public.replace_schedule_member_order('$ORG','$TEAM','2026-09-21',$ORDER,'$ACTOR','owner');"

cleanup() {
  sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1 || true
  rm -f "$PRELUDE_TMP" "$MIGRATION_TMP"
}
trap cleanup EXIT

install -m 0644 "$ROOT/server/scheduleFixtures/memberOrderPrelude.sql" "$PRELUDE_TMP"
install -m 0644 "$ROOT/supabase/migrations/20260917111600_schedule_member_order_replace.sql" "$MIGRATION_TMP"
sudo -u postgres createdb "$DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$PRELUDE_TMP" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIGRATION_TMP" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$MIGRATION_TMP" >/dev/null

staff_before="$(sudo -u postgres psql -At -d "$DB" -c "select md5(string_agg(concat_ws('|',id,user_id,date,shift_template_id),E'\\n' order by id)) from public.staff_schedules;")"
time_before="$(sudo -u postgres psql -At -d "$DB" -c "select md5(string_agg(concat_ws('|',id,user_id,started_at),E'\\n' order by id)) from public.time_entries;")"
other_order_before="$(sudo -u postgres psql -At -d "$DB" -c "select md5(string_agg(concat_ws('|',id,team_id,week_start,user_id,sort_order),E'\\n' order by id)) from public.schedule_member_order where not (organization_id='$ORG' and team_id='$TEAM' and week_start='2026-09-21');")"

first="$(sudo -u postgres psql -At -d "$DB" -c "$CALL_SQL")"
test "$first" = "true/6/6/true"
sequence="$(sudo -u postgres psql -At -F, -d "$DB" -c "select p.name,smo.sort_order from public.schedule_member_order smo join public.profiles p on p.id=smo.user_id where smo.organization_id='$ORG' and smo.team_id='$TEAM' and smo.week_start='2026-09-21' order by smo.sort_order;")"
expected=$'Kristian,0\nMelih,1\nCarles,2\nPere,3\nMitchel,4\nPol,5'
test "$sequence" = "$expected"

test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.schedule_member_order where organization_id='$ORG' and team_id='$TEAM' and week_start='2026-09-21';")" = "6"
test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.audit_logs where action='schedule.replace_member_order';")" = "1"

second="$(sudo -u postgres psql -At -d "$DB" -c "$CALL_SQL")"
test "$second" = "false/6/6/true"
test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.audit_logs where action='schedule.replace_member_order';")" = "1"

if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "select * from public.replace_schedule_member_order('$ORG','$TEAM','2026-09-21',ARRAY['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001']::uuid[],'$ACTOR','owner');" >/dev/null 2>&1; then
  echo "Duplicate validation failure" >&2
  exit 1
fi
if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "select * from public.replace_schedule_member_order('$ORG','$TEAM','2026-09-21',ARRAY['20000000-0000-0000-0000-000000000001']::uuid[],'$ACTOR','owner');" >/dev/null 2>&1; then
  echo "Member-count validation failure" >&2
  exit 1
fi
if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE authenticated; $CALL_SQL" >/dev/null 2>&1; then
  echo "Permission failure: authenticated executed service-only function" >&2
  exit 1
fi

staff_after="$(sudo -u postgres psql -At -d "$DB" -c "select md5(string_agg(concat_ws('|',id,user_id,date,shift_template_id),E'\\n' order by id)) from public.staff_schedules;")"
time_after="$(sudo -u postgres psql -At -d "$DB" -c "select md5(string_agg(concat_ws('|',id,user_id,started_at),E'\\n' order by id)) from public.time_entries;")"
other_order_after="$(sudo -u postgres psql -At -d "$DB" -c "select md5(string_agg(concat_ws('|',id,team_id,week_start,user_id,sort_order),E'\\n' order by id)) from public.schedule_member_order where not (organization_id='$ORG' and team_id='$TEAM' and week_start='2026-09-21');")"
test "$staff_before" = "$staff_after"
test "$time_before" = "$time_after"
test "$other_order_before" = "$other_order_after"

echo "Schedule member order migration fixture OK: exact six-person sequence, stale rows removed, idempotent, shifts/time entries/other scopes preserved"
