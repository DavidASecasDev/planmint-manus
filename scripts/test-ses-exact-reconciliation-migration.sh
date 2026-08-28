#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="planmint_ses_exact_reconciliation_test"
PRELUDE="$ROOT/server/sesHospedajes/fixtures/migration_prelude.sql"
BASE="$ROOT/supabase/migrations/20260826150000_ses_hospedajes.sql"
FIXTURE="$ROOT/server/sesHospedajes/fixtures/migration_fixture_224.sql"
COMPATIBILITY="$ROOT/supabase/migrations/20260828143000_ses_hospedajes_compatibility_restore.sql"
MIGRATION="$ROOT/supabase/migrations/20260828190000_ses_exact_reconciliation_and_exceptions.sql"

cleanup() { sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
sudo -u postgres createdb "$DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$PRELUDE"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$BASE"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$FIXTURE"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$COMPATIBILITY"

before="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT count(*)||'/'||count(*) FILTER (WHERE status='ready')||'/'||
         count(*) FILTER (WHERE status='incomplete')||'/'||count(*) FILTER (WHERE status='accepted')
  FROM public.ses_contract_drafts WHERE organization_id='00000000-0000-0000-0000-000000000001';")"
test "$before" = "224/19/204/1"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"

after="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT count(*)||'/'||count(*) FILTER (WHERE status='ready')||'/'||
         count(*) FILTER (WHERE status='incomplete')||'/'||count(*) FILTER (WHERE status='accepted')
  FROM public.ses_contract_drafts WHERE organization_id='00000000-0000-0000-0000-000000000001';")"
test "$after" = "$before"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "
  INSERT INTO public.ses_eligibility_exceptions (
    organization_id,draft_id,reservation_id,protocol_reference,reason,approved_by,expires_at
  )
  SELECT d.organization_id,d.id,d.reservation_id,'PROTO-SYNTHETIC-1',
         'Incidencia sintética verificada para probar la migración',p.id,now() + interval '1 day'
  FROM public.ses_contract_drafts d
  CROSS JOIN LATERAL (SELECT id FROM public.profiles ORDER BY id LIMIT 1) p
  WHERE d.organization_id='00000000-0000-0000-0000-000000000001'
  ORDER BY d.id LIMIT 1;
" >/dev/null

test "$(sudo -u postgres psql -At -d "$DB" -c "SELECT count(*) FROM public.ses_eligibility_exceptions;")" = "1"

if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE authenticated; SELECT count(*) FROM public.ses_eligibility_exceptions;" >/dev/null 2>&1; then
  echo "RLS failure: authenticated role unexpectedly read SES eligibility exceptions" >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "
  SET ROLE service_role;
  SELECT count(*) FROM public.ses_eligibility_exceptions;
  RESET ROLE;
" >/dev/null

echo "SES exact reconciliation migration fixture OK: 224/19/204/1 preserved, migration idempotent twice, exception audit fields writable, authenticated denied, service_role allowed"
