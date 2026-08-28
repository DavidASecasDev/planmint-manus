BEGIN;

-- Propuesta SES.HOSPEDAJES. NO ejecutada por Manus.
-- Solo añade almacenamiento para excepciones manuales temporales y auditables.
-- No modifica, reclasifica ni elimina borradores, lotes, comunicaciones, snapshots o auditorías existentes.

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL
    OR to_regclass('public.profiles') IS NULL
    OR to_regclass('public.reservations') IS NULL
    OR to_regclass('public.ses_contract_drafts') IS NULL
    OR to_regclass('public.ses_audit_events') IS NULL
    OR to_regprocedure('public.ses_set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Precondición fallida: falta una tabla histórica requerida por SES.HOSPEDAJES';
  END IF;
END;
$$;

SELECT set_config('ses.exact_reconciliation_precheck', json_build_object(
  'draft_count', (SELECT count(*) FROM public.ses_contract_drafts),
  'batch_count', (SELECT count(*) FROM public.ses_batches),
  'batch_item_count', (SELECT count(*) FROM public.ses_batch_items),
  'settings_count', (SELECT count(*) FROM public.ses_settings),
  'audit_count', (SELECT count(*) FROM public.ses_audit_events),
  'official_communication_count', (SELECT count(*) FROM public.ses_official_communications),
  'snapshot_count', (SELECT count(*) FROM public.ses_historical_snapshots)
)::text, true);

CREATE TABLE IF NOT EXISTS public.ses_eligibility_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.ses_contract_drafts(id) ON DELETE RESTRICT,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'terminated_not_reported',
  protocol_reference text NOT NULL,
  reason text NOT NULL,
  approved_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ses_eligibility_exceptions_kind_check CHECK (kind = 'terminated_not_reported'),
  CONSTRAINT ses_eligibility_exceptions_protocol_check CHECK (char_length(btrim(protocol_reference)) BETWEEN 3 AND 120),
  CONSTRAINT ses_eligibility_exceptions_reason_check CHECK (char_length(btrim(reason)) BETWEEN 10 AND 1000),
  CONSTRAINT ses_eligibility_exceptions_expiry_check CHECK (expires_at > approved_at),
  CONSTRAINT ses_eligibility_exceptions_revocation_check CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR
    (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND char_length(btrim(revocation_reason)) BETWEEN 10 AND 1000)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ses_eligibility_exceptions_unrevoked_draft
  ON public.ses_eligibility_exceptions(organization_id, draft_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ses_eligibility_exceptions_reservation
  ON public.ses_eligibility_exceptions(organization_id, reservation_id, approved_at DESC);

CREATE INDEX IF NOT EXISTS idx_ses_eligibility_exceptions_expiry
  ON public.ses_eligibility_exceptions(organization_id, expires_at)
  WHERE revoked_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.ses_eligibility_exceptions'::regclass
      AND tgname = 'trg_ses_eligibility_exceptions_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_ses_eligibility_exceptions_updated_at
      BEFORE UPDATE ON public.ses_eligibility_exceptions
      FOR EACH ROW EXECUTE FUNCTION public.ses_set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.ses_eligibility_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ses_eligibility_exceptions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ses_eligibility_exceptions FROM anon, authenticated;
GRANT ALL ON TABLE public.ses_eligibility_exceptions TO service_role;

COMMENT ON TABLE public.ses_eligibility_exceptions IS
  'Excepciones SES temporales, auditables y revocables para reservas terminadas no comunicadas; no omiten el resto de puertas.';
COMMENT ON COLUMN public.ses_eligibility_exceptions.protocol_reference IS
  'Referencia verificable del protocolo o incidencia que justifica la excepción.';

DO $$
DECLARE
  before_state jsonb;
BEGIN
  before_state := current_setting('ses.exact_reconciliation_precheck')::jsonb;
  IF (before_state->>'draft_count')::bigint <> (SELECT count(*) FROM public.ses_contract_drafts)
    OR (before_state->>'batch_count')::bigint <> (SELECT count(*) FROM public.ses_batches)
    OR (before_state->>'batch_item_count')::bigint <> (SELECT count(*) FROM public.ses_batch_items)
    OR (before_state->>'settings_count')::bigint <> (SELECT count(*) FROM public.ses_settings)
    OR (before_state->>'audit_count')::bigint <> (SELECT count(*) FROM public.ses_audit_events)
    OR (before_state->>'official_communication_count')::bigint <> (SELECT count(*) FROM public.ses_official_communications)
    OR (before_state->>'snapshot_count')::bigint <> (SELECT count(*) FROM public.ses_historical_snapshots) THEN
    RAISE EXCEPTION 'Postcondición fallida: cambió el número de filas de una tabla SES histórica';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ses_eligibility_exceptions' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Postcondición fallida: RLS no está activo en ses_eligibility_exceptions';
  END IF;
END;
$$;

COMMIT;
