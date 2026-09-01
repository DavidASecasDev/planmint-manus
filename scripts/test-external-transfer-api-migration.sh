#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/20260901124500_external_transfers_bidirectional_api.sql"
DB_NAME="planmint_external_transfer_api_fixture"

cleanup() {
  sudo -u postgres dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
sudo -u postgres createdb "$DB_NAME"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.organizations (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY);

CREATE TABLE public.external_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  request_number text NOT NULL,
  broker_id uuid,
  broker_name text NOT NULL,
  client_type text,
  client_name text NOT NULL,
  client_phone text,
  client_email text,
  villa_name text,
  boat_name text,
  berth_number text,
  captain_name text,
  captain_phone text,
  service_type text,
  notes text,
  client_reference text,
  status text NOT NULL DEFAULT 'pendiente',
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, request_number)
);

CREATE TABLE public.transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  position integer NOT NULL,
  direction text,
  transfer_date date,
  transfer_time time,
  pickup_enabled boolean NOT NULL DEFAULT true,
  pickup_location text,
  pickup_lat numeric,
  pickup_lng numeric,
  pickup_place_id text,
  pickup_time time,
  dropoff_enabled boolean NOT NULL DEFAULT true,
  dropoff_location text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  dropoff_place_id text,
  dropoff_time time,
  vehicle_type text,
  pax_count integer,
  flight_number text,
  notes text,
  baby_seats_count integer,
  baby_seats jsonb,
  luggage_count integer,
  vans_needed integer,
  status text NOT NULL DEFAULT 'pendiente',
  driver_pending boolean NOT NULL DEFAULT true,
  linked_item_id uuid REFERENCES public.transfer_items(id)
);

CREATE TABLE public.transfer_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.transfer_requests(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  previous_status text,
  new_status text NOT NULL,
  changed_by_type text,
  changed_by_id uuid,
  changed_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.external_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.external_api_keys(id),
  organization_id uuid NOT NULL,
  method text NOT NULL,
  endpoint text NOT NULL,
  status_code integer NOT NULL,
  request_body jsonb,
  response_body jsonb,
  ip_address text,
  user_agent text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.external_api_keys (id, organization_id, name, key_hash, key_prefix, permissions)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Clave compartida sintética',
  repeat('a', 64),
  'fixture1',
  '["transfers.create","transfers.read","transfers.cancel","webhooks.manage"]'::jsonb
);
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" >/dev/null < "$MIGRATION"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" >/dev/null < "$MIGRATION"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
INSERT INTO public.external_api_webhooks (
  organization_id,
  name,
  url,
  events,
  encrypted_secret
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Webhook sintético',
  'https://partner.example.test/webhooks/planmint',
  ARRAY['transfer.created', 'transfer.status_changed', 'transfer.cancelled'],
  'encrypted-fixture-secret-value'
);

DO $$
DECLARE
  v_payload jsonb := jsonb_build_object(
    'client_type', 'villa',
    'client_name', 'Cliente sintético',
    'client_phone', '+34000000000',
    'villa_name', 'Villa sintética',
    'service_type', 'point_to_point',
    'external_reference', 'CRM-FIXTURE-001',
    'items', jsonb_build_array(
      jsonb_build_object(
        'direction', 'ida',
        'transfer_date', '2026-09-15',
        'transfer_time', '10:30',
        'pickup_location', 'Origen sintético',
        'dropoff_location', 'Destino sintético',
        'vehicle_type', 'mercedes_v_class',
        'pax_count', 4,
        'luggage_count', 3,
        'vans_needed', 1,
        'linked_item_position', 2
      ),
      jsonb_build_object(
        'direction', 'vuelta',
        'transfer_date', '2026-09-20',
        'transfer_time', '18:00',
        'pickup_location', 'Destino sintético',
        'dropoff_location', 'Origen sintético',
        'vehicle_type', 'mercedes_v_class',
        'pax_count', 4,
        'luggage_count', 3,
        'vans_needed', 1,
        'linked_item_position', 1
      )
    )
  );
  v_first jsonb;
  v_replay jsonb;
  v_transfer_id uuid;
  v_cancel jsonb;
  v_cancel_replay jsonb;
BEGIN
  v_first := public.create_external_transfer_v1(
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    repeat('c', 64),
    v_payload,
    'API compartida sintética'
  );
  v_replay := public.create_external_transfer_v1(
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    repeat('c', 64),
    v_payload,
    'API compartida sintética'
  );

  IF (v_first->>'replayed')::boolean OR NOT (v_replay->>'replayed')::boolean THEN
    RAISE EXCEPTION 'Idempotency replay flags are incorrect';
  END IF;
  IF v_first->>'id' <> v_replay->>'id' THEN
    RAISE EXCEPTION 'Idempotency created two transfer identities';
  END IF;

  BEGIN
    PERFORM public.create_external_transfer_v1(
      '00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000001',
      repeat('b', 64),
      repeat('d', 64),
      v_payload || jsonb_build_object('client_name', 'Otro cuerpo'),
      'API compartida sintética'
    );
    RAISE EXCEPTION 'Idempotency conflict was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'IDEMPOTENCY_CONFLICT' THEN
      RAISE;
    END IF;
  END;

  v_transfer_id := (v_first->>'id')::uuid;
  v_cancel := public.cancel_external_transfer_v1(
    '00000000-0000-0000-0000-000000000001',
    v_transfer_id,
    'API compartida sintética',
    'Cancelación sintética autorizada'
  );
  v_cancel_replay := public.cancel_external_transfer_v1(
    '00000000-0000-0000-0000-000000000001',
    v_transfer_id,
    'API compartida sintética',
    'Cancelación sintética autorizada'
  );
  IF (v_cancel->>'replayed')::boolean OR NOT (v_cancel_replay->>'replayed')::boolean THEN
    RAISE EXCEPTION 'Cancellation replay flags are incorrect';
  END IF;
END;
$$;

DO $$
DECLARE
  v_requests integer;
  v_items integer;
  v_history integer;
  v_idempotency integer;
  v_deliveries integer;
  v_cancelled_items integer;
BEGIN
  SELECT count(*) INTO v_requests FROM public.transfer_requests;
  SELECT count(*) INTO v_items FROM public.transfer_items;
  SELECT count(*) INTO v_history FROM public.transfer_status_history;
  SELECT count(*) INTO v_idempotency FROM public.external_api_idempotency;
  SELECT count(*) INTO v_deliveries FROM public.external_api_webhook_deliveries;
  SELECT count(*) INTO v_cancelled_items FROM public.transfer_items WHERE status = 'cancelado';

  IF v_requests <> 1 OR v_items <> 2 OR v_history <> 2 OR v_idempotency <> 1 OR v_deliveries <> 2 OR v_cancelled_items <> 2 THEN
    RAISE EXCEPTION 'Unexpected fixture counts: requests %, items %, history %, idempotency %, deliveries %, cancelled_items %',
      v_requests, v_items, v_history, v_idempotency, v_deliveries, v_cancelled_items;
  END IF;
END;
$$;

SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.external_api_webhooks LIMIT 1;
    RAISE EXCEPTION 'authenticated unexpectedly read webhook secrets';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET ROLE service_role;
SELECT count(*) FROM public.external_api_webhooks;
RESET ROLE;
SQL

echo "external_transfer_api_migration_fixture=PASS"
