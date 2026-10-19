-- Synthetic, production-shaped prelude for the vehicle plate identity tests.
-- Local PostgreSQL only (unix socket, listen_addresses=''). No real data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.organizations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, name text);
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  auto text,
  estado text
);
CREATE TABLE public.vehicle_locations (id uuid PRIMARY KEY, organization_id uuid NOT NULL, name text NOT NULL);

CREATE TABLE public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  matricula text NOT NULL,
  modelo text,
  categoria text,
  proveedor text,
  status text NOT NULL DEFAULT 'activo',
  numero_bastidor text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  matricula text NOT NULL,
  modelo text,
  categoria text,
  status text NOT NULL DEFAULT 'sucio' CHECK (status IN ('sucio','incompleto','limpio','alquilado','en_servicio')),
  current_reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  last_status_change timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean DEFAULT false,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id),
  cleaned_by uuid REFERENCES public.profiles(id),
  cleaned_at timestamptz,
  location_id uuid REFERENCES public.vehicle_locations(id),
  service_type text,
  service_notes text,
  fleet_vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  CONSTRAINT vehicles_organization_id_matricula_key UNIQUE (organization_id, matricula)
);

CREATE TABLE public.vehicle_cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz DEFAULT now(),
  notes text
);
CREATE TABLE public.vehicle_cleaning_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  completed_by uuid,
  completed_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vehicle_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.vehicles(id), matricula text);
CREATE TABLE public.accidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL);
CREATE TABLE public.damage_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL);
CREATE TABLE public.repairs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL);
CREATE TABLE public.vehicle_quality_audits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE);
CREATE TABLE public.vehicle_status_audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE);
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_user_id uuid REFERENCES public.profiles(id),
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata_json jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Production-equivalent vehicle triggers.
CREATE FUNCTION public.fixture_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER set_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.fixture_set_updated_at();
CREATE FUNCTION public.fixture_create_cleaning_tasks() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.vehicle_cleaning_tasks (vehicle_id, task_key)
  SELECT NEW.id, 't' || g FROM generate_series(1, 7) g;
  RETURN NEW;
END $$;
CREATE TRIGGER on_vehicle_created_create_cleaning_tasks AFTER INSERT ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.fixture_create_cleaning_tasks();

