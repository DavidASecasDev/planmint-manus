BEGIN;

CREATE TABLE IF NOT EXISTS public.external_api_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.external_api_keys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  idempotency_key_hash text NOT NULL CHECK (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  transfer_request_id uuid REFERENCES public.transfer_requests(id) ON DELETE SET NULL,
  response_status integer CHECK (response_status BETWEEN 100 AND 599),
  response_body jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  UNIQUE (api_key_id, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS external_api_idempotency_org_created_idx
  ON public.external_api_idempotency (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS external_api_idempotency_expiry_idx
  ON public.external_api_idempotency (expires_at);
CREATE INDEX IF NOT EXISTS external_api_idempotency_transfer_idx
  ON public.external_api_idempotency (transfer_request_id)
  WHERE transfer_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.external_api_rate_limits (
  api_key_id uuid NOT NULL REFERENCES public.external_api_keys(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (api_key_id, bucket_start)
);

CREATE INDEX IF NOT EXISTS external_api_rate_limits_bucket_idx
  ON public.external_api_rate_limits (bucket_start);

CREATE TABLE IF NOT EXISTS public.external_api_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  url text NOT NULL CHECK (url ~ '^https://'),
  events text[] NOT NULL DEFAULT ARRAY['transfer.created', 'transfer.status_changed']::text[],
  encrypted_secret text NOT NULL CHECK (char_length(encrypted_secret) > 20),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  CONSTRAINT external_api_webhooks_events_check CHECK (
    events <@ ARRAY['transfer.created', 'transfer.status_changed', 'transfer.cancelled']::text[]
    AND cardinality(events) > 0
  )
);

CREATE INDEX IF NOT EXISTS external_api_webhooks_org_active_idx
  ON public.external_api_webhooks (organization_id, is_active);
CREATE INDEX IF NOT EXISTS external_api_webhooks_created_by_idx
  ON public.external_api_webhooks (created_by)
  WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.external_api_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.external_api_webhooks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('transfer.created', 'transfer.status_changed', 'transfer.cancelled')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'failed', 'exhausted')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  response_status integer CHECK (response_status BETWEEN 100 AND 599),
  response_excerpt text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (webhook_id, event_id)
);

CREATE INDEX IF NOT EXISTS external_api_webhook_delivery_due_idx
  ON public.external_api_webhook_deliveries (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS external_api_webhook_delivery_org_idx
  ON public.external_api_webhook_deliveries (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_api_webhook_dispatcher_config (
  singleton_key text PRIMARY KEY DEFAULT 'global' CHECK (singleton_key = 'global'),
  schedule_cron_task_uid varchar(65) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.external_api_webhook_dispatcher_config (singleton_key)
VALUES ('global')
ON CONFLICT (singleton_key) DO NOTHING;

ALTER TABLE public.external_api_logs
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS transfer_request_id uuid REFERENCES public.transfer_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key_hash text,
  ADD COLUMN IF NOT EXISTS error_code text;

CREATE INDEX IF NOT EXISTS external_api_logs_correlation_idx
  ON public.external_api_logs (correlation_id);
CREATE INDEX IF NOT EXISTS external_api_logs_transfer_idx
  ON public.external_api_logs (transfer_request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.consume_external_api_rate_limit(
  p_api_key_id uuid,
  p_limit integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_bucket timestamptz := date_trunc('minute', now());
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RETURN false;
  END IF;

  INSERT INTO public.external_api_rate_limits (api_key_id, bucket_start, request_count)
  VALUES (p_api_key_id, v_bucket, 1)
  ON CONFLICT (api_key_id, bucket_start)
  DO UPDATE SET request_count = public.external_api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_external_api_webhook_deliveries(
  p_limit integer DEFAULT 50
) RETURNS SETOF public.external_api_webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT delivery.id
    FROM public.external_api_webhook_deliveries delivery
    WHERE (
      (delivery.status IN ('pending', 'failed') AND delivery.next_attempt_at <= now())
      OR (delivery.status = 'delivering' AND delivery.last_attempt_at < now() - interval '5 minutes')
    )
    ORDER BY delivery.next_attempt_at, delivery.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 50), 100))
  )
  UPDATE public.external_api_webhook_deliveries delivery
  SET status = 'delivering',
      attempt_count = delivery.attempt_count + 1,
      last_attempt_at = now()
  FROM due
  WHERE delivery.id = due.id
  RETURNING delivery.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_external_transfer_v1(
  p_api_key_id uuid,
  p_organization_id uuid,
  p_idempotency_key_hash text,
  p_request_hash text,
  p_payload jsonb,
  p_actor_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.external_api_idempotency%ROWTYPE;
  v_request public.transfer_requests%ROWTYPE;
  v_request_number text;
  v_year integer := extract(year FROM now())::integer;
  v_next_number integer;
  v_item jsonb;
  v_position integer;
  v_item_id uuid;
  v_item_ids uuid[] := ARRAY[]::uuid[];
  v_link_position integer;
  v_items_response jsonb;
  v_response jsonb;
BEGIN
  IF p_idempotency_key_hash !~ '^[a-f0-9]{64}$' OR p_request_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_HASH';
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEMS_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_api_key_id::text || ':' || p_idempotency_key_hash, 0));

  SELECT * INTO v_existing
  FROM public.external_api_idempotency
  WHERE api_key_id = p_api_key_id
    AND idempotency_key_hash = p_idempotency_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'IDEMPOTENCY_CONFLICT';
    END IF;
    IF v_existing.status = 'completed' AND v_existing.response_body IS NOT NULL THEN
      RETURN v_existing.response_body || jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'IDEMPOTENCY_IN_PROGRESS';
  END IF;

  INSERT INTO public.external_api_idempotency (
    api_key_id,
    organization_id,
    idempotency_key_hash,
    request_hash
  ) VALUES (
    p_api_key_id,
    p_organization_id,
    p_idempotency_key_hash,
    p_request_hash
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':transfer:' || v_year::text, 0));

  SELECT coalesce(max(substring(request_number FROM '([0-9]+)$')::integer), 0) + 1
    INTO v_next_number
  FROM public.transfer_requests
  WHERE organization_id = p_organization_id
    AND request_number ~ ('^TRF-' || v_year::text || '-[0-9]+$');

  v_request_number := 'TRF-' || v_year::text || '-' || lpad(v_next_number::text, 4, '0');

  INSERT INTO public.transfer_requests (
    organization_id,
    request_number,
    broker_name,
    client_type,
    client_name,
    client_phone,
    client_email,
    villa_name,
    boat_name,
    berth_number,
    captain_name,
    captain_phone,
    service_type,
    notes,
    client_reference,
    status,
    created_by
  ) VALUES (
    p_organization_id,
    v_request_number,
    left(coalesce(nullif(btrim(p_actor_name), ''), 'API compartida'), 120),
    p_payload->>'client_type',
    btrim(p_payload->>'client_name'),
    nullif(btrim(p_payload->>'client_phone'), ''),
    nullif(btrim(p_payload->>'client_email'), ''),
    nullif(btrim(p_payload->>'villa_name'), ''),
    nullif(btrim(p_payload->>'boat_name'), ''),
    nullif(btrim(p_payload->>'berth_number'), ''),
    nullif(btrim(p_payload->>'captain_name'), ''),
    nullif(btrim(p_payload->>'captain_phone'), ''),
    coalesce(nullif(btrim(p_payload->>'service_type'), ''), 'point_to_point'),
    nullif(btrim(p_payload->>'notes'), ''),
    nullif(btrim(p_payload->>'external_reference'), ''),
    'pendiente',
    NULL
  )
  RETURNING * INTO v_request;

  FOR v_item, v_position IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(p_payload->'items') WITH ORDINALITY
  LOOP
    INSERT INTO public.transfer_items (
      request_id,
      organization_id,
      position,
      direction,
      transfer_date,
      transfer_time,
      pickup_enabled,
      pickup_location,
      pickup_lat,
      pickup_lng,
      pickup_place_id,
      dropoff_enabled,
      dropoff_location,
      dropoff_lat,
      dropoff_lng,
      dropoff_place_id,
      vehicle_type,
      pax_count,
      flight_number,
      notes,
      baby_seats_count,
      baby_seats,
      luggage_count,
      vans_needed,
      status,
      driver_pending
    ) VALUES (
      v_request.id,
      p_organization_id,
      v_position,
      coalesce(nullif(v_item->>'direction', ''), 'ida'),
      (v_item->>'transfer_date')::date,
      (v_item->>'transfer_time')::time,
      true,
      btrim(v_item->>'pickup_location'),
      nullif(v_item->>'pickup_lat', '')::numeric,
      nullif(v_item->>'pickup_lng', '')::numeric,
      nullif(btrim(v_item->>'pickup_place_id'), ''),
      true,
      btrim(v_item->>'dropoff_location'),
      nullif(v_item->>'dropoff_lat', '')::numeric,
      nullif(v_item->>'dropoff_lng', '')::numeric,
      nullif(btrim(v_item->>'dropoff_place_id'), ''),
      v_item->>'vehicle_type',
      (v_item->>'pax_count')::integer,
      nullif(btrim(v_item->>'flight_number'), ''),
      nullif(btrim(v_item->>'notes'), ''),
      coalesce(nullif(v_item->>'baby_seats_count', '')::integer, 0),
      CASE WHEN jsonb_typeof(v_item->'baby_seats') = 'array' THEN v_item->'baby_seats' ELSE '[]'::jsonb END,
      coalesce(nullif(v_item->>'luggage_count', '')::integer, 0),
      coalesce(nullif(v_item->>'vans_needed', '')::integer, 1),
      'pendiente',
      true
    )
    RETURNING id INTO v_item_id;

    v_item_ids := array_append(v_item_ids, v_item_id);
  END LOOP;

  FOR v_item, v_position IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(p_payload->'items') WITH ORDINALITY
  LOOP
    v_link_position := nullif(v_item->>'linked_item_position', '')::integer;
    IF v_link_position IS NOT NULL
       AND v_link_position BETWEEN 1 AND array_length(v_item_ids, 1)
       AND v_link_position <> v_position THEN
      UPDATE public.transfer_items
      SET linked_item_id = v_item_ids[v_link_position]
      WHERE id = v_item_ids[v_position];
    END IF;
  END LOOP;

  INSERT INTO public.transfer_status_history (
    request_id,
    organization_id,
    previous_status,
    new_status,
    changed_by_type,
    changed_by_name,
    note
  ) VALUES (
    v_request.id,
    p_organization_id,
    NULL,
    'pendiente',
    'api',
    left(coalesce(nullif(btrim(p_actor_name), ''), 'API compartida'), 120),
    'Solicitud creada mediante API externa v1'
  );

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ti.id,
    'position', ti.position,
    'direction', ti.direction,
    'transfer_date', ti.transfer_date,
    'transfer_time', ti.transfer_time,
    'pickup_location', ti.pickup_location,
    'dropoff_location', ti.dropoff_location,
    'vehicle_type', ti.vehicle_type,
    'pax_count', ti.pax_count,
    'luggage_count', ti.luggage_count,
    'vans_needed', ti.vans_needed,
    'linked_item_id', ti.linked_item_id
  ) ORDER BY ti.position), '[]'::jsonb)
  INTO v_items_response
  FROM public.transfer_items ti
  WHERE ti.request_id = v_request.id;

  v_response := jsonb_build_object(
    'id', v_request.id,
    'request_number', v_request.request_number,
    'status', v_request.status,
    'created_at', v_request.created_at,
    'items_count', jsonb_array_length(v_items_response),
    'items', v_items_response,
    'replayed', false
  );

  UPDATE public.external_api_idempotency
  SET transfer_request_id = v_request.id,
      response_status = 201,
      response_body = v_response,
      status = 'completed'
  WHERE api_key_id = p_api_key_id
    AND idempotency_key_hash = p_idempotency_key_hash;

  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_external_transfer_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_event_type text;
  v_previous_status text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'transfer.created';
    v_previous_status := NULL;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := CASE WHEN NEW.status = 'cancelado' THEN 'transfer.cancelled' ELSE 'transfer.status_changed' END;
    v_previous_status := OLD.status;
  ELSE
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event_id', v_event_id,
    'type', v_event_type,
    'occurred_at', now(),
    'data', jsonb_build_object(
      'transfer_id', NEW.id,
      'request_number', NEW.request_number,
      'status', NEW.status,
      'previous_status', v_previous_status,
      'updated_at', NEW.updated_at
    )
  );

  INSERT INTO public.external_api_webhook_deliveries (
    webhook_id,
    organization_id,
    event_id,
    event_type,
    payload
  )
  SELECT
    webhook.id,
    NEW.organization_id,
    v_event_id,
    v_event_type,
    v_payload
  FROM public.external_api_webhooks webhook
  WHERE webhook.organization_id = NEW.organization_id
    AND webhook.is_active = true
    AND v_event_type = ANY(webhook.events)
  ON CONFLICT (webhook_id, event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_external_transfer_v1(
  p_organization_id uuid,
  p_transfer_request_id uuid,
  p_actor_name text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.transfer_requests%ROWTYPE;
  v_previous_status text;
  v_cancelled_at timestamptz := now();
BEGIN
  SELECT * INTO v_request
  FROM public.transfer_requests
  WHERE id = p_transfer_request_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'TRANSFER_NOT_FOUND';
  END IF;

  IF v_request.status = 'cancelado' THEN
    RETURN jsonb_build_object(
      'id', v_request.id,
      'request_number', v_request.request_number,
      'previous_status', v_request.status,
      'new_status', v_request.status,
      'cancelled_at', v_request.updated_at,
      'replayed', true
    );
  END IF;

  IF v_request.status NOT IN ('pendiente', 'aceptado') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'CANCELLATION_NOT_ALLOWED';
  END IF;

  v_previous_status := v_request.status;

  UPDATE public.transfer_requests
  SET status = 'cancelado',
      rejection_reason = left(btrim(p_reason), 500),
      updated_at = v_cancelled_at
  WHERE id = v_request.id;

  UPDATE public.transfer_items
  SET status = 'cancelado'
  WHERE request_id = v_request.id
    AND status IN ('pendiente', 'aceptado');

  INSERT INTO public.transfer_status_history (
    request_id,
    organization_id,
    previous_status,
    new_status,
    changed_by_type,
    changed_by_name,
    note
  ) VALUES (
    v_request.id,
    p_organization_id,
    v_previous_status,
    'cancelado',
    'api',
    left(coalesce(nullif(btrim(p_actor_name), ''), 'API compartida'), 120),
    left(btrim(p_reason), 500)
  );

  RETURN jsonb_build_object(
    'id', v_request.id,
    'request_number', v_request.request_number,
    'previous_status', v_previous_status,
    'new_status', 'cancelado',
    'cancelled_at', v_cancelled_at,
    'replayed', false
  );
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'enqueue_external_transfer_webhooks_trigger'
      AND tgrelid = 'public.transfer_requests'::regclass
  ) THEN
    CREATE TRIGGER enqueue_external_transfer_webhooks_trigger
      AFTER INSERT OR UPDATE OF status ON public.transfer_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.enqueue_external_transfer_webhooks();
  END IF;
END;
$$;

ALTER TABLE public.external_api_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_idempotency FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_rate_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_webhooks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_webhook_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_webhook_dispatcher_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_api_webhook_dispatcher_config FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.external_api_idempotency FROM anon, authenticated;
REVOKE ALL ON public.external_api_rate_limits FROM anon, authenticated;
REVOKE ALL ON public.external_api_webhooks FROM anon, authenticated;
REVOKE ALL ON public.external_api_webhook_deliveries FROM anon, authenticated;
REVOKE ALL ON public.external_api_webhook_dispatcher_config FROM anon, authenticated;
GRANT ALL ON public.external_api_idempotency TO service_role;
GRANT ALL ON public.external_api_rate_limits TO service_role;
GRANT ALL ON public.external_api_webhooks TO service_role;
GRANT ALL ON public.external_api_webhook_deliveries TO service_role;
GRANT ALL ON public.external_api_webhook_dispatcher_config TO service_role;

REVOKE ALL ON FUNCTION public.consume_external_api_rate_limit(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_external_api_webhook_deliveries(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_external_transfer_v1(uuid, uuid, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_external_transfer_v1(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_external_transfer_webhooks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_external_api_rate_limit(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_external_api_webhook_deliveries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_external_transfer_v1(uuid, uuid, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_external_transfer_v1(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_external_transfer_webhooks() TO service_role;

COMMIT;
