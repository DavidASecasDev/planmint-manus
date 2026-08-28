CREATE TABLE public.ses_fixture_facts (
  fact_key text PRIMARY KEY,
  reference text NOT NULL,
  reservation_id uuid NOT NULL,
  draft_id uuid NOT NULL,
  plate text NOT NULL
);

INSERT INTO public.ses_fixture_facts (fact_key, reference, reservation_id, draft_id, plate) VALUES
  ('accepted_history', '700001', md5('reservation-a-1')::uuid, md5('draft-a-1')::uuid, '0001SYN'),
  ('official_review', '700002', md5('reservation-a-2')::uuid, md5('draft-a-2')::uuid, '0002SYN'),
  ('future_delivery', '700003', md5('reservation-a-3')::uuid, md5('draft-a-3')::uuid, '0003SYN');

INSERT INTO public.organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Organización sintética A'),
  ('00000000-0000-0000-0000-000000000002', 'Organización sintética B');

INSERT INTO public.profiles (id, organization_id, display_name) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Usuario sintético A'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Usuario sintético B');

INSERT INTO public.ses_settings (
  organization_id, lessor_code, establishment_code, government_service_enabled,
  default_payment_type, default_vehicle_type, created_by, updated_by
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'SYNTHETIC-A', NULL, false, NULL, 'TURISMO',
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002', 'SYNTHETIC-B', NULL, false, NULL, 'TURISMO',
   '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');

INSERT INTO public.ses_person_profiles (
  id, organization_id, document_type, document_number, first_name, first_surname,
  country_code, licence_type, licence_valid_until, licence_number, licence_country_code
) VALUES (
  '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'PAS', 'SYNTHETIC-DOC', 'Nombre', 'Sintético', 'ESP', 'B', '2030-01-01', 'SYNTHETIC-LICENCE', 'ESP'
);

INSERT INTO public.ses_locations (
  id, organization_id, normalized_key, name, use_establishment_code,
  address_line, municipality_code, municipality_name, postal_code, country_code, verified
) VALUES (
  '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'synthetic-location', 'Ubicación sintética', false, 'Calle sintética 1', NULL, 'Palma', '07007', 'ESP', true
);

WITH source AS (SELECT generate_series(1, 224) AS n)
INSERT INTO public.reservations (
  id, organization_id, external_reservation_id, estado, auto, es_transferencia, rently_status_code
)
SELECT
  md5('reservation-a-' || n)::uuid,
  '00000000-0000-0000-0000-000000000001',
  CASE WHEN n <= 3 THEN (SELECT reference FROM public.ses_fixture_facts WHERE fact_key =
    CASE n WHEN 1 THEN 'accepted_history' WHEN 2 THEN 'official_review' ELSE 'future_delivery' END)
    ELSE (9000 + n)::text END,
  CASE WHEN n = 3 THEN 'Pendiente' ELSE 'Entregado' END,
  lpad(n::text, 4, '0') || 'SYN', false, CASE WHEN n = 3 THEN 0 ELSE 2 END
FROM source;

