#!/usr/bin/env bash
# Local-only validation of the vehicle plate identity migrations.
# Uses an isolated PostgreSQL cluster reachable only through a unix socket
# (listen_addresses=''), never production. All data is synthetic.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOCK="${PGVEH_SOCKET:-/tmp/pgveh}"
PORT="${PGVEH_PORT:-55433}"
DB="vehicle_plate_identity_test_$$"
PSQL=(psql -X -q -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1)
M1="$ROOT/supabase/migrations/20261019120000_vehicle_plate_identity.sql"
M2="$ROOT/supabase/migrations/20261019120500_vehicle_plate_identity_unique.sql"
RB="$ROOT/supabase/rollbacks/20261019120000_vehicle_plate_identity.rollback.sql"
PRELUDE="$ROOT/server/vehicleFixtures/plateIdentityPrelude.sql"

ORG1=10000000-0000-0000-0000-000000000001
ORG2=10000000-0000-0000-0000-000000000002
A=ad000000-0000-0000-0000-00000000000a
B=bd000000-0000-0000-0000-00000000000b
C=cd000000-0000-0000-0000-00000000000c
V11=ed000000-0000-0000-0000-000000000011
V12=ed000000-0000-0000-0000-000000000012
V21=ed000000-0000-0000-0000-000000000021
ACTOR=a0000000-0000-0000-0000-000000000001

test "$("${PSQL[@]}" -d postgres -Atc "select current_setting('listen_addresses')")" = "" \
  || { echo "Refusing: test cluster is not socket-only" >&2; exit 1; }

q() { "${PSQL[@]}" -d "$DB" -Atc "$1"; }
fails() { # fails <expected-error-fragment> <sql>
  local out
  if out="$("${PSQL[@]}" -d "$DB" -Atc "$2" 2>&1)"; then
    echo "Expected failure ($1) but succeeded: $2" >&2; exit 1
  fi
  grep -q -- "$1" <<<"$out" || { echo "Unexpected error for $1: $out" >&2; exit 1; }
}
pass() { echo "PASS $1"; }

