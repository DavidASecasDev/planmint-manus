#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="planmint_broker_company_link_test"
PRELUDE="$ROOT/server/brokerFixtures/brokerCompanyLinkPrelude.sql"
MIGRATION="$ROOT/supabase/migrations/20260917100000_broker_company_link_rpc.sql"
ORG="00000000-0000-0000-0000-000000000001"
ACTOR="10000000-0000-0000-0000-000000000001"
USER="10000000-0000-0000-0000-000000000002"
BROKER="20000000-0000-0000-0000-000000000001"
BROKER_PROFILE="30000000-0000-0000-0000-000000000001"

cleanup() { sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
sudo -u postgres createdb "$DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$PRELUDE"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"

call_sql="select already_linked, profile_created, organization_name from public.link_broker_profile_to_company('$ORG','$BROKER','$USER','$ACTOR','admin');"

first="$(sudo -u postgres psql -At -F/ -d "$DB" -c "$call_sql")"
test "$first" = "f/f/Empresa sintética"
test "$(sudo -u postgres psql -At -d "$DB" -c "select organization_id from public.profiles where id='$USER';")" = "$ORG"
test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.audit_logs where action='broker.link_company';")" = "1"

second="$(sudo -u postgres psql -At -F/ -d "$DB" -c "$call_sql")"
test "$second" = "t/f/Empresa sintética"
test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.audit_logs where action='broker.link_company';")" = "1"

if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE authenticated; $call_sql" >/dev/null 2>&1; then
  echo "Permission failure: authenticated unexpectedly executed broker company RPC" >&2
  exit 1
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE service_role; $call_sql RESET ROLE;" >/dev/null

sudo -u postgres psql -d "$DB" -c "update public.profiles set organization_id='00000000-0000-0000-0000-000000000002' where id='$USER';" >/dev/null
if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "$call_sql" >/dev/null 2>&1; then
  echo "Isolation failure: cross-company profile was overwritten" >&2
  exit 1
fi
test "$(sudo -u postgres psql -At -d "$DB" -c "select organization_id from public.profiles where id='$USER';")" = "00000000-0000-0000-0000-000000000002"

sudo -u postgres psql -d "$DB" -c "
  update public.profiles set organization_id=null where id='$USER';
  update public.broker_profiles set is_active=false where id='$BROKER_PROFILE';
" >/dev/null
if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "$call_sql" >/dev/null 2>&1; then
  echo "Activation failure: inactive portal profile was accepted" >&2
  exit 1
fi
test -z "$(sudo -u postgres psql -At -d "$DB" -c "select organization_id from public.profiles where id='$USER';")"

sudo -u postgres psql -d "$DB" -c "
  update public.broker_profiles set is_active=true where id='$BROKER_PROFILE';
  delete from public.profiles where id='$USER';
" >/dev/null
created="$(sudo -u postgres psql -At -F/ -d "$DB" -c "$call_sql")"
test "$created" = "f/t/Empresa sintética"
test "$(sudo -u postgres psql -At -d "$DB" -c "select organization_id from public.profiles where id='$USER';")" = "$ORG"

# The RPC commits first; a concurrent unlink waits for its portal-profile lock.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "update public.profiles set organization_id=null where id='$USER';" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "BEGIN; $call_sql select pg_sleep(2); COMMIT;" >/tmp/broker-link-rpc.log 2>&1 &
rpc_pid=$!
sleep 0.4
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "BEGIN; delete from public.broker_profiles where id='$BROKER_PROFILE'; update public.transfer_brokers set user_id=null where id='$BROKER'; COMMIT;" >/tmp/broker-unlink-after.log 2>&1
wait "$rpc_pid"
test "$(sudo -u postgres psql -At -d "$DB" -c "select organization_id from public.profiles where id='$USER';")" = "$ORG"
test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.broker_profiles where id='$BROKER_PROFILE';")" = "0"
test -z "$(sudo -u postgres psql -At -d "$DB" -c "select user_id from public.transfer_brokers where id='$BROKER';")"

# The unlink commits first; a waiting RPC fails closed and leaves the profile unlinked.
sudo -u postgres psql -d "$DB" -c "
  update public.profiles set organization_id=null where id='$USER';
  update public.transfer_brokers set user_id='$USER', is_active=true where id='$BROKER';
  insert into public.broker_profiles (id,user_id,broker_id,organization_id,name,is_active)
  values ('$BROKER_PROFILE','$USER','$BROKER','$ORG','Broker sintético',true);
" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "BEGIN; delete from public.broker_profiles where id='$BROKER_PROFILE'; select pg_sleep(2); update public.transfer_brokers set user_id=null where id='$BROKER'; COMMIT;" >/tmp/broker-unlink-first.log 2>&1 &
unlink_pid=$!
sleep 0.4
if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "$call_sql" >/tmp/broker-link-after.log 2>&1; then
  echo "Concurrency failure: RPC succeeded after unlink won the lock" >&2
  kill "$unlink_pid" >/dev/null 2>&1 || true
  exit 1
fi
wait "$unlink_pid"
test -z "$(sudo -u postgres psql -At -d "$DB" -c "select organization_id from public.profiles where id='$USER';")"
test "$(sudo -u postgres psql -At -d "$DB" -c "select count(*) from public.broker_profiles where id='$BROKER_PROFILE';")" = "0"

signature="$(sudo -u postgres psql -At -d "$DB" -c "select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='link_broker_profile_to_company';")"
test "$signature" = "p_organization_id uuid, p_broker_id uuid, p_user_id uuid, p_actor_user_id uuid, p_actor_role text"

echo "Broker company link migration fixture OK: applied twice, idempotent, service-role only, cross-company/inactive blocked, create/update audited, concurrent unlink serialized both orders"
