-- SES.HOSPEDAJES compatibility recovery for established installations.
-- IMPORTANT: review and authorize explicitly before running on a real database.
-- This migration is additive and transactional. It never drops/truncates/recreates data tables.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'organizations', 'profiles', 'reservations', 'ses_settings', 'ses_person_profiles',
    'ses_locations', 'ses_contract_drafts', 'ses_batches', 'ses_batch_items', 'ses_audit_events'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'SES recovery precondition failed: required table public.% is missing', required_table;
    END IF;
  END LOOP;
END;
$$;

-- Capture immutable pre-migration evidence. These temporary tables disappear on COMMIT/ROLLBACK.
CREATE TEMP TABLE _ses_pre_drafts ON COMMIT DROP AS
SELECT id, organization_id, reference, status, draft_version, content_hash, updated_at
FROM public.ses_contract_drafts;

CREATE TEMP TABLE _ses_pre_batches ON COMMIT DROP AS
SELECT id, organization_id, status, schema_version, file_name, xml_hash, item_count,
       accepted_count, error_count, generated_at, uploaded_at, result_recorded_at, notes, updated_at
FROM public.ses_batches;

CREATE TEMP TABLE _ses_pre_batch_items ON COMMIT DROP AS
SELECT id, batch_id, draft_id, item_order, draft_version, result_status, result_code,
       result_message, md5(payload_snapshot::text) AS payload_hash, updated_at
FROM public.ses_batch_items;

CREATE TEMP TABLE _ses_pre_settings ON COMMIT DROP AS
SELECT id, organization_id, lessor_code, establishment_code, government_service_enabled,
       default_payment_type, default_vehicle_type, holder_is_primary_driver, schema_version,
       xml_namespace, created_by, updated_by, created_at, updated_at
FROM public.ses_settings;

CREATE TEMP TABLE _ses_pre_draft_rows ON COMMIT DROP AS
SELECT id, to_jsonb(row_value) AS payload FROM public.ses_contract_drafts row_value;
CREATE TEMP TABLE _ses_pre_batch_rows ON COMMIT DROP AS
SELECT id, to_jsonb(row_value) AS payload FROM public.ses_batches row_value;
CREATE TEMP TABLE _ses_pre_batch_item_rows ON COMMIT DROP AS
SELECT id, to_jsonb(row_value) AS payload FROM public.ses_batch_items row_value;
CREATE TEMP TABLE _ses_pre_setting_rows ON COMMIT DROP AS
SELECT id, to_jsonb(row_value) AS payload FROM public.ses_settings row_value;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS rently_delivery_branch_office_id integer,
  ADD COLUMN IF NOT EXISTS rently_delivery_actual_at timestamptz,
  ADD COLUMN IF NOT EXISTS rently_detail_booking_id bigint,
  ADD COLUMN IF NOT EXISTS rently_detail_vehicle_plate text;

ALTER TABLE public.ses_settings
  ADD COLUMN IF NOT EXISTS official_xsd_storage_key text,
  ADD COLUMN IF NOT EXISTS official_xsd_url text,
  ADD COLUMN IF NOT EXISTS official_xsd_hash text,
  ADD COLUMN IF NOT EXISTS official_xsd_version text,
  ADD COLUMN IF NOT EXISTS official_xsd_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS official_xsd_uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS official_inventory_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS official_inventory_source_date date,
  ADD COLUMN IF NOT EXISTS official_inventory_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ses_contract_drafts
  ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_officially_clear boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_for_xml boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligibility_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS official_check_status text NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS last_eligibility_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS document_version text NOT NULL DEFAULT '1.2.0';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ses_contract_drafts'::regclass
      AND conname = 'ses_drafts_official_check_status'
  ) THEN
    ALTER TABLE public.ses_contract_drafts
      ADD CONSTRAINT ses_drafts_official_check_status CHECK (
        official_check_status IN ('not_checked','clear','blocked','review')
      );
  END IF;
END;
$$;

ALTER TABLE public.ses_batches
  ADD COLUMN IF NOT EXISTS official_lot_code text,
  ADD COLUMN IF NOT EXISTS document_version text NOT NULL DEFAULT '1.2.0',
  ADD COLUMN IF NOT EXISTS xsd_version text,
  ADD COLUMN IF NOT EXISTS xsd_hash text,
  ADD COLUMN IF NOT EXISTS xsd_validated_at timestamptz;