cleanup() { "${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$PRELUDE" >/dev/null

HIST_ROWS="select md5(string_agg(concat_ws('|',id,organization_id,task_key,completed_by,completed_at,notes,created_at),E'\n' order by id)) from public.vehicle_cleaning_history"
TASK_ROWS="select md5(string_agg(concat_ws('|',id,vehicle_id,task_key,completed,completed_at,completed_by,notes),E'\n' order by id)) from public.vehicle_cleaning_tasks"
AB_TASK_ROWS="select md5(string_agg(concat_ws('|',id,vehicle_id,task_key,completed,completed_at,completed_by,notes),E'\n' order by id)) from public.vehicle_cleaning_tasks where vehicle_id in ('ad000000-0000-0000-0000-00000000000a','bd000000-0000-0000-0000-00000000000b')"
ROW_OF() { echo "select md5(concat_ws('|',id,organization_id,matricula,modelo,categoria,status,current_reservation_id,last_status_change,is_archived,archived_at,archived_by,cleaned_by,cleaned_at,location_id,service_type,service_notes,fleet_vehicle_id,updated_at)) from public.vehicles where id='$1'"; }
OTHER_ORG="select md5(string_agg(concat_ws('|',v.id,v.matricula,v.status,v.is_archived,v.updated_at),E'\n' order by v.id)) from public.vehicles v where organization_id<>'$ORG1'"

# 0. Regression proof on the ORIGINAL trigger: a separator variant creates a third vehicle.
before_bug="$(q "begin; insert into public.fleet_vehicles(organization_id,matricula) values ('$ORG1','9772-nns'); select count(*) from public.vehicles where organization_id='$ORG1' and upper(regexp_replace(matricula,'[^0-9A-Za-z]','','g'))='9772NNS'; rollback;" | tail -n 1)"
test "$before_bug" = "3"; pass "original trigger reproduces the duplicate (3 records for one plate key)"

# 1. Install twice; installation must not modify any row.
veh_before="$(q "select md5(string_agg(concat_ws('|',id,matricula,status,is_archived,updated_at,fleet_vehicle_id),E'\n' order by id)) from public.vehicles")"
hist_before="$(q "$HIST_ROWS")"; tasks_before="$(q "$TASK_ROWS")"
ab_tasks_before="$(q "$AB_TASK_ROWS")"
"${PSQL[@]}" -d "$DB" -f "$M1" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$M1" >/dev/null
test "$veh_before" = "$(q "select md5(string_agg(concat_ws('|',id,matricula,status,is_archived,updated_at,fleet_vehicle_id),E'\n' order by id)) from public.vehicles")"
test "$hist_before" = "$(q "$HIST_ROWS")"; test "$tasks_before" = "$(q "$TASK_ROWS")"
pass "migration installs twice without modifying data"

# 2. SQL normalization parity with shared/vehiclePlate.ts.
test "$(q "select string_agg(public.normalize_vehicle_plate(x), ',' order by o) from (values (1,'9772 NNS'),(2,' 9772-nns '),(3,'9772.NNS'),(4,'E200-1'),(5,''),(6,null)) t(o,x)")" = "9772NNS,9772NNS,9772NNS,E2001,,"
pass "normalize_vehicle_plate parity cases"

# 3. Permissions: only service_role may run the RPCs or read the alias registry.
fails "permission denied" "set role authenticated; select * from public.merge_vehicle_identity_alias('$ORG1','$A','$B',now(),now(),'$ACTOR','owner','x')"
fails "permission denied" "set role anon; select count(*) from public.vehicle_identity_aliases"
fails "permission denied" "set role authenticated; select * from public.revert_vehicle_identity_merge('$ORG1',gen_random_uuid(),'$ACTOR','owner','x')"
pass "RPCs and alias registry restricted to service_role"

A_UPD="$(q "select updated_at from public.vehicles where id='$A'")"
B_UPD="$(q "select updated_at from public.vehicles where id='$B'")"
B_ROW_BEFORE="$(q "$(ROW_OF "$B")")"
OTHER_BEFORE="$(q "$OTHER_ORG")"
MERGE="select changed||'/'||moved_history||'/'||alias_tasks_preserved from public.merge_vehicle_identity_alias('$ORG1','$A','$B','$A_UPD','$B_UPD','$ACTOR','owner','Duplicado 9772 NNS / 9772NNS')"

# 4. Guards: stale CAS, incompatible identities, other organization, alias in use.
fails "vehicle_merge_concurrent_change" "select * from public.merge_vehicle_identity_alias('$ORG1','$A','$B','$A_UPD'::timestamptz - interval '1 microsecond','$B_UPD','$ACTOR','owner','x')"
fails "vehicle_merge_plate_mismatch" "select * from public.merge_vehicle_identity_alias('$ORG1','$V21','$B',(select updated_at from public.vehicles where id='$V21'),'$B_UPD','$ACTOR','owner','x')"
fails "vehicle_merge_vin_conflict" "select * from public.merge_vehicle_identity_alias('$ORG1','$V11','$V12',(select updated_at from public.vehicles where id='$V11'),(select updated_at from public.vehicles where id='$V12'),'$ACTOR','owner','x')"
fails "vehicle_merge_cross_organization" "select * from public.merge_vehicle_identity_alias('$ORG1','$A','$C','$A_UPD',(select updated_at from public.vehicles where id='$C'),'$ACTOR','owner','x')"
fails "vehicle_merge_alias_in_use" "begin; update public.vehicles set status='alquilado' where id='$A'; select * from public.merge_vehicle_identity_alias('$ORG1','$A','$B',(select updated_at from public.vehicles where id='$A'),'$B_UPD','$ACTOR','owner','x'); commit;"
fails "vehicle_merge_unsupported_references" "begin; insert into public.vehicle_movements(vehicle_id) values ('$A'); select * from public.merge_vehicle_identity_alias('$ORG1','$A','$B','$A_UPD','$B_UPD','$ACTOR','owner','x'); commit;"
test "$(q "select count(*) from public.vehicle_identity_aliases")" = "0"
test "$hist_before" = "$(q "$HIST_ROWS")"
pass "CAS, plate, VIN, organization, in-use and unsupported-reference guards abort with no changes"

# 5. Failure in the middle of the consolidation (after history moved, at audit insert) rolls back everything.
"${PSQL[@]}" -d "$DB" -c "create function public.fixture_fail_audit() returns trigger language plpgsql as \$\$ begin raise exception 'injected_mid_merge_failure'; end \$\$; create trigger fixture_fail_audit before insert on public.audit_logs for each row execute function public.fixture_fail_audit();" >/dev/null
fails "injected_mid_merge_failure" "$MERGE"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$A'")" = "3"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$B'")" = "5"
test "$(q "select coalesce(is_archived,false) from public.vehicles where id='$A'")" = "f"
test "$(q "select count(*) from public.vehicle_identity_aliases")" = "0"
test "$A_UPD" = "$(q "select updated_at from public.vehicles where id='$A'")"
"${PSQL[@]}" -d "$DB" -c "drop trigger fixture_fail_audit on public.audit_logs" >/dev/null
pass "mid-consolidation failure leaves history, alias and archive state untouched"

# 6. Successful consolidation.
test "$(q "$MERGE")" = "true/3/7"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$A'")" = "0"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$B'")" = "8"
test "$hist_before" = "$(q "$HIST_ROWS")"   # ids, authors, timestamps, notes unchanged
test "$tasks_before" = "$(q "$TASK_ROWS")"  # checklist untouched: A keeps its residual 7/7, B keeps 0/7
test "$(q "select count(*) filter (where completed) from public.vehicle_cleaning_tasks where vehicle_id='$B'")" = "0"
test "$(q "select is_archived||'/'||status||'/'||(archived_by='$ACTOR') from public.vehicles where id='$A'")" = "true/limpio/true"
test "$B_ROW_BEFORE" = "$(q "$(ROW_OF "$B")")"  # canonical row (status, location, manual data) untouched
test "$OTHER_BEFORE" = "$(q "$OTHER_ORG")"
test "$(q "select count(*) from public.vehicle_movements where vehicle_id='$B'")" = "2"
test "$(q "select status||'/'||cardinality(moved_history_ids)||'/'||jsonb_array_length(snapshot->'alias_cleaning_history')||'/'||jsonb_array_length(snapshot->'alias_cleaning_tasks')||'/'||(snapshot->'alias_vehicle'->>'id') from public.vehicle_identity_aliases")" = "active/3/3/7/$A"
test "$(q "select count(*) from public.audit_logs where action='vehicle.identity_merge'")" = "1"
pass "consolidation moves only history, preserves authors/dates, archives alias recoverably and never marks available"

# 7. Repeat is idempotent (no second audit, no extra moves).
test "$(q "select changed||'/'||moved_history from public.merge_vehicle_identity_alias('$ORG1','$A','$B','$A_UPD','$B_UPD','$ACTOR','owner','retry')")" = "false/0"
test "$(q "select count(*) from public.audit_logs where action='vehicle.identity_merge'")" = "1"
pass "repeated consolidation is a no-op"

# 8. New fleet trigger: normalized identity, prefers active, never resurrects the alias, refuses VIN conflicts.
linked="$(q "begin; insert into public.fleet_vehicles(id,organization_id,matricula) values ('f0000000-0000-0000-0000-0000000000ee','$ORG1','9772-nns'); select (select count(*) from public.vehicles where organization_id='$ORG1' and public.normalize_vehicle_plate(matricula)='9772NNS')||'/'||(select fleet_vehicle_id from public.vehicles where id='$B')||'/'||(select is_archived from public.vehicles where id='$A'); rollback;" | tail -n 1)"
test "$linked" = "2/f0000000-0000-0000-0000-0000000000ee/true"
fails "vehicle_identity_vin_conflict" "insert into public.fleet_vehicles(organization_id,matricula,numero_bastidor) values ('$ORG1','9772 nns','VINDIFFERENT000002')"
fails "vehicle_identity_ambiguous" "insert into public.fleet_vehicles(organization_id,matricula) values ('$ORG1','1234-abc')"
other_org_new="$(q "begin; insert into public.fleet_vehicles(organization_id,matricula) values ('10000000-0000-0000-0000-000000000003','9772 NNS'); select count(*) from public.vehicles where organization_id='10000000-0000-0000-0000-000000000003'; rollback;" | tail -n 1)"
test "$other_org_new" = "1"
test "$OTHER_BEFORE" = "$(q "$OTHER_ORG")"
pass "fleet trigger links by normalized plate within the organization and blocks ambiguous/incompatible cases"

# 9. Unique index migration refuses while another (unrelated) duplicate group remains, touching nothing.
fails "vehicle_plate_index_blocked: 1 active duplicate group" "\\i $M2"
test "$(q "select count(*) from pg_indexes where indexname='vehicles_org_plate_key_active_uidx'")" = "0"
test "$(q "select count(*) from public.vehicles where id in ('$V11','$V12') and coalesce(is_archived,false)=false")" = "2"
pass "index migration aborts instead of deduplicating unrelated plates"

# Simulate a separate, explicit decision on the unrelated pair so the index can be tested.
q "update public.vehicles set is_archived=true where id='$V12'" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$M2" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$M2" >/dev/null
test "$(q "select count(*) from pg_indexes where indexname='vehicles_org_plate_key_active_uidx'")" = "1"
test "$(q "select matricula from public.vehicles where id='$V21'")" = "E200-1"
pass "index installs twice and preserves legitimate literals"

# 10. Concurrency: two simultaneous creations of the same unit with different literals.
"${PSQL[@]}" -d "$DB" -c "begin; insert into public.vehicles(organization_id,matricula) values ('$ORG1','5555 XYZ'); select pg_sleep(2); commit;" >/dev/null &
p1=$!
sleep 0.5
second_out="$("${PSQL[@]}" -d "$DB" -c "insert into public.vehicles(organization_id,matricula) values ('$ORG1','5555xyz')" 2>&1 || true)"
wait "$p1"
grep -q "vehicles_org_plate_key_active_uidx" <<<"$second_out"
test "$(q "select count(*) from public.vehicles where organization_id='$ORG1' and public.normalize_vehicle_plate(matricula)='5555XYZ'")" = "1"
test "$(q "select count(*) from public.vehicles where organization_id='$ORG2' and public.normalize_vehicle_plate(matricula)='9772NNS'")" = "1"
q "insert into public.vehicles(organization_id,matricula) values ('$ORG2','5555 XYZ')" >/dev/null
pass "concurrent creations of one plate key yield exactly one record; other organizations unaffected"

# 11. Reversal: blocked while the index exists; after index rollback it restores the exact pre-merge state.
REC="$(q "select id from public.vehicle_identity_aliases where alias_vehicle_id='$A'")"
fails "vehicle_merge_revert_requires_index_rollback" "select * from public.revert_vehicle_identity_merge('$ORG1','$REC','$ACTOR','owner','test revert')"
q "drop index public.vehicles_org_plate_key_active_uidx" >/dev/null
"${PSQL[@]}" -d "$DB" -c "create function public.fixture_fail_audit2() returns trigger language plpgsql as \$\$ begin raise exception 'injected_mid_revert_failure'; end \$\$; create trigger fixture_fail_audit2 before insert on public.audit_logs for each row execute function public.fixture_fail_audit2();" >/dev/null
fails "injected_mid_revert_failure" "select * from public.revert_vehicle_identity_merge('$ORG1','$REC','$ACTOR','owner','test revert')"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$B'")" = "8"
"${PSQL[@]}" -d "$DB" -c "drop trigger fixture_fail_audit2 on public.audit_logs" >/dev/null
test "$(q "select changed||'/'||restored_history from public.revert_vehicle_identity_merge('$ORG1','$REC','$ACTOR','owner','test revert')")" = "true/3"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$A'")" = "3"
test "$(q "select count(*) from public.vehicle_cleaning_history where vehicle_id='$B'")" = "5"
test "$hist_before" = "$(q "$HIST_ROWS")"
test "$ab_tasks_before" = "$(q "$AB_TASK_ROWS")"
test "$(q "select coalesce(is_archived,false)||'/'||coalesce(archived_at::text,'null')||'/'||status from public.vehicles where id='$A'")" = "false/null/limpio"
test "$B_ROW_BEFORE" = "$(q "$(ROW_OF "$B")")"
test "$(q "select changed from public.revert_vehicle_identity_merge('$ORG1','$REC','$ACTOR','owner','again')")" = "f"
test "$(q "select status from public.vehicle_identity_aliases where id='$REC'")" = "reverted"
test "$(q "select count(*) from public.audit_logs where action='vehicle.identity_merge_reverted'")" = "1"
pass "mid-revert failure is atomic; revert restores history and archive flags exactly and is idempotent"

# 12. The documented rollback script restores the original trigger without touching data.
hist_rb="$(q "$HIST_ROWS")"
"${PSQL[@]}" -d "$DB" -f "$RB" >/dev/null
q "select prosrc from pg_proc where proname='sync_fleet_vehicle_to_vehicles'" | grep -q "UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))"
! q "select prosrc from pg_proc where proname='sync_fleet_vehicle_to_vehicles'" | grep -q "normalize_vehicle_plate"
test "$hist_rb" = "$(q "$HIST_ROWS")"
test "$(q "select count(*) from public.vehicle_identity_aliases")" = "1"
pass "rollback script restores the original trigger and keeps the alias evidence"

echo "ALL VEHICLE PLATE IDENTITY POSTGRES CHECKS PASSED"
