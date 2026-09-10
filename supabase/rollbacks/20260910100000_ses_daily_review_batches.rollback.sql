-- ROLLBACK MANUAL — NO EJECUTAR AUTOMÁTICAMENTE.
-- Revierte únicamente los objetos/columnas creados por
-- 20260910100000_ses_daily_review_batches.sql.
--
-- Debe aplicarse como una NUEVA migración administrativa, nunca borrando el
-- registro histórico de la migración original. Aborta si detecta cualquier
-- dato ya escrito por el módulo para evitar pérdida silenciosa.

BEGIN;

DO $$
DECLARE
  table_name text;
  row_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'rently_booking_events',
    'ses_review_batches',
    'ses_review_items',
    'ses_review_item_sources',
    'ses_review_evidence_proposals',
    'ses_review_automation_settings'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO row_count;
      IF row_count > 0 THEN
        RAISE EXCEPTION 'rollback_aborted_nonempty_table:%:%', table_name, row_count
          USING ERRCODE = '55000';
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.ses_field_audit_events
    WHERE source IN ('hubspot', 'document')
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'rollback_aborted_new_audit_sources_present'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rently_sync_status
    WHERE coverage_version IS NOT NULL
       OR coverage_scope IS DISTINCT FROM '{}'::jsonb
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'rollback_aborted_rently_coverage_present'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE rently_delivery_actual_literal IS NOT NULL
       OR rently_dropoff_actual_literal IS NOT NULL
       OR rently_dropoff_actual_at IS NOT NULL
       OR rently_list_updated_literal IS NOT NULL
       OR rently_list_updated_at IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'rollback_aborted_reservation_event_data_present'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ses_contract_drafts
    WHERE planned_pickup_literal IS NOT NULL
       OR planned_pickup_at IS NOT NULL
       OR actual_delivery_literal IS NOT NULL
       OR actual_delivery_at IS NOT NULL
       OR pickup_at_source IS NOT NULL
       OR planned_return_literal IS NOT NULL
       OR planned_return_at IS NOT NULL
       OR actual_dropoff_literal IS NOT NULL
       OR actual_dropoff_at IS NOT NULL
       OR return_at_source IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'rollback_aborted_ses_review_dates_present'
      USING ERRCODE = '55000';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.apply_ses_verified_review_draft(
  uuid, uuid, uuid, uuid, timestamptz, integer, jsonb, jsonb, integer, text, uuid
);
DROP FUNCTION IF EXISTS public.resolve_ses_review_item_conflict(
  uuid, uuid, text, timestamptz, text, text, uuid
);
DROP FUNCTION IF EXISTS public.apply_ses_review_proposal_decision(
  uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, jsonb
);
DROP FUNCTION IF EXISTS public.claim_ses_review_proposal(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.renew_ses_review_batch_lease(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.acquire_ses_review_batch_lease(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.create_or_resume_ses_review_batch(
  uuid, date, timestamptz, timestamptz, text, text, uuid, date, date, varchar
);

DROP TABLE IF EXISTS public.ses_review_evidence_proposals;
DROP TABLE IF EXISTS public.ses_review_item_sources;
DROP TABLE IF EXISTS public.ses_review_items;
DROP TABLE IF EXISTS public.ses_review_automation_settings;
DROP TABLE IF EXISTS public.ses_review_batches;
DROP TABLE IF EXISTS public.rently_booking_events;

ALTER TABLE public.ses_contract_drafts
  DROP COLUMN IF EXISTS return_at_source,
  DROP COLUMN IF EXISTS actual_dropoff_at,
  DROP COLUMN IF EXISTS actual_dropoff_literal,
  DROP COLUMN IF EXISTS planned_return_at,
  DROP COLUMN IF EXISTS planned_return_literal,
  DROP COLUMN IF EXISTS pickup_at_source,
  DROP COLUMN IF EXISTS actual_delivery_at,
  DROP COLUMN IF EXISTS actual_delivery_literal,
  DROP COLUMN IF EXISTS planned_pickup_at,
  DROP COLUMN IF EXISTS planned_pickup_literal;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS rently_list_updated_at,
  DROP COLUMN IF EXISTS rently_list_updated_literal,
  DROP COLUMN IF EXISTS rently_dropoff_actual_at,
  DROP COLUMN IF EXISTS rently_dropoff_actual_literal,
  DROP COLUMN IF EXISTS rently_delivery_actual_literal;

ALTER TABLE public.rently_sync_status
  DROP COLUMN IF EXISTS coverage_scope,
  DROP COLUMN IF EXISTS coverage_version;

ALTER TABLE public.ses_field_audit_events
  DROP CONSTRAINT IF EXISTS ses_field_audit_source;
ALTER TABLE public.ses_field_audit_events
  ADD CONSTRAINT ses_field_audit_source
  CHECK (source IN ('rently', 'respond', 'manual'));

COMMIT;