ALTER TABLE public.ses_batch_items
  ADD COLUMN IF NOT EXISTS official_communication_code text,
  ADD COLUMN IF NOT EXISTS snapshot_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS snapshot_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ses_batches_org_official_lot_code
  ON public.ses_batches(organization_id, official_lot_code)
  WHERE official_lot_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ses_batch_items_official_communication_code
  ON public.ses_batch_items(official_communication_code)
  WHERE official_communication_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ses_official_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  official_communication_code text NOT NULL,
  official_lot_code text,
  reference text NOT NULL,
  communication_type text NOT NULL DEFAULT 'ALQUILER_VEHICULO',
  contract_date date NOT NULL,
  vehicle_plate text,
  normalized_plate text,
  status text NOT NULL,
  source text NOT NULL DEFAULT 'manual_import',
  draft_id uuid REFERENCES public.ses_contract_drafts(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.ses_batches(id) ON DELETE SET NULL,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_official_communications_code_unique UNIQUE (organization_id, official_communication_code),
  CONSTRAINT ses_official_communications_type CHECK (communication_type = 'ALQUILER_VEHICULO'),
  CONSTRAINT ses_official_communications_status CHECK (status IN ('active','accepted','annulled','error')),
  CONSTRAINT ses_official_communications_source CHECK (source IN ('manual_import','portal_result','migration'))
);

CREATE INDEX IF NOT EXISTS idx_ses_official_match
  ON public.ses_official_communications(
    organization_id, reference, communication_type, contract_date, normalized_plate
  );

CREATE TABLE IF NOT EXISTS public.ses_historical_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_item_id uuid NOT NULL REFERENCES public.ses_batch_items(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.ses_contract_drafts(id) ON DELETE RESTRICT,
  entity_kind text NOT NULL,
  entity_role text NOT NULL DEFAULT '',
  entity_id uuid,
  entity_version integer NOT NULL DEFAULT 1,
  snapshot_data jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_historical_snapshot_kind CHECK (entity_kind IN ('contract','vehicle','person','location')),
  CONSTRAINT ses_historical_snapshot_unique UNIQUE (batch_item_id, entity_kind, entity_role)
);

CREATE INDEX IF NOT EXISTS idx_ses_historical_snapshots_draft
  ON public.ses_historical_snapshots(draft_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ses_field_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  source text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_field_audit_source CHECK (source IN ('rently','respond','manual')),
  CONSTRAINT ses_field_audit_entity CHECK (entity_type IN ('person','location','draft','reservation','settings'))
);

CREATE INDEX IF NOT EXISTS idx_ses_field_audit_entity
  ON public.ses_field_audit_events(organization_id, entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ses_prevent_historical_snapshot_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los snapshots históricos SES son inmutables';
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.ses_historical_snapshots'::regclass
      AND tgname = 'trg_ses_historical_snapshots_immutable'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_ses_historical_snapshots_immutable
      BEFORE UPDATE OR DELETE ON public.ses_historical_snapshots
      FOR EACH ROW EXECUTE FUNCTION public.ses_prevent_historical_snapshot_mutation();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.ses_official_communications'::regclass
      AND tgname = 'trg_ses_official_communications_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_ses_official_communications_updated_at
      BEFORE UPDATE ON public.ses_official_communications
      FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.ses_official_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_historical_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_field_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ses_official_communications FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_historical_snapshots FROM anon, authenticated;
REVOKE ALL ON TABLE public.ses_field_audit_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ses_official_communications TO service_role;
GRANT ALL ON TABLE public.ses_historical_snapshots TO service_role;
GRANT ALL ON TABLE public.ses_field_audit_events TO service_role;

-- Preserve structured official identifiers already stored in legacy notes/result_code.
ALTER TABLE public.ses_batches DISABLE TRIGGER USER;
UPDATE public.ses_batches
SET official_lot_code = substring(notes from 'Código oficial de lote: ([0-9A-Fa-f-]{36})')
WHERE official_lot_code IS NULL
  AND notes ~ 'Código oficial de lote: [0-9A-Fa-f-]{36}';
UPDATE public.ses_batches current_row
SET updated_at = previous_row.updated_at
FROM _ses_pre_batches previous_row
WHERE current_row.id = previous_row.id;
ALTER TABLE public.ses_batches ENABLE TRIGGER USER;

ALTER TABLE public.ses_batch_items DISABLE TRIGGER USER;
UPDATE public.ses_batch_items
SET official_communication_code = result_code
WHERE official_communication_code IS NULL
  AND result_status = 'accepted'
  AND result_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
UPDATE public.ses_batch_items
SET snapshot_hash = encode(digest(payload_snapshot::text, 'sha256'), 'hex'), snapshot_version = draft_version
WHERE snapshot_hash IS NULL;
UPDATE public.ses_batch_items current_row
SET updated_at = previous_row.updated_at
FROM _ses_pre_batch_items previous_row
WHERE current_row.id = previous_row.id;
ALTER TABLE public.ses_batch_items ENABLE TRIGGER USER;

INSERT INTO public.ses_official_communications (
  organization_id, official_communication_code, official_lot_code, reference,
  contract_date, vehicle_plate, normalized_plate, status, source, draft_id, batch_id, recorded_at
)
SELECT
  draft.organization_id,
  item.official_communication_code,
  batch.official_lot_code,
  draft.reference,
  draft.contract_date,
  draft.vehicle_plate,
  upper(regexp_replace(coalesce(draft.vehicle_plate, ''), '[^A-Za-z0-9]', '', 'g')),
  'accepted', 'migration', draft.id, batch.id,
  coalesce(batch.result_recorded_at, batch.uploaded_at, batch.generated_at)
FROM public.ses_batch_items item
JOIN public.ses_batches batch ON batch.id = item.batch_id
JOIN public.ses_contract_drafts draft ON draft.id = item.draft_id
WHERE item.result_status = 'accepted'
  AND item.official_communication_code IS NOT NULL
ON CONFLICT (organization_id, official_communication_code) DO NOTHING;

-- Snapshot the accepted legacy payload byte-for-byte as JSON before any reusable profile/location can drift.
INSERT INTO public.ses_historical_snapshots (
  organization_id, batch_item_id, draft_id, entity_kind, entity_role,
  entity_id, entity_version, snapshot_data, snapshot_hash, created_at
)
SELECT batch.organization_id, item.id, item.draft_id, 'contract', '', item.draft_id,
       item.draft_version, item.payload_snapshot,
       encode(digest(item.payload_snapshot::text, 'sha256'), 'hex'), item.created_at
FROM public.ses_batch_items item
JOIN public.ses_batches batch ON batch.id = item.batch_id
ON CONFLICT (batch_item_id, entity_kind, entity_role) DO NOTHING;

-- Backfill the four independent gates conservatively. No legacy draft is exportable until
-- current Rently eligibility and confirmed official coverage are recalculated by the application.
ALTER TABLE public.ses_contract_drafts DISABLE TRIGGER USER;
UPDATE public.ses_contract_drafts
SET
  is_complete = (
    coalesce(jsonb_array_length(validation_errors), 0) = 0
    OR status IN ('ready','batched','uploaded_pending_result','accepted')
  ),
  is_eligible = false,
  is_officially_clear = false,
  ready_for_xml = false,
  eligibility_errors = CASE WHEN status = 'accepted' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
      'code','migration.revalidation_required','message','Requiere recalcular elegibilidad e inventario oficial'
    ))
  END,
  eligibility_snapshot = jsonb_build_object(
    'migration','20260828143000_ses_hospedajes_compatibility_restore',
    'legacy_status',coalesce(eligibility_snapshot->>'legacy_status', status),
    'revalidated',false
  ),
  official_check_status = CASE
    WHEN status = 'accepted' THEN 'blocked'
    ELSE 'not_checked'
  END,
  last_eligibility_checked_at = NULL,
  document_version = coalesce(nullif(document_version, ''), '1.2.0');

