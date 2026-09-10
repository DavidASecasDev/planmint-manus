CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.organizations(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.reservations(id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.organizations(id));
CREATE TABLE public.rently_sync_status(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  status text NOT NULL DEFAULT 'idle', last_full_sync_at timestamptz
);

CREATE OR REPLACE FUNCTION public.ses_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.ses_person_profiles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  document_type text, document_number text, first_name text, first_surname text, second_surname text,
  birth_date date, nationality_code text, sex text, address_line text, address_number text,
  address_complement text, municipality_code text, municipality_name text, postal_code text,
  country_code text, phone text, phone_secondary text, email text, licence_type text,
  licence_valid_until date, licence_number text, licence_support text, licence_country_code text,
  manual_fields text[] NOT NULL DEFAULT '{}', created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER fixture_person_updated BEFORE UPDATE ON public.ses_person_profiles FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();

CREATE TABLE public.ses_locations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text, use_establishment_code boolean, establishment_code text, address_line text,
  address_complement text, municipality_code text, municipality_name text, postal_code text,
  country_code text, latitude numeric, longitude numeric, verified boolean,
  manual_fields text[] NOT NULL DEFAULT '{}', created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER fixture_location_updated BEFORE UPDATE ON public.ses_locations FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();

CREATE TABLE public.ses_contract_drafts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id), external_booking_id bigint, reference text NOT NULL,
  status text NOT NULL DEFAULT 'incomplete', contract_date date, pickup_at timestamptz, return_at timestamptz,
  pickup_location_id uuid REFERENCES public.ses_locations(id), return_location_id uuid REFERENCES public.ses_locations(id),
  holder_profile_id uuid REFERENCES public.ses_person_profiles(id), primary_driver_profile_id uuid REFERENCES public.ses_person_profiles(id),
  secondary_driver_profile_id uuid REFERENCES public.ses_person_profiles(id), payment_type text, payment_date date,
  payment_medium text, payment_holder text, card_expiry text, vehicle_category text, vehicle_type text,
  vehicle_brand text, vehicle_model text, vehicle_plate text, vehicle_vin text, vehicle_color text,
  km_pickup bigint, km_return bigint, gps_data text, validation_errors jsonb NOT NULL DEFAULT '[]',
  content_hash text, draft_version integer NOT NULL DEFAULT 1, manual_fields text[] NOT NULL DEFAULT '{}',
  last_prepared_at timestamptz, accepted_at timestamptz, created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  is_complete boolean NOT NULL DEFAULT false, is_eligible boolean NOT NULL DEFAULT true,
  is_officially_clear boolean NOT NULL DEFAULT false, ready_for_xml boolean NOT NULL DEFAULT false,
  eligibility_errors jsonb NOT NULL DEFAULT '[]', eligibility_snapshot jsonb NOT NULL DEFAULT '{}',
  official_check_status text NOT NULL DEFAULT 'not_checked', last_eligibility_checked_at timestamptz,
  document_version text NOT NULL DEFAULT '1.2.0', UNIQUE(organization_id,reservation_id)
);
CREATE TRIGGER fixture_draft_updated BEFORE UPDATE ON public.ses_contract_drafts FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();

CREATE TABLE public.ses_field_audit_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entity_type text NOT NULL, entity_id uuid NOT NULL, field_name text NOT NULL, source text NOT NULL,
  previous_value jsonb, new_value jsonb, reason text NOT NULL, performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_field_audit_source CHECK(source IN ('rently','respond','manual'))
);
CREATE TABLE public.ses_audit_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL, changed_fields text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}', performed_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations(id) VALUES
  ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles(id) VALUES ('10000000-0000-4000-8000-000000000001');
INSERT INTO public.reservations(id,organization_id) VALUES
  ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
INSERT INTO public.ses_person_profiles(
  id,organization_id,document_type,document_number,first_name,first_surname,licence_number,manual_fields
) VALUES (
  '30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
  'OTRO','P123456A','NOMBRE COMPLETO','NOMBRE COMPLETO','P123456A',ARRAY['document_number']
);
INSERT INTO public.ses_locations(id,organization_id,name,country_code,verified) VALUES
  ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','RECOGIDA SINTÉTICA','ESP',false),
  ('40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','DEVOLUCIÓN SINTÉTICA','ESP',false);
INSERT INTO public.ses_contract_drafts(
  id,organization_id,reservation_id,external_booking_id,reference,status,pickup_at,return_at,
  pickup_location_id,return_location_id,holder_profile_id,primary_driver_profile_id,ready_for_xml,is_complete
) VALUES (
  '50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',5582,'5582','ready','2026-09-10 10:00:00+00','2026-09-10 16:00:00+00',
  '40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,true
);
