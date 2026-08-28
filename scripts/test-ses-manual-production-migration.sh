#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="planmint_ses_manual_production_test"
PRELUDE="$ROOT/server/sesHospedajes/fixtures/migration_prelude.sql"
BASE="$ROOT/supabase/migrations/20260826150000_ses_hospedajes.sql"
FIXTURE="$ROOT/server/sesHospedajes/fixtures/migration_fixture_224.sql"
MIGRATION="$ROOT/ses_hospedajes_manual_production_migration.sql"
ASSERTIONS="$ROOT/server/sesHospedajes/fixtures/migration_assertions.sql"

cleanup() { sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
sudo -u postgres createdb "$DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$PRELUDE"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$BASE"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$FIXTURE"

before="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT count(*)||'/'||count(*) FILTER (WHERE status='ready')||'/'||
         count(*) FILTER (WHERE status='incomplete')||'/'||count(*) FILTER (WHERE status='accepted')
  FROM public.ses_contract_drafts WHERE organization_id='00000000-0000-0000-0000-000000000001';")"
test "$before" = "224/19/204/1"
test "$(sudo -u postgres psql -At -d "$DB" -c "SELECT count(*) FROM public.ses_audit_events WHERE organization_id='00000000-0000-0000-0000-000000000001';")" = "165"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$ASSERTIONS"
fingerprint_before="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT encode(digest(string_agg(to_jsonb(row_value)::text, ',' ORDER BY id), 'sha256'),'hex')
  FROM public.ses_contract_drafts row_value;")"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$ASSERTIONS"
fingerprint_after="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT encode(digest(string_agg(to_jsonb(row_value)::text, ',' ORDER BY id), 'sha256'),'hex')
  FROM public.ses_contract_drafts row_value;")"
test "$fingerprint_before" = "$fingerprint_after"

if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE authenticated; SELECT count(*) FROM public.ses_official_communications;" >/dev/null 2>&1; then
  echo "RLS failure: authenticated role unexpectedly read official communications" >&2
  exit 1
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE service_role; SELECT count(*) FROM public.ses_official_communications; RESET ROLE;" >/dev/null

echo "SES manual migration OK: 224/19/204/1, 165 audits, one accepted batch/item, payload preserved, zero ready_for_xml, two executions idempotent, RLS isolated"
