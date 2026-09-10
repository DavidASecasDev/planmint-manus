BEGIN;
SELECT public.claim_ses_review_proposal('00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002');
SELECT public.apply_ses_review_proposal_decision(
  '00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002',
  'accept','carrera sintética lugar','10000000-0000-4000-8000-000000000001','{}'::jsonb,
  '[{"field":"postal_code","currentValue":null,"proposedValue":"07000","source":"document"}]'::jsonb,'[]'::jsonb
);
COMMIT;
