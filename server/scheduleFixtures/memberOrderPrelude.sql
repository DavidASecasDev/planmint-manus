CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text
);

CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (organization_id, team_id, user_id)
);

CREATE TABLE public.schedule_member_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  team_id uuid NOT NULL,
  week_start date NOT NULL,
  user_id uuid NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, team_id, week_start, user_id)
);

CREATE TABLE public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  shift_template_id uuid,
  notes text,
  UNIQUE (organization_id, user_id, date)
);

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  actor_user_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata_json jsonb,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Azul sintética'),
  ('00000000-0000-0000-0000-000000000002', 'Otra organización');
INSERT INTO public.teams (id, organization_id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Rentals'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Preparación'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Rentals');

INSERT INTO public.profiles (id, name) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Kristian'),
  ('20000000-0000-0000-0000-000000000002', 'Melih'),
  ('20000000-0000-0000-0000-000000000003', 'Carles'),
  ('20000000-0000-0000-0000-000000000004', 'Pere'),
  ('20000000-0000-0000-0000-000000000005', 'Mitchel'),
  ('20000000-0000-0000-0000-000000000006', 'Pol'),
  ('20000000-0000-0000-0000-000000000099', 'Obsoleto'),
  ('20000000-0000-0000-0000-000000000100', 'Actor');

INSERT INTO public.organization_members (organization_id, user_id, role, status)
SELECT '00000000-0000-0000-0000-000000000001', id, 'member', 'active'
FROM public.profiles
WHERE id BETWEEN '20000000-0000-0000-0000-000000000001' AND '20000000-0000-0000-0000-000000000006';
INSERT INTO public.organization_members VALUES
  ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000100','owner','active');

INSERT INTO public.team_members (organization_id, team_id, user_id, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',0),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',98),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004',0),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005',5),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006',4);

INSERT INTO public.schedule_member_order (organization_id, team_id, week_start, user_id, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-09-21','20000000-0000-0000-0000-000000000001',0),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-09-21','20000000-0000-0000-0000-000000000002',1),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-09-21','20000000-0000-0000-0000-000000000099',1),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','2026-09-21','20000000-0000-0000-0000-000000000099',0),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-09-14','20000000-0000-0000-0000-000000000099',0);

INSERT INTO public.staff_schedules (organization_id, user_id, date, shift_template_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  d::date,
  '30000000-0000-0000-0000-000000000001'
FROM public.profiles p
CROSS JOIN generate_series('2026-09-21'::date, '2026-09-27'::date, interval '1 day') d
WHERE p.id BETWEEN '20000000-0000-0000-0000-000000000001' AND '20000000-0000-0000-0000-000000000006';

INSERT INTO public.time_entries (organization_id, user_id, started_at)
VALUES ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-09-21T08:00:00Z');