WITH source AS (SELECT generate_series(1, 224) AS n)
INSERT INTO public.ses_contract_drafts (
  id, organization_id, reservation_id, external_booking_id, reference, status,
  contract_date, pickup_at, return_at, holder_profile_id, primary_driver_profile_id,
  pickup_location_id, return_location_id, payment_type, vehicle_category, vehicle_type,
  vehicle_brand, vehicle_model, vehicle_plate, vehicle_vin, vehicle_color,
  km_pickup, km_return, validation_errors, content_hash, draft_version
)
SELECT
  md5('draft-a-' || n)::uuid,
  '00000000-0000-0000-0000-000000000001',
  md5('reservation-a-' || n)::uuid,
  CASE WHEN n <= 3 THEN (SELECT reference::bigint FROM public.ses_fixture_facts WHERE fact_key =
    CASE n WHEN 1 THEN 'accepted_history' WHEN 2 THEN 'official_review' ELSE 'future_delivery' END)
    ELSE 9000 + n END,
  CASE WHEN n <= 3 THEN (SELECT reference FROM public.ses_fixture_facts WHERE fact_key =
    CASE n WHEN 1 THEN 'accepted_history' WHEN 2 THEN 'official_review' ELSE 'future_delivery' END)
    ELSE (9000 + n)::text END,
  CASE WHEN n = 1 THEN 'accepted' WHEN n BETWEEN 2 AND 20 THEN 'ready' ELSE 'incomplete' END,
  DATE '2026-08-01',
  CASE WHEN n = 3 THEN TIMESTAMPTZ '2026-12-01 10:00:00+00' ELSE TIMESTAMPTZ '2026-08-01 10:00:00+00' + n * INTERVAL '1 minute' END,
  CASE WHEN n = 3 THEN TIMESTAMPTZ '2026-12-02 10:00:00+00' ELSE TIMESTAMPTZ '2026-08-02 10:00:00+00' + n * INTERVAL '1 minute' END,
  CASE WHEN n = 1 THEN '20000000-0000-0000-0000-000000000001'::uuid END,
  CASE WHEN n = 1 THEN '20000000-0000-0000-0000-000000000001'::uuid END,
  CASE WHEN n = 1 THEN '30000000-0000-0000-0000-000000000001'::uuid END,
  CASE WHEN n = 1 THEN '30000000-0000-0000-0000-000000000001'::uuid END,
  CASE WHEN n <= 20 THEN 'TARJT' END,
  'SYNTHETIC', 'TURISMO', 'TOYOTA', 'Modelo sintético', lpad(n::text, 4, '0') || 'SYN',
  lpad(n::text, 17, 'A'), 'NEGRO', 1000 + n, 1100 + n,
  CASE WHEN n <= 20 THEN '[]'::jsonb ELSE '[{"path":"payment_type","code":"required","message":"Pendiente sintético"}]'::jsonb END,
  encode(digest('draft-' || n, 'sha256'), 'hex'), CASE WHEN n = 1 THEN 7 ELSE 1 END
FROM source;

INSERT INTO public.reservations (
  id, organization_id, external_reservation_id, estado, auto, es_transferencia, rently_status_code
) VALUES (
  '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
  'ORG-B-1', 'Entregado', '0001SYB', false, 2
);

INSERT INTO public.ses_contract_drafts (
  id, organization_id, reservation_id, reference, status, validation_errors, content_hash
) VALUES (
  '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002', 'ORG-B-1', 'incomplete',
  '[{"path":"payment_type","code":"required","message":"Pendiente sintético"}]', 'org-b-hash'
);

INSERT INTO public.ses_batches (
  id, organization_id, status, schema_version, file_name, xml_hash, item_count,
  accepted_count, error_count, generated_by, uploaded_at, result_recorded_at, notes
) VALUES (
  '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'accepted', '1.2.0', 'SES_SYNTHETIC.xml', encode(digest('synthetic-xml', 'sha256'), 'hex'),
  1, 1, 0, '10000000-0000-0000-0000-000000000001', now(), now(),
  'Código oficial de lote: 3d0ccc9e-a184-11f1-80b7-005056957a69'
);

INSERT INTO public.ses_batch_items (
  id, batch_id, draft_id, item_order, draft_version, payload_snapshot,
  result_status, result_code, result_message
)
SELECT
  '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
  fact.draft_id, 1, 7,
  jsonb_build_object('reference', fact.reference, 'contract', jsonb_build_object('synthetic', true),
    'person', jsonb_build_object('synthetic', true), 'location', jsonb_build_object('synthetic', true)),
  'accepted', '80000000-0000-0000-0000-000000000001', NULL
FROM public.ses_fixture_facts fact WHERE fact.fact_key = 'accepted_history';

INSERT INTO public.ses_audit_events (
  organization_id, entity_type, entity_id, action, changed_fields, metadata, performed_by
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'batch', '60000000-0000-0000-0000-000000000001',
  'synthetic_accepted', ARRAY['status'], '{"synthetic":true}', '10000000-0000-0000-0000-000000000001'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = '00000000-0000-0000-0000-000000000001') <> 224
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND status = 'ready') <> 19
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND status = 'incomplete') <> 204
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND status = 'accepted') <> 1 THEN
    RAISE EXCEPTION 'Fixture precondition failed: expected 224/19/204/1';
  END IF;
END;
$$;
