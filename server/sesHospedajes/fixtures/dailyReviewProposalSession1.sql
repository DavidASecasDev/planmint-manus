BEGIN;
SELECT public.claim_ses_review_proposal('00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001');
SELECT pg_sleep(1);
SELECT public.apply_ses_review_proposal_decision(
  '00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',
  'accept','carrera sintética persona','10000000-0000-4000-8000-000000000001','{}'::jsonb,
  '[{"field":"first_name","currentValue":"NOMBRE COMPLETO","proposedValue":"PROPUESTO","source":"hubspot"}]'::jsonb,'[]'::jsonb
);
COMMIT;
