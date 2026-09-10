BEGIN;

ALTER TABLE public.rently_sync_status
  ADD COLUMN IF NOT EXISTS coverage_version text,
  ADD COLUMN IF NOT EXISTS coverage_scope jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS rently_delivery_actual_literal text,
  ADD COLUMN IF NOT EXISTS rently_dropoff_actual_literal text,
  ADD COLUMN IF NOT EXISTS rently_dropoff_actual_at timestamptz,
  ADD COLUMN IF NOT EXISTS rently_list_updated_literal text,
  ADD COLUMN IF NOT EXISTS rently_list_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.rently_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_booking_id bigint NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  current_status integer,
  updated_literal text,
  updated_at timestamptz,
  planned_from_literal text,
  planned_from_at timestamptz,
  planned_to_literal text,
  planned_to_at timestamptz,
  delivery_actual_literal text,
  delivery_actual_at timestamptz,
  dropoff_actual_literal text,
  dropoff_actual_at timestamptz,
  raw_event_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  row_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_booking_id)
);

CREATE INDEX IF NOT EXISTS idx_rently_booking_events_delivery
  ON public.rently_booking_events (organization_id, delivery_actual_at, external_booking_id);
CREATE INDEX IF NOT EXISTS idx_rently_booking_events_dropoff
  ON public.rently_booking_events (organization_id, dropoff_actual_at, external_booking_id);

ALTER TABLE public.rently_booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rently_booking_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.rently_booking_events FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.rently_booking_events TO service_role;

ALTER TABLE public.ses_contract_drafts
  ADD COLUMN IF NOT EXISTS planned_pickup_literal text,
  ADD COLUMN IF NOT EXISTS planned_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_delivery_literal text,
  ADD COLUMN IF NOT EXISTS actual_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_at_source text,
  ADD COLUMN IF NOT EXISTS planned_return_literal text,
  ADD COLUMN IF NOT EXISTS planned_return_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_dropoff_literal text,
  ADD COLUMN IF NOT EXISTS actual_dropoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_at_source text;

ALTER TABLE public.ses_field_audit_events
  DROP CONSTRAINT IF EXISTS ses_field_audit_source;
ALTER TABLE public.ses_field_audit_events
  ADD CONSTRAINT ses_field_audit_source
  CHECK (source IN ('rently','hubspot','respond','document','manual'));

