CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$$;

CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'member', 'read_only');

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY
);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text,
  organization_id uuid REFERENCES public.organizations(id),
  role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transfer_brokers (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  email text,
  user_id uuid REFERENCES auth.users(id),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.broker_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  broker_id uuid REFERENCES public.transfer_brokers(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  email text,
  organization_name text,
  is_active boolean DEFAULT true
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_user_id uuid REFERENCES public.profiles(id),
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Empresa sintética'),
  ('00000000-0000-0000-0000-000000000002', 'Otra empresa sintética');

INSERT INTO auth.users (id) VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');

INSERT INTO public.profiles (id, name, organization_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Administrador sintético', '00000000-0000-0000-0000-000000000001', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'Broker sintético', NULL, 'member');

INSERT INTO public.transfer_brokers (id, organization_id, name, user_id, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Broker sintético', '10000000-0000-0000-0000-000000000002', true);

INSERT INTO public.broker_profiles (id, user_id, broker_id, organization_id, name, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Broker sintético', true);
