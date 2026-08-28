CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  display_name text NOT NULL
);

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  external_reservation_id text,
  estado text,
  auto text,
  es_transferencia boolean NOT NULL DEFAULT false,
  rently_status_code integer,
  rently_detail_synced_at timestamptz
);
