-- =============================================================================
-- PlanMint: SES.HOSPEDAJES preparation module
-- Prepares vehicle-rental communications and XML files. It does NOT submit data.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ses_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS rently_creation_date timestamptz;

CREATE TABLE IF NOT EXISTS public.ses_municipalities (
  code varchar(5) PRIMARY KEY,
  name text NOT NULL,
  province_code varchar(2) NOT NULL,
  province_name text NOT NULL,
  autonomous_community_code varchar(2),
  autonomous_community_name text,
  normalized_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_municipalities_code_format CHECK (code ~ '^[0-9]{5}$')
);

CREATE INDEX IF NOT EXISTS idx_ses_municipalities_normalized_name
  ON public.ses_municipalities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_ses_municipalities_province_name
  ON public.ses_municipalities(province_code, normalized_name);

CREATE TABLE IF NOT EXISTS public.ses_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lessor_code text,
  establishment_code text,
  government_service_enabled boolean NOT NULL DEFAULT false,
  default_payment_type text,
  default_vehicle_type text DEFAULT 'TURISMO',
  holder_is_primary_driver boolean NOT NULL DEFAULT true,
  schema_version text NOT NULL DEFAULT '1.2.0',
  xml_namespace text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id),
  CONSTRAINT ses_settings_payment_type CHECK (
    default_payment_type IS NULL OR default_payment_type IN
      ('DESTI','EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','OTRO')
  ),
  CONSTRAINT ses_settings_vehicle_type CHECK (
    default_vehicle_type IN
      ('FURGONETA','CAMION','AUTOBUS','TURISMO','MOTO','TRACTOR','REMOLQUE','CAMPER','CARAVANA','OTRO')
  )
);

ALTER TABLE public.ses_settings ADD COLUMN IF NOT EXISTS lessor_code text;
ALTER TABLE public.ses_settings ADD COLUMN IF NOT EXISTS establishment_code text;
ALTER TABLE public.ses_settings ADD COLUMN IF NOT EXISTS government_service_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ses_person_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rently_customer_id bigint,
  document_type text NOT NULL,
  document_number text NOT NULL,
  first_name text NOT NULL,
  first_surname text NOT NULL,
  second_surname text,
  birth_date date,
  nationality_code varchar(3),
  sex varchar(1),
  address_line text,
  address_number text,
  address_complement text,
  municipality_code varchar(5) REFERENCES public.ses_municipalities(code),
  municipality_name text,
  postal_code text,
  country_code varchar(3),
  phone text,
  phone_secondary text,
  email text,
  licence_type text,
  licence_valid_until date,
  licence_number text,
  licence_support text,
  licence_country_code varchar(3),
  manual_fields text[] NOT NULL DEFAULT '{}',
  last_rently_sync_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, document_type, document_number),
  CONSTRAINT ses_person_document_type CHECK (document_type IN ('NIF','NIE','PAS','OTRO')),
  CONSTRAINT ses_person_nationality CHECK (nationality_code IS NULL OR nationality_code ~ '^[A-Z]{3}$'),
  CONSTRAINT ses_person_sex CHECK (sex IS NULL OR sex IN ('H','M','O')),
  CONSTRAINT ses_person_country CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{3}$'),
  CONSTRAINT ses_person_licence_country CHECK (licence_country_code IS NULL OR licence_country_code ~ '^[A-Z]{3}$'),
  CONSTRAINT ses_person_licence_type CHECK (
    licence_type IS NULL OR licence_type IN
      ('AM','AML','A1','A2','A','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','LCM','LVA','ADR','PI','OT')
  )
);

CREATE INDEX IF NOT EXISTS idx_ses_person_profiles_org_rently
  ON public.ses_person_profiles(organization_id, rently_customer_id);
CREATE INDEX IF NOT EXISTS idx_ses_person_profiles_org_document
  ON public.ses_person_profiles(organization_id, document_number);

