\set ON_ERROR_STOP on
SELECT (public.acquire_ses_review_batch_lease(
  '00000000-0000-4000-8000-000000000001', :'batch_id',
  '80000000-0000-4000-8000-000000000002', 110
)).id IS NULL AS correctly_blocked;