UPDATE public.ses_contract_drafts current_row
SET updated_at = previous_row.updated_at
FROM _ses_pre_drafts previous_row
WHERE current_row.id = previous_row.id;
ALTER TABLE public.ses_contract_drafts ENABLE TRIGGER USER;

-- Postconditions: no historical identity, payload, configuration, version or accepted result may disappear.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.ses_contract_drafts) <> (SELECT count(*) FROM _ses_pre_drafts) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: draft count changed';
  END IF;
  IF EXISTS (SELECT id FROM _ses_pre_drafts EXCEPT SELECT id FROM public.ses_contract_drafts) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: a historical draft id disappeared';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _ses_pre_drafts before_row
    JOIN public.ses_contract_drafts after_row USING (id)
    WHERE before_row.draft_version IS DISTINCT FROM after_row.draft_version
       OR before_row.content_hash IS DISTINCT FROM after_row.content_hash
       OR before_row.updated_at IS DISTINCT FROM after_row.updated_at
       OR before_row.status IS DISTINCT FROM after_row.status
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: draft status/version/hash/history changed unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM _ses_pre_draft_rows before_row
    JOIN public.ses_contract_drafts after_row USING (id)
    WHERE (before_row.payload - ARRAY[
      'is_complete','is_eligible','is_officially_clear','ready_for_xml','eligibility_errors',
      'eligibility_snapshot','official_check_status','last_eligibility_checked_at',
      'document_version'
    ]) IS DISTINCT FROM (
      to_jsonb(after_row) - ARRAY[
        'is_complete','is_eligible','is_officially_clear','ready_for_xml','eligibility_errors',
        'eligibility_snapshot','official_check_status','last_eligibility_checked_at',
        'document_version'
      ]
    )
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: a legacy draft column changed unexpectedly';
  END IF;
  IF (SELECT count(*) FROM public.ses_batches) <> (SELECT count(*) FROM _ses_pre_batches)
     OR EXISTS (SELECT id FROM _ses_pre_batches EXCEPT SELECT id FROM public.ses_batches) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: batch identity/count changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _ses_pre_batches before_row
    JOIN public.ses_batches after_row USING (id)
    WHERE before_row.status IS DISTINCT FROM after_row.status
       OR before_row.file_name IS DISTINCT FROM after_row.file_name
       OR before_row.xml_hash IS DISTINCT FROM after_row.xml_hash
       OR before_row.item_count IS DISTINCT FROM after_row.item_count
       OR before_row.accepted_count IS DISTINCT FROM after_row.accepted_count
       OR before_row.error_count IS DISTINCT FROM after_row.error_count
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: historical batch payload/count changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _ses_pre_batch_rows before_row
    JOIN public.ses_batches after_row USING (id)
    WHERE (before_row.payload - ARRAY['official_lot_code','document_version','xsd_version','xsd_hash','xsd_validated_at'])
      IS DISTINCT FROM (
      to_jsonb(after_row) - ARRAY['official_lot_code','document_version','xsd_version','xsd_hash','xsd_validated_at']
    )
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: a legacy batch column changed';
  END IF;
  IF (SELECT count(*) FROM public.ses_batch_items) <> (SELECT count(*) FROM _ses_pre_batch_items)
     OR EXISTS (SELECT id FROM _ses_pre_batch_items EXCEPT SELECT id FROM public.ses_batch_items) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: batch item identity/count changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _ses_pre_batch_items before_row
    JOIN public.ses_batch_items after_row USING (id)
    WHERE before_row.draft_id IS DISTINCT FROM after_row.draft_id
       OR before_row.draft_version IS DISTINCT FROM after_row.draft_version
       OR before_row.result_status IS DISTINCT FROM after_row.result_status
       OR before_row.payload_hash IS DISTINCT FROM md5(after_row.payload_snapshot::text)
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: batch item snapshot/result changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _ses_pre_batch_item_rows before_row
    JOIN public.ses_batch_items after_row USING (id)
    WHERE (before_row.payload - ARRAY['official_communication_code','snapshot_version','snapshot_hash'])
      IS DISTINCT FROM (
      to_jsonb(after_row) - ARRAY['official_communication_code','snapshot_version','snapshot_hash']
    )
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: a legacy batch item column changed';
  END IF;
  IF (SELECT count(*) FROM public.ses_settings) <> (SELECT count(*) FROM _ses_pre_settings)
     OR EXISTS (
       SELECT id,organization_id,lessor_code,establishment_code,government_service_enabled,
              default_payment_type,default_vehicle_type,holder_is_primary_driver,schema_version,
              xml_namespace,created_by,updated_by,created_at,updated_at
       FROM _ses_pre_settings
       EXCEPT
       SELECT id,organization_id,lessor_code,establishment_code,government_service_enabled,
              default_payment_type,default_vehicle_type,holder_is_primary_driver,schema_version,
              xml_namespace,created_by,updated_by,created_at,updated_at
       FROM public.ses_settings
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: historical settings changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _ses_pre_setting_rows before_row
    JOIN public.ses_settings after_row USING (id)
    WHERE (before_row.payload - ARRAY[
      'official_xsd_storage_key','official_xsd_url','official_xsd_hash','official_xsd_version',
      'official_xsd_uploaded_at','official_xsd_uploaded_by','official_inventory_confirmed_at',
      'official_inventory_source_date','official_inventory_confirmed_by'
    ]) IS DISTINCT FROM (
      to_jsonb(after_row) - ARRAY[
        'official_xsd_storage_key','official_xsd_url','official_xsd_hash','official_xsd_version',
        'official_xsd_uploaded_at','official_xsd_uploaded_by','official_inventory_confirmed_at',
        'official_inventory_source_date','official_inventory_confirmed_by'
      ]
    )
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: a legacy settings column changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ses_contract_drafts WHERE ready_for_xml = true) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: a legacy draft became exportable without revalidation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ses_batch_items item
    JOIN public.ses_contract_drafts draft ON draft.id = item.draft_id
    WHERE item.result_status = 'accepted'
      AND (draft.status <> 'accepted' OR draft.ready_for_xml = true)
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: an accepted historical item is resendable';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ses_batch_items item
    JOIN public.ses_batches batch ON batch.id = item.batch_id
    JOIN public.ses_contract_drafts draft ON draft.id = item.draft_id
    WHERE item.result_status = 'accepted'
      AND item.official_communication_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.ses_official_communications official
        WHERE official.organization_id = draft.organization_id
          AND official.official_communication_code = item.official_communication_code
          AND official.reference = draft.reference
          AND official.communication_type = 'ALQUILER_VEHICULO'
          AND official.contract_date = draft.contract_date
          AND official.status = 'accepted'
      )
  ) THEN
    RAISE EXCEPTION 'SES recovery postcondition failed: accepted history is absent from official inventory';
  END IF;
END;
$$;

COMMIT;