CREATE TABLE IF NOT EXISTS public.ses_review_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  time_zone text NOT NULL DEFAULT 'Europe/Madrid',
  batch_kind text NOT NULL DEFAULT 'daily' CHECK (batch_kind IN ('daily','historical')),
  source_channel text NOT NULL DEFAULT 'manual' CHECK (source_channel IN ('manual','heartbeat','historical')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','partial','completed','failed','cancelled')),
  phase text NOT NULL DEFAULT 'discover_deliveries' CHECK (phase IN ('discover_deliveries','fetch_details','upsert_drafts','await_external_sources','completed')),
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{"discovered":0,"processed":0,"total":null,"pagesComplete":false,"coverageComplete":false}'::jsonb,
  pages_complete boolean NOT NULL DEFAULT false,
  coverage_complete boolean NOT NULL DEFAULT false,
  candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  verified_count integer NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  pending_count integer NOT NULL DEFAULT 0 CHECK (pending_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  historical_from date,
  historical_to date,
  gmail_draft_reference text,
  schedule_task_uid varchar(65),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  next_retry_at timestamptz,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  last_heartbeat_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start),
  CHECK (time_zone = 'Europe/Madrid'),
  CHECK (
    (batch_kind = 'daily' AND historical_from IS NULL AND historical_to IS NULL)
    OR
    (batch_kind = 'historical' AND historical_from IS NOT NULL AND historical_to IS NOT NULL
      AND historical_to >= historical_from AND historical_to - historical_from <= 90)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ses_review_batches_period
  ON public.ses_review_batches(organization_id, batch_kind, period_start, period_end)
;

CREATE INDEX IF NOT EXISTS idx_ses_review_batches_org_created
  ON public.ses_review_batches(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ses_review_batches_retry
  ON public.ses_review_batches(status, next_retry_at)
  WHERE status IN ('queued','running','partial','failed');
CREATE INDEX IF NOT EXISTS idx_ses_review_batches_lease
  ON public.ses_review_batches(lease_expires_at)
  WHERE lease_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ses_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.ses_review_batches(id) ON DELETE CASCADE,
  external_booking_id bigint NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  draft_id uuid REFERENCES public.ses_contract_drafts(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified_delivery','missing_delivery_evidence','outside_period','date_mismatch','evidence_conflict','failed')),
  planned_from_literal text,
  planned_from_at timestamptz,
  delivery_actual_literal text,
  delivery_actual_at timestamptz,
  dropoff_actual_literal text,
  dropoff_actual_at timestamptz,
  evidence_reference text,
  evidence_generated_literal text,
  evidence_generated_at timestamptz,
  evidence_observed_at timestamptz,
  rently_status_code integer,
  delivery_branch_office_id integer,
  is_transfer boolean,
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_action text,
  last_error text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, external_booking_id)
);

CREATE INDEX IF NOT EXISTS idx_ses_review_items_org_status
  ON public.ses_review_items(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ses_review_items_batch
  ON public.ses_review_items(batch_id, external_booking_id);
CREATE INDEX IF NOT EXISTS idx_ses_review_items_reservation
  ON public.ses_review_items(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ses_review_items_draft
  ON public.ses_review_items(draft_id) WHERE draft_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ses_review_item_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.ses_review_batches(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.ses_review_items(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('rently','hubspot','respond','document')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','consulted','inaccessible')),
  evidence_reference text,
  observed_at timestamptz,
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, source)
);

CREATE INDEX IF NOT EXISTS idx_ses_review_sources_batch_status
  ON public.ses_review_item_sources(batch_id, status, source);
CREATE INDEX IF NOT EXISTS idx_ses_review_sources_org_source
  ON public.ses_review_item_sources(organization_id, source, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ses_review_evidence_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.ses_review_batches(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.ses_review_items(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('hubspot','respond','document')),
  external_submission_id text NOT NULL,
  request_hash text NOT NULL,
  payload jsonb NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('draft','person','pickup_location','return_location')),
  target_id uuid NOT NULL,
  target_updated_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','processing','accepted','rejected','superseded')),
  decision_token uuid,
  processing_started_at timestamptz,
  submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, source, external_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_ses_review_proposals_batch_status
  ON public.ses_review_evidence_proposals(batch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ses_review_proposals_item
  ON public.ses_review_evidence_proposals(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ses_review_proposals_target
  ON public.ses_review_evidence_proposals(organization_id, target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ses_review_automation_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  time_zone text NOT NULL DEFAULT 'Europe/Madrid' CHECK (time_zone = 'Europe/Madrid'),
  review_hour smallint NOT NULL DEFAULT 4 CHECK (review_hour BETWEEN 0 AND 23),
  schedule_task_uid varchar(65) UNIQUE,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_or_resume_ses_review_batch(
  p_organization_id uuid,
  p_review_date date,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_batch_kind text,
  p_source_channel text,
  p_created_by uuid DEFAULT NULL,
  p_historical_from date DEFAULT NULL,
  p_historical_to date DEFAULT NULL,
  p_schedule_task_uid varchar DEFAULT NULL
) RETURNS public.ses_review_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing_batch public.ses_review_batches;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':' || p_batch_kind || ':' || p_period_start::text || ':' || p_period_end::text,
    0
  ));

  SELECT * INTO existing_batch
  FROM public.ses_review_batches
  WHERE organization_id = p_organization_id
    AND batch_kind = p_batch_kind
    AND period_start = p_period_start
    AND period_end = p_period_end
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN existing_batch;
  END IF;

  INSERT INTO public.ses_review_batches (
    organization_id, review_date, period_start, period_end, batch_kind, source_channel,
    created_by, historical_from, historical_to, schedule_task_uid
  ) VALUES (
    p_organization_id, p_review_date, p_period_start, p_period_end, p_batch_kind, p_source_channel,
    p_created_by, p_historical_from, p_historical_to, p_schedule_task_uid
  ) RETURNING * INTO existing_batch;

  RETURN existing_batch;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_resume_ses_review_batch(uuid,date,timestamptz,timestamptz,text,text,uuid,date,date,varchar) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_resume_ses_review_batch(uuid,date,timestamptz,timestamptz,text,text,uuid,date,date,varchar) TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_ses_review_batch_lease(
  p_organization_id uuid,
  p_batch_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 110
) RETURNS public.ses_review_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claimed public.ses_review_batches;
  target_batch public.ses_review_batches;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 120 THEN
    RAISE EXCEPTION 'Duración de lease no válida';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ses-review-org:' || p_organization_id::text, 0));

  SELECT * INTO target_batch
  FROM public.ses_review_batches
  WHERE id = p_batch_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND OR target_batch.status IN ('completed','cancelled') THEN
    RETURN NULL;
  END IF;

  IF target_batch.lease_token IS NOT NULL AND target_batch.lease_expires_at > clock_timestamp() THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ses_review_batches other
    WHERE other.organization_id = p_organization_id
      AND other.id <> p_batch_id
      AND other.lease_token IS NOT NULL
      AND other.lease_expires_at > clock_timestamp()
      AND tstzrange(other.period_start, other.period_end, '[)')
        && tstzrange(target_batch.period_start, target_batch.period_end, '[)')
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.ses_review_batches
  SET lease_token = p_lease_token,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      status = CASE WHEN status = 'failed' THEN 'running' ELSE status END,
      attempt_count = attempt_count + 1,
      started_at = COALESCE(started_at, clock_timestamp()),
      error_summary = NULL
  WHERE id = p_batch_id
    AND organization_id = p_organization_id
    AND status NOT IN ('completed','cancelled')
    AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp())
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_ses_review_batch_lease(uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_ses_review_batch_lease(uuid,uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.renew_ses_review_batch_lease(
  p_organization_id uuid,
  p_batch_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 110
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  renewed_count integer;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 120 THEN
    RAISE EXCEPTION 'Duración de lease no válida';
  END IF;

  UPDATE public.ses_review_batches
  SET lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      last_heartbeat_at = clock_timestamp()
  WHERE id = p_batch_id
    AND organization_id = p_organization_id
    AND lease_token = p_lease_token
    AND lease_expires_at > clock_timestamp()
    AND status NOT IN ('completed','cancelled');
  GET DIAGNOSTICS renewed_count = ROW_COUNT;
  RETURN renewed_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_ses_review_batch_lease(uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_ses_review_batch_lease(uuid,uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ses_review_proposal(
  p_organization_id uuid,
  p_proposal_id uuid,
  p_decision_token uuid
) RETURNS public.ses_review_evidence_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claimed public.ses_review_evidence_proposals;
BEGIN
  UPDATE public.ses_review_evidence_proposals
  SET status = 'processing',
      decision_token = p_decision_token,
      processing_started_at = clock_timestamp()
  WHERE id = p_proposal_id
    AND organization_id = p_organization_id
    AND (
      status = 'proposed'
      OR (status = 'processing' AND processing_started_at < clock_timestamp() - interval '5 minutes')
    )
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ses_review_proposal(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ses_review_proposal(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_ses_review_proposal_decision(
  p_organization_id uuid,
  p_proposal_id uuid,
  p_decision_token uuid,
  p_decision text,
  p_reason text,
  p_actor_id uuid,
  p_applied_changes jsonb,
  p_open_conflicts jsonb,
  p_ignored_fields jsonb
) RETURNS public.ses_review_evidence_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  proposal public.ses_review_evidence_proposals;
  item public.ses_review_items;
  draft public.ses_contract_drafts;
  target_table text;
  target_entity text;
  allowed_fields text[];
  assignment_sql text;
  field_name text;
  previous_json jsonb;
  new_json jsonb;
  merged_conflicts jsonb := '[]'::jsonb;
  open_conflicts jsonb := '[]'::jsonb;
BEGIN
  IF p_decision NOT IN ('accept','reject') OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Decisión o motivo no válidos';
  END IF;
  SELECT * INTO proposal FROM public.ses_review_evidence_proposals
  WHERE id = p_proposal_id AND organization_id = p_organization_id
    AND status = 'processing' AND decision_token = p_decision_token
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La propuesta ya no conserva el token de decisión'; END IF;

  SELECT * INTO item FROM public.ses_review_items
  WHERE id = proposal.item_id AND batch_id = proposal.batch_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND OR item.draft_id IS NULL THEN RAISE EXCEPTION 'Ítem o borrador vinculado no disponible'; END IF;
  SELECT * INTO draft FROM public.ses_contract_drafts
  WHERE id = item.draft_id AND organization_id = p_organization_id FOR UPDATE;
  IF NOT FOUND OR draft.status IN ('batched','uploaded_pending_result','accepted') THEN
    RAISE EXCEPTION 'Borrador inexistente o bloqueado por historial XML';
  END IF;

  IF proposal.target_type = 'draft' THEN
    IF proposal.target_id <> draft.id THEN RAISE EXCEPTION 'Destinatario draft no vinculado'; END IF;
    target_table := 'ses_contract_drafts'; target_entity := 'draft';
    allowed_fields := ARRAY['reference','contract_date','pickup_at','return_at','payment_type','payment_date','payment_medium','payment_holder','card_expiry','vehicle_category','vehicle_type','vehicle_brand','vehicle_model','vehicle_plate','vehicle_vin','vehicle_color','km_pickup','km_return','gps_data'];
  ELSIF proposal.target_type = 'person' THEN
    IF NOT proposal.target_id = ANY(array_remove(ARRAY[draft.holder_profile_id, draft.primary_driver_profile_id, draft.secondary_driver_profile_id], NULL)) THEN RAISE EXCEPTION 'Destinatario person no vinculado'; END IF;
    target_table := 'ses_person_profiles'; target_entity := 'person';
    allowed_fields := ARRAY['document_type','document_number','first_name','first_surname','second_surname','birth_date','nationality_code','sex','address_line','address_number','address_complement','municipality_code','municipality_name','postal_code','country_code','phone','phone_secondary','email','licence_type','licence_valid_until','licence_number','licence_support','licence_country_code'];
  ELSIF proposal.target_type IN ('pickup_location','return_location') THEN
    IF (proposal.target_type = 'pickup_location' AND proposal.target_id IS DISTINCT FROM draft.pickup_location_id)
      OR (proposal.target_type = 'return_location' AND proposal.target_id IS DISTINCT FROM draft.return_location_id) THEN
      RAISE EXCEPTION 'Destinatario location no vinculado';
    END IF;
    target_table := 'ses_locations'; target_entity := 'location';
    allowed_fields := ARRAY['name','use_establishment_code','establishment_code','address_line','address_complement','municipality_code','municipality_name','postal_code','country_code','latitude','longitude','verified'];
  ELSE
    RAISE EXCEPTION 'Tipo de destinatario no permitido';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_object_keys(COALESCE(p_applied_changes, '{}'::jsonb)) AS fields(proposal_field) WHERE NOT (fields.proposal_field = ANY(allowed_fields))) THEN
    RAISE EXCEPTION 'La decisión contiene campos fuera de la allowlist';
  END IF;

  IF p_decision = 'accept' AND COALESCE(p_applied_changes, '{}'::jsonb) <> '{}'::jsonb THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 AND organization_id = $2 FOR UPDATE', target_table)
      INTO previous_json USING proposal.target_id, p_organization_id;
    IF previous_json IS NULL OR (previous_json->>'updated_at')::timestamptz IS DISTINCT FROM proposal.target_updated_at THEN
      RAISE EXCEPTION 'El destinatario cambió después de crear la propuesta; vuelve a revisarla';
    END IF;
    SELECT string_agg(format('%I = populated.%I', fields.proposal_field, fields.proposal_field), ', ')
      INTO assignment_sql FROM jsonb_object_keys(p_applied_changes) AS fields(proposal_field);
    EXECUTE format(
      'UPDATE public.%1$I target SET %2$s, updated_by = $2 FROM (SELECT (jsonb_populate_record(NULL::public.%1$I, $1)).*) populated WHERE target.id = $3 AND target.organization_id = $4',
      target_table, assignment_sql
    ) USING p_applied_changes, p_actor_id, proposal.target_id, p_organization_id;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 AND organization_id = $2', target_table)
      INTO new_json USING proposal.target_id, p_organization_id;
    FOR field_name IN SELECT jsonb_object_keys(p_applied_changes) LOOP
      INSERT INTO public.ses_field_audit_events(
        organization_id, entity_type, entity_id, field_name, source,
        previous_value, new_value, reason, performed_by
      ) VALUES (
        p_organization_id, target_entity, proposal.target_id, field_name, proposal.source,
        previous_json->field_name, new_json->field_name, p_reason, p_actor_id
      );
    END LOOP;
  END IF;

  IF p_decision = 'accept' THEN
    SELECT COALESCE(jsonb_agg(conflict_value ORDER BY conflict_key), '[]'::jsonb) INTO merged_conflicts
    FROM (
      SELECT DISTINCT ON (COALESCE(conflict_value->>'conflictKey', conflict_value::text))
        conflict_value,
        COALESCE(conflict_value->>'conflictKey', conflict_value::text) AS conflict_key
      FROM jsonb_array_elements(COALESCE(item.conflicts, '[]'::jsonb) || COALESCE(p_open_conflicts, '[]'::jsonb)) AS conflicts(conflict_value)
      ORDER BY COALESCE(conflict_value->>'conflictKey', conflict_value::text),
        CASE WHEN conflict_value->>'status' = 'resolved' THEN 0 ELSE 1 END
    ) deduplicated;
    SELECT COALESCE(jsonb_agg(conflict_value), '[]'::jsonb) INTO open_conflicts
    FROM jsonb_array_elements(merged_conflicts) AS conflicts(conflict_value)
    WHERE COALESCE(conflict_value->>'status', 'open') <> 'resolved';
    UPDATE public.ses_review_items SET
      applied_changes = applied_changes || COALESCE(p_applied_changes, '{}'::jsonb),
      proposed_changes = proposed_changes || proposal.payload,
      conflicts = merged_conflicts,
      status = CASE WHEN jsonb_array_length(open_conflicts) > 0 THEN 'evidence_conflict' ELSE status END,
      next_action = CASE WHEN jsonb_array_length(open_conflicts) > 0 THEN 'Resolver contradicciones abiertas' ELSE 'Revalidar campos SES pendientes' END
    WHERE id = item.id AND organization_id = p_organization_id;
    UPDATE public.ses_contract_drafts SET
      ready_for_xml = CASE WHEN jsonb_array_length(open_conflicts) > 0 THEN false ELSE ready_for_xml END,
      is_complete = CASE WHEN jsonb_array_length(open_conflicts) > 0 THEN false ELSE is_complete END,
      status = CASE WHEN jsonb_array_length(open_conflicts) > 0 THEN 'needs_revision' ELSE status END,
      eligibility_snapshot = COALESCE(eligibility_snapshot, '{}'::jsonb) || jsonb_build_object(
        'daily_review_conflicts', merged_conflicts,
        'daily_review_open_conflicts', open_conflicts
      ),
      updated_by = p_actor_id
    WHERE id = draft.id AND organization_id = p_organization_id;
  END IF;

  UPDATE public.ses_review_evidence_proposals SET
    status = CASE WHEN p_decision = 'accept' THEN 'accepted' ELSE 'rejected' END,
    decided_by = p_actor_id,
    decided_at = clock_timestamp(),
    decision_reason = p_reason,
    decision_token = NULL
  WHERE id = proposal.id AND organization_id = p_organization_id AND decision_token = p_decision_token
  RETURNING * INTO proposal;

  INSERT INTO public.ses_audit_events(organization_id, entity_type, entity_id, action, changed_fields, metadata, performed_by)
  VALUES (
    p_organization_id, 'review_proposal', proposal.id,
    CASE WHEN p_decision = 'accept' THEN 'external_evidence_accepted' ELSE 'external_evidence_rejected' END,
    ARRAY(SELECT jsonb_object_keys(COALESCE(p_applied_changes, '{}'::jsonb))),
    jsonb_build_object('source', proposal.source, 'target_type', proposal.target_type, 'target_id', proposal.target_id, 'ignored_fields', p_ignored_fields, 'open_conflict_count', jsonb_array_length(open_conflicts)),
    p_actor_id
  );
  RETURN proposal;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ses_review_proposal_decision(uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ses_review_proposal_decision(uuid,uuid,uuid,text,text,uuid,jsonb,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_ses_review_item_conflict(
  p_organization_id uuid,
  p_item_id uuid,
  p_conflict_key text,
  p_expected_item_updated_at timestamptz,
  p_reason text,
  p_evidence_reference text,
  p_actor_id uuid
)
RETURNS TABLE(
  resolved boolean,
  draft_id uuid,
  item_updated_at timestamptz,
  ready_for_xml boolean,
  open_conflict_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item public.ses_review_items%ROWTYPE;
  draft public.ses_contract_drafts%ROWTYPE;
  conflict jsonb;
  target_type text;
  target_id uuid;
  target_json jsonb;
  current_value jsonb;
  resolved_conflicts jsonb;
  open_conflicts jsonb;
  is_ready boolean;
  field_name text;
  resolved_at timestamptz := clock_timestamp();
BEGIN
  IF length(trim(COALESCE(p_reason, ''))) < 3 OR length(trim(COALESCE(p_evidence_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'Motivo y evidencia de resolución obligatorios';
  END IF;

  SELECT * INTO item FROM public.ses_review_items
  WHERE id = p_item_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ítem de revisión no encontrado'; END IF;
  IF item.updated_at IS DISTINCT FROM p_expected_item_updated_at THEN
    RETURN QUERY SELECT false, item.draft_id, item.updated_at, false, 0;
    RETURN;
  END IF;

  SELECT conflict_value INTO conflict
  FROM jsonb_array_elements(COALESCE(item.conflicts, '[]'::jsonb)) AS conflicts(conflict_value)
  WHERE conflict_value->>'conflictKey' = p_conflict_key
    AND COALESCE(conflict_value->>'status', 'open') <> 'resolved'
  LIMIT 1;
  IF conflict IS NULL THEN RAISE EXCEPTION 'La contradicción abierta no existe o ya fue resuelta'; END IF;
  IF item.draft_id IS NULL THEN RAISE EXCEPTION 'El ítem no tiene expediente SES vinculado'; END IF;

  SELECT * INTO draft FROM public.ses_contract_drafts
  WHERE id = item.draft_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND OR draft.status IN ('batched','uploaded_pending_result','accepted') THEN
    RAISE EXCEPTION 'Expediente inexistente o bloqueado por historial XML';
  END IF;

  target_type := COALESCE(conflict->>'targetType', 'draft');
  target_id := NULLIF(conflict->>'targetId', '')::uuid;
  IF target_type = 'draft' THEN
    target_id := draft.id;
    target_json := to_jsonb(draft);
  ELSIF target_type = 'person' THEN
    IF target_id IS NULL OR NOT target_id = ANY(array_remove(ARRAY[draft.holder_profile_id, draft.primary_driver_profile_id, draft.secondary_driver_profile_id], NULL)) THEN
      RAISE EXCEPTION 'Destinatario person no vinculado';
    END IF;
    SELECT to_jsonb(p) INTO target_json FROM public.ses_person_profiles p
    WHERE p.id = target_id AND p.organization_id = p_organization_id FOR UPDATE;
  ELSIF target_type IN ('pickup_location','return_location') THEN
    IF (target_type = 'pickup_location' AND target_id IS DISTINCT FROM draft.pickup_location_id)
      OR (target_type = 'return_location' AND target_id IS DISTINCT FROM draft.return_location_id) THEN
      RAISE EXCEPTION 'Destinatario location no vinculado';
    END IF;
    SELECT to_jsonb(l) INTO target_json FROM public.ses_locations l
    WHERE l.id = target_id AND l.organization_id = p_organization_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Tipo de destinatario no permitido';
  END IF;
  IF target_json IS NULL THEN RAISE EXCEPTION 'Destinatario de contradicción no encontrado'; END IF;

  field_name := conflict->>'field';
  current_value := target_json->field_name;
  IF current_value IS NULL OR current_value = 'null'::jsonb OR length(trim(current_value #>> '{}')) = 0 THEN
    RAISE EXCEPTION 'El valor actual sigue vacío';
  END IF;
  IF lower(trim(current_value #>> '{}')) = lower(trim(COALESCE(conflict->'currentValue' #>> '{}', ''))) THEN
    RAISE EXCEPTION 'El valor actual no ha cambiado desde la detección';
  END IF;

  SELECT COALESCE(jsonb_agg(
    CASE WHEN conflict_value->>'conflictKey' = p_conflict_key THEN conflict_value || jsonb_build_object(
      'status', 'resolved', 'resolvedValue', current_value, 'resolvedAt', resolved_at,
      'resolvedBy', p_actor_id, 'resolutionReason', p_reason,
      'resolutionEvidenceReference', p_evidence_reference
    ) ELSE conflict_value END ORDER BY ordinality
  ), '[]'::jsonb) INTO resolved_conflicts
  FROM jsonb_array_elements(COALESCE(item.conflicts, '[]'::jsonb)) WITH ORDINALITY AS conflicts(conflict_value, ordinality);

  SELECT COALESCE(jsonb_agg(conflict_value ORDER BY ordinality), '[]'::jsonb) INTO open_conflicts
  FROM jsonb_array_elements(resolved_conflicts) WITH ORDINALITY AS conflicts(conflict_value, ordinality)
  WHERE COALESCE(conflict_value->>'status', 'open') <> 'resolved';
  is_ready := jsonb_array_length(COALESCE(draft.validation_errors, '[]'::jsonb)) = 0
    AND jsonb_array_length(open_conflicts) = 0;

  UPDATE public.ses_review_items SET
    conflicts = resolved_conflicts,
    status = CASE WHEN jsonb_array_length(open_conflicts) = 0 AND status = 'evidence_conflict' THEN 'verified_delivery' ELSE status END,
    next_action = CASE WHEN jsonb_array_length(open_conflicts) = 0 THEN 'Revalidar campos SES pendientes' ELSE 'Resolver contradicciones abiertas' END
  WHERE id = item.id AND organization_id = p_organization_id
  RETURNING updated_at INTO item.updated_at;

  UPDATE public.ses_contract_drafts SET
    eligibility_snapshot = COALESCE(eligibility_snapshot, '{}'::jsonb)
      || jsonb_build_object('daily_review_conflicts', resolved_conflicts, 'daily_review_open_conflicts', open_conflicts),
    ready_for_xml = is_ready,
    is_complete = is_ready,
    status = CASE WHEN is_ready THEN 'ready' ELSE 'incomplete' END,
    updated_by = p_actor_id
  WHERE id = draft.id AND organization_id = p_organization_id;

  INSERT INTO public.ses_audit_events(
    organization_id, entity_type, entity_id, action, changed_fields, metadata, performed_by
  ) VALUES (
    p_organization_id, 'review_item', item.id, 'review_conflict_resolved', ARRAY[field_name],
    jsonb_build_object(
      'conflict_key', p_conflict_key, 'target_type', target_type, 'target_id', target_id,
      'resolved_value', current_value, 'reason', p_reason, 'evidence_reference', p_evidence_reference,
      'resolved_at', resolved_at, 'open_conflict_count', jsonb_array_length(open_conflicts)
    ), p_actor_id
  );

  RETURN QUERY SELECT true, draft.id, item.updated_at, is_ready, jsonb_array_length(open_conflicts);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ses_review_item_conflict(uuid,uuid,text,timestamptz,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ses_review_item_conflict(uuid,uuid,text,timestamptz,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_ses_verified_review_draft(
  p_organization_id uuid,
  p_batch_id uuid,
  p_lease_token uuid,
  p_draft_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_draft_version integer,
  p_values jsonb,
  p_applied_changes jsonb,
  p_conflict_count integer,
  p_pickup_migration text,
  p_actor_id uuid
)
RETURNS TABLE(applied boolean, draft_id uuid, saved_updated_at timestamptz, saved_draft_version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  batch_row public.ses_review_batches%ROWTYPE;
  current_draft public.ses_contract_drafts%ROWTYPE;
  before_draft public.ses_contract_drafts%ROWTYPE;
  merged_draft public.ses_contract_drafts%ROWTYPE;
BEGIN
  SELECT * INTO batch_row FROM public.ses_review_batches
  WHERE id = p_batch_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND OR batch_row.lease_token IS DISTINCT FROM p_lease_token OR batch_row.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'ses_review_lease_lost' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO current_draft FROM public.ses_contract_drafts
  WHERE id = p_draft_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ses_review_draft_not_found' USING ERRCODE = 'P0002'; END IF;
  IF current_draft.updated_at IS DISTINCT FROM p_expected_updated_at
     OR current_draft.draft_version IS DISTINCT FROM p_expected_draft_version THEN
    RETURN QUERY SELECT false, current_draft.id, current_draft.updated_at, current_draft.draft_version;
    RETURN;
  END IF;

  before_draft := current_draft;
  merged_draft := jsonb_populate_record(current_draft, COALESCE(p_values, '{}'::jsonb));
  UPDATE public.ses_contract_drafts SET
    reference = merged_draft.reference, status = merged_draft.status,
    contract_date = merged_draft.contract_date, pickup_at = merged_draft.pickup_at, return_at = merged_draft.return_at,
    pickup_location_id = merged_draft.pickup_location_id, return_location_id = merged_draft.return_location_id,
    holder_profile_id = merged_draft.holder_profile_id, primary_driver_profile_id = merged_draft.primary_driver_profile_id,
    secondary_driver_profile_id = merged_draft.secondary_driver_profile_id,
    payment_type = merged_draft.payment_type, payment_date = merged_draft.payment_date,
    payment_medium = merged_draft.payment_medium, payment_holder = merged_draft.payment_holder,
    card_expiry = merged_draft.card_expiry, vehicle_category = merged_draft.vehicle_category,
    vehicle_type = merged_draft.vehicle_type, vehicle_brand = merged_draft.vehicle_brand,
    vehicle_model = merged_draft.vehicle_model, vehicle_plate = merged_draft.vehicle_plate,
    vehicle_vin = merged_draft.vehicle_vin, vehicle_color = merged_draft.vehicle_color,
    km_pickup = merged_draft.km_pickup, km_return = merged_draft.km_return, gps_data = merged_draft.gps_data,
    validation_errors = merged_draft.validation_errors, content_hash = merged_draft.content_hash,
    draft_version = merged_draft.draft_version, manual_fields = merged_draft.manual_fields,
    last_prepared_at = merged_draft.last_prepared_at, updated_by = p_actor_id,
    is_complete = merged_draft.is_complete, is_eligible = merged_draft.is_eligible,
    is_officially_clear = merged_draft.is_officially_clear, ready_for_xml = merged_draft.ready_for_xml,
    eligibility_errors = merged_draft.eligibility_errors, eligibility_snapshot = merged_draft.eligibility_snapshot,
    official_check_status = merged_draft.official_check_status,
    last_eligibility_checked_at = merged_draft.last_eligibility_checked_at,
    document_version = merged_draft.document_version,
    planned_pickup_literal = merged_draft.planned_pickup_literal, planned_pickup_at = merged_draft.planned_pickup_at,
    actual_delivery_literal = merged_draft.actual_delivery_literal, actual_delivery_at = merged_draft.actual_delivery_at,
    pickup_at_source = merged_draft.pickup_at_source,
    planned_return_literal = merged_draft.planned_return_literal, planned_return_at = merged_draft.planned_return_at,
    actual_dropoff_literal = merged_draft.actual_dropoff_literal, actual_dropoff_at = merged_draft.actual_dropoff_at,
    return_at_source = merged_draft.return_at_source
  WHERE id = current_draft.id AND organization_id = p_organization_id
  RETURNING * INTO current_draft;

  INSERT INTO public.ses_field_audit_events(
    organization_id, entity_type, entity_id, field_name, source,
    previous_value, new_value, reason, performed_by
  )
  SELECT p_organization_id, 'draft', current_draft.id, field_name, 'rently',
    to_jsonb(before_draft) -> field_name,
    COALESCE(p_applied_changes, '{}'::jsonb) -> field_name,
    'Revisión diaria acreditada por detalle contractual Rently', p_actor_id
  FROM jsonb_object_keys(COALESCE(p_applied_changes, '{}'::jsonb)) AS fields(field_name);

  INSERT INTO public.ses_audit_events(organization_id, entity_type, entity_id, action, changed_fields, metadata, performed_by)
  VALUES (
    p_organization_id, 'draft', current_draft.id, 'daily_review_fields_applied',
    ARRAY(SELECT jsonb_object_keys(COALESCE(p_applied_changes, '{}'::jsonb))),
    jsonb_build_object('conflict_count', p_conflict_count, 'pickup_migration', p_pickup_migration, 'batch_id', p_batch_id),
    p_actor_id
  );
  RETURN QUERY SELECT true, current_draft.id, current_draft.updated_at, current_draft.draft_version;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ses_verified_review_draft(uuid,uuid,uuid,uuid,timestamptz,integer,jsonb,jsonb,integer,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ses_verified_review_draft(uuid,uuid,uuid,uuid,timestamptz,integer,jsonb,jsonb,integer,text,uuid) TO service_role;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ses_review_batches','ses_review_items','ses_review_item_sources',
    'ses_review_evidence_proposals','ses_review_automation_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS set_ses_review_batches_updated_at ON public.ses_review_batches;
CREATE TRIGGER set_ses_review_batches_updated_at BEFORE UPDATE ON public.ses_review_batches
FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS set_ses_review_items_updated_at ON public.ses_review_items;
CREATE TRIGGER set_ses_review_items_updated_at BEFORE UPDATE ON public.ses_review_items
FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS set_ses_review_item_sources_updated_at ON public.ses_review_item_sources;
CREATE TRIGGER set_ses_review_item_sources_updated_at BEFORE UPDATE ON public.ses_review_item_sources
FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS set_ses_review_evidence_proposals_updated_at ON public.ses_review_evidence_proposals;
CREATE TRIGGER set_ses_review_evidence_proposals_updated_at BEFORE UPDATE ON public.ses_review_evidence_proposals
FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
DROP TRIGGER IF EXISTS set_ses_review_automation_settings_updated_at ON public.ses_review_automation_settings;
CREATE TRIGGER set_ses_review_automation_settings_updated_at BEFORE UPDATE ON public.ses_review_automation_settings
FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();

COMMIT;