CREATE TABLE IF NOT EXISTS public.ses_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rently_place_id text,
  normalized_key text NOT NULL,
  name text NOT NULL,
  use_establishment_code boolean NOT NULL DEFAULT false,
  establishment_code varchar(10),
  address_line text,
  address_complement text,
  municipality_code varchar(5) REFERENCES public.ses_municipalities(code),
  municipality_name text,
  postal_code text,
  country_code varchar(3) NOT NULL DEFAULT 'ESP',
  latitude double precision,
  longitude double precision,
  verified boolean NOT NULL DEFAULT false,
  manual_fields text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, normalized_key),
  CONSTRAINT ses_locations_country CHECK (country_code ~ '^[A-Z]{3}$'),
  CONSTRAINT ses_locations_establishment_code CHECK (
    establishment_code IS NULL OR establishment_code ~ '^[A-Za-z0-9]{10}$'
  ),
  CONSTRAINT ses_locations_address_or_establishment CHECK (
    (use_establishment_code = true AND establishment_code IS NOT NULL)
    OR
    (use_establishment_code = false AND address_line IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ses_locations_org_rently
  ON public.ses_locations(organization_id, rently_place_id);

CREATE TABLE IF NOT EXISTS public.ses_contract_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  external_booking_id bigint,
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending_sync',
  contract_date date,
  pickup_at timestamptz,
  return_at timestamptz,
  pickup_location_id uuid REFERENCES public.ses_locations(id) ON DELETE SET NULL,
  return_location_id uuid REFERENCES public.ses_locations(id) ON DELETE SET NULL,
  holder_profile_id uuid REFERENCES public.ses_person_profiles(id) ON DELETE SET NULL,
  primary_driver_profile_id uuid REFERENCES public.ses_person_profiles(id) ON DELETE SET NULL,
  secondary_driver_profile_id uuid REFERENCES public.ses_person_profiles(id) ON DELETE SET NULL,
  payment_type text,
  payment_date date,
  payment_medium text,
  payment_holder text,
  card_expiry varchar(7),
  vehicle_category text,
  vehicle_type text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_vin text,
  vehicle_color text,
  km_pickup bigint,
  km_return bigint,
  gps_data text,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  draft_version integer NOT NULL DEFAULT 1,
  manual_fields text[] NOT NULL DEFAULT '{}',
  last_prepared_at timestamptz,
  accepted_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reservation_id),
  CONSTRAINT ses_drafts_status CHECK (status IN (
    'pending_sync','incomplete','ready','batched','uploaded_pending_result','accepted','error','needs_revision'
  )),
  CONSTRAINT ses_drafts_payment_type CHECK (
    payment_type IS NULL OR payment_type IN
      ('DESTI','EFECT','TARJT','PLATF','TRANS','MOVIL','TREG','OTRO')
  ),
  CONSTRAINT ses_drafts_vehicle_type CHECK (
    vehicle_type IS NULL OR vehicle_type IN
      ('FURGONETA','CAMION','AUTOBUS','TURISMO','MOTO','TRACTOR','REMOLQUE','CAMPER','CARAVANA','OTRO')
  ),
  CONSTRAINT ses_drafts_card_expiry CHECK (card_expiry IS NULL OR card_expiry ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'),
  CONSTRAINT ses_drafts_km_pickup CHECK (km_pickup IS NULL OR km_pickup >= 0),
  CONSTRAINT ses_drafts_km_return CHECK (km_return IS NULL OR km_return >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ses_drafts_org_status_pickup
  ON public.ses_contract_drafts(organization_id, status, pickup_at);
CREATE INDEX IF NOT EXISTS idx_ses_drafts_external_booking
  ON public.ses_contract_drafts(organization_id, external_booking_id);

CREATE TABLE IF NOT EXISTS public.ses_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'generated',
  schema_version text NOT NULL DEFAULT '1.2.0',
  file_name text NOT NULL,
  xml_hash text NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  downloaded_at timestamptz,
  uploaded_at timestamptz,
  result_recorded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_batches_status CHECK (status IN (
    'generated','downloaded','uploaded_pending_result','partially_accepted','accepted','error'
  )),
  CONSTRAINT ses_batches_counts CHECK (
    item_count >= 0 AND accepted_count >= 0 AND error_count >= 0
    AND accepted_count + error_count <= item_count
  )
);

CREATE INDEX IF NOT EXISTS idx_ses_batches_org_generated
  ON public.ses_batches(organization_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.ses_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.ses_batches(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.ses_contract_drafts(id) ON DELETE RESTRICT,
  item_order integer NOT NULL,
  draft_version integer NOT NULL,
  payload_snapshot jsonb NOT NULL,
  result_status text NOT NULL DEFAULT 'pending',
  result_code text,
  result_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, draft_id),
  UNIQUE (batch_id, item_order),
  CONSTRAINT ses_batch_items_order CHECK (item_order > 0),
  CONSTRAINT ses_batch_items_status CHECK (result_status IN ('pending','accepted','error'))
);

CREATE INDEX IF NOT EXISTS idx_ses_batch_items_draft ON public.ses_batch_items(draft_id);

CREATE TABLE IF NOT EXISTS public.ses_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_audit_entity_type CHECK (entity_type IN ('person','location','draft','batch','batch_item','settings'))
);

CREATE INDEX IF NOT EXISTS idx_ses_audit_org_entity
  ON public.ses_audit_events(organization_id, entity_type, entity_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_ses_municipalities_updated_at ON public.ses_municipalities;
CREATE TRIGGER trg_ses_municipalities_updated_at BEFORE UPDATE ON public.ses_municipalities
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS trg_ses_settings_updated_at ON public.ses_settings;
CREATE TRIGGER trg_ses_settings_updated_at BEFORE UPDATE ON public.ses_settings
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS trg_ses_person_profiles_updated_at ON public.ses_person_profiles;
CREATE TRIGGER trg_ses_person_profiles_updated_at BEFORE UPDATE ON public.ses_person_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS trg_ses_locations_updated_at ON public.ses_locations;
CREATE TRIGGER trg_ses_locations_updated_at BEFORE UPDATE ON public.ses_locations
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS trg_ses_contract_drafts_updated_at ON public.ses_contract_drafts;
CREATE TRIGGER trg_ses_contract_drafts_updated_at BEFORE UPDATE ON public.ses_contract_drafts
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS trg_ses_batches_updated_at ON public.ses_batches;
CREATE TRIGGER trg_ses_batches_updated_at BEFORE UPDATE ON public.ses_batches
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS trg_ses_batch_items_updated_at ON public.ses_batch_items;
CREATE TRIGGER trg_ses_batch_items_updated_at BEFORE UPDATE ON public.ses_batch_items
  FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();

ALTER TABLE public.ses_municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_person_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_contract_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ses_municipalities FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_person_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_locations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_contract_drafts FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_batches FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_batch_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_audit_events FROM anon, authenticated;

GRANT ALL ON TABLE public.ses_municipalities TO service_role;
GRANT ALL ON TABLE public.ses_settings TO service_role;
GRANT ALL ON TABLE public.ses_person_profiles TO service_role;
GRANT ALL ON TABLE public.ses_locations TO service_role;
GRANT ALL ON TABLE public.ses_contract_drafts TO service_role;
GRANT ALL ON TABLE public.ses_batches TO service_role;
GRANT ALL ON TABLE public.ses_batch_items TO service_role;
GRANT ALL ON TABLE public.ses_audit_events TO service_role;