-- Original (pre-fix) fleet -> vehicles trigger, byte-equivalent logic.
-- Exact copy of the production function body (md5 0c555fa36c3421548a2b65e7e069740d).
CREATE OR REPLACE FUNCTION public.sync_fleet_vehicle_to_vehicles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_existing_id uuid;
  v_target_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_existing_id
    FROM public.vehicles
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.vehicles
      SET fleet_vehicle_id = NEW.id,
          modelo = COALESCE(NEW.modelo, modelo),
          categoria = COALESCE(NEW.categoria, categoria),
          is_archived = false,
          archived_at = NULL,
          archived_by = NULL,
          updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.vehicles (
        organization_id, matricula, modelo, categoria,
        status, is_archived, fleet_vehicle_id, created_at, updated_at
      ) VALUES (
        NEW.organization_id, UPPER(TRIM(NEW.matricula)), NEW.modelo, NEW.categoria,
        'sucio', false, NEW.id, NOW(), NOW()
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Find the specific vehicle linked to this fleet vehicle (by fleet_vehicle_id)
    SELECT id INTO v_target_id
    FROM public.vehicles
    WHERE fleet_vehicle_id = NEW.id
    LIMIT 1;

    IF v_target_id IS NOT NULL THEN
      -- Update only that specific vehicle row
      UPDATE public.vehicles
      SET matricula = UPPER(TRIM(NEW.matricula)),
          modelo = COALESCE(NEW.modelo, modelo),
          categoria = COALESCE(NEW.categoria, categoria),
          updated_at = NOW()
      WHERE id = v_target_id;
    ELSE
      -- Fallback: try to find by old matricula (no fleet_vehicle_id link)
      SELECT id INTO v_target_id
      FROM public.vehicles
      WHERE organization_id = NEW.organization_id
        AND UPPER(TRIM(matricula)) = UPPER(TRIM(OLD.matricula))
        AND fleet_vehicle_id IS NULL
      LIMIT 1;

      IF v_target_id IS NOT NULL THEN
        UPDATE public.vehicles
        SET matricula = UPPER(TRIM(NEW.matricula)),
            modelo = COALESCE(NEW.modelo, modelo),
            categoria = COALESCE(NEW.categoria, categoria),
            fleet_vehicle_id = NEW.id,
            updated_at = NOW()
        WHERE id = v_target_id;
      END IF;
    END IF;

    -- Also link any unlinked vehicle with matching new matricula
    UPDATE public.vehicles
    SET fleet_vehicle_id = NEW.id
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
      AND fleet_vehicle_id IS NULL
      AND id != COALESCE(v_target_id, '00000000-0000-0000-0000-000000000000'::uuid);

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.vehicles
    SET is_archived = true,
        archived_at = NOW(),
        fleet_vehicle_id = NULL,
        updated_at = NOW()
    WHERE fleet_vehicle_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
CREATE TRIGGER trg_sync_fleet_to_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.fleet_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.sync_fleet_vehicle_to_vehicles();

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.vehicles, public.fleet_vehicles TO authenticated;

-- ── Synthetic data ──────────────────────────────────────────────────────
INSERT INTO auth.users VALUES ('a0000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles VALUES ('a0000000-0000-0000-0000-000000000001', 'Actor sintético'),
  ('a0000000-0000-0000-0000-000000000002', 'Operario sintético');
INSERT INTO public.organizations VALUES
  ('10000000-0000-0000-0000-000000000001', 'Org uno'),
  ('10000000-0000-0000-0000-000000000002', 'Org dos'),
  ('10000000-0000-0000-0000-000000000003', 'Org tres');
INSERT INTO public.vehicle_locations VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Campa'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Base');

ALTER TABLE public.fleet_vehicles DISABLE TRIGGER trg_sync_fleet_to_vehicles;
INSERT INTO public.fleet_vehicles (id, organization_id, matricula, modelo, categoria, proveedor, numero_bastidor) VALUES
  ('f0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '9772 NNS', 'Modelo X', '2', 'Proveedor', NULL),
  ('f0000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '9772NNS', 'X', 'SUV', 'Proveedor', 'VINSYNTHETIC000001'),
  ('f0000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002', '9772NNS', 'X', 'SUV', 'Otro', 'VINSYNTHETIC000099'),
  ('f0000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '1234 ABC', 'Y', 'C', 'P', 'VINAAAAAAAAAAAAAA1'),
  ('f0000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', '1234ABC', 'Y', 'C', 'P', 'VINBBBBBBBBBBBBBB2'),
  ('f0000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'E200-1', 'Z', 'D', 'P', NULL),
  ('f0000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', 'E200-1', 'Z', 'D', 'P', NULL);
ALTER TABLE public.fleet_vehicles ENABLE TRIGGER trg_sync_fleet_to_vehicles;

-- Org 1: alias candidate A (manual, with space, residual "limpio") and canonical B (Rently literal).
INSERT INTO public.vehicles (id, organization_id, matricula, modelo, categoria, status, location_id, fleet_vehicle_id, created_at, last_status_change) VALUES
  ('ad000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '9772 NNS', 'Modelo X', '2', 'limpio',
   '30000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000a', '2026-06-25 11:58:12+00', '2026-09-08 11:27:49+00'),
  ('bd000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '9772NNS', 'X', 'SUV', 'sucio',
   '30000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000b', '2026-07-07 16:40:54+00', '2026-10-19 12:04:18+00'),
  -- Other organization with the same plate: must never be touched.
  ('cd000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002', '9772NNS', 'X', 'SUV', 'alquilado',
   NULL, 'f0000000-0000-0000-0000-00000000000c', '2026-07-01 10:00:00+00', '2026-10-01 10:00:00+00'),
  -- Incompatible VINs, same normalized plate.
  ('ed000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '1234 ABC', 'Y', 'C', 'sucio',
   NULL, 'f0000000-0000-0000-0000-000000000011', '2026-05-01 10:00:00+00', '2026-05-01 10:00:00+00'),
  ('ed000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', '1234ABC', 'Y', 'C', 'sucio',
   NULL, 'f0000000-0000-0000-0000-000000000012', '2026-05-02 10:00:00+00', '2026-05-02 10:00:00+00'),
  -- Legitimate literal with separator, unique: must remain exactly as stored.
  ('ed000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'E200-1', 'Z', 'D', 'limpio',
   NULL, 'f0000000-0000-0000-0000-000000000021', '2026-04-01 10:00:00+00', '2026-04-01 10:00:00+00');

-- A: 7/7 tasks done (residual) and 3 history events; B: 0/7 done and 5 events + 2 movements.
UPDATE public.vehicle_cleaning_tasks SET completed = true, completed_at = '2026-09-08 11:27:50+00',
  completed_by = 'a0000000-0000-0000-0000-000000000002'
 WHERE vehicle_id = 'ad000000-0000-0000-0000-00000000000a';
INSERT INTO public.vehicle_cleaning_history (organization_id, vehicle_id, task_key, completed_by, completed_at, notes)
SELECT '10000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', 't' || g,
       'a0000000-0000-0000-0000-000000000002', timestamptz '2026-07-05 17:25:00+00' + (g || ' minutes')::interval, 'nota A ' || g
  FROM generate_series(1, 3) g;
INSERT INTO public.vehicle_cleaning_history (organization_id, vehicle_id, task_key, completed_by, completed_at, notes)
SELECT '10000000-0000-0000-0000-000000000001', 'bd000000-0000-0000-0000-00000000000b', 't' || g,
       'a0000000-0000-0000-0000-000000000002', timestamptz '2026-10-07 09:10:00+00' + (g || ' minutes')::interval, NULL
  FROM generate_series(1, 5) g;
INSERT INTO public.vehicle_cleaning_history (organization_id, vehicle_id, task_key, completed_by, completed_at)
VALUES ('10000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-00000000000c', 't1',
        'a0000000-0000-0000-0000-000000000002', '2026-09-01 09:00:00+00');
INSERT INTO public.vehicle_movements (vehicle_id, matricula) VALUES
  ('bd000000-0000-0000-0000-00000000000b', '9772NNS'), ('bd000000-0000-0000-0000-00000000000b', '9772NNS');
