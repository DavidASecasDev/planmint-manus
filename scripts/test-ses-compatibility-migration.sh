#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="planmint_ses_compatibility_test"
PRELUDE="$ROOT/server/sesHospedajes/fixtures/migration_prelude.sql"
BASE="$ROOT/supabase/migrations/20260826150000_ses_hospedajes.sql"
FIXTURE="$ROOT/server/sesHospedajes/fixtures/migration_fixture_224.sql"
MIGRATION="$ROOT/supabase/migrations/20260828143000_ses_hospedajes_compatibility_restore.sql"
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

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$ASSERTIONS"

fingerprint_before="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT md5(string_agg(id::text||status||draft_version||coalesce(content_hash,'')||ready_for_xml, ',' ORDER BY id))
  FROM public.ses_contract_drafts;")"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" >/dev/null < "$ASSERTIONS"
fingerprint_after="$(sudo -u postgres psql -At -d "$DB" -c "
  SELECT md5(string_agg(id::text||status||draft_version||coalesce(content_hash,'')||ready_for_xml, ',' ORDER BY id))
  FROM public.ses_contract_drafts;")"
test "$fingerprint_before" = "$fingerprint_after"

if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "SET ROLE authenticated; SELECT count(*) FROM public.ses_contract_drafts;" >/dev/null 2>&1; then
  echo "RLS failure: authenticated role unexpectedly read SES drafts" >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "
  SET ROLE service_role;
  SELECT count(*) FROM public.ses_contract_drafts;
  RESET ROLE;
  INSERT INTO public.ses_official_communications (
    organization_id,official_communication_code,reference,contract_date,status,source
  ) VALUES (
    '00000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001',
    'ORG-B-1','2026-08-01','active','manual_import'
  );
" >/dev/null

echo "SES compatibility fixture OK: 224/19/204/1 preserved, accepted history non-resendable, all legacy drafts require revalidation, idempotent, RLS isolated, multi-org preserved"
