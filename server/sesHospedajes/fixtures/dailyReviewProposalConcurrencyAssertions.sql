DO $$
DECLARE conflict_count integer;
BEGIN
  SELECT jsonb_array_length(conflicts) INTO conflict_count FROM public.ses_review_items WHERE external_booking_id=5582;
  IF conflict_count <> 3 THEN RAISE EXCEPTION 'concurrent proposal conflicts were lost: %', conflict_count; END IF;
  IF EXISTS(SELECT 1 FROM public.ses_review_evidence_proposals WHERE id IN ('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002') AND status <> 'accepted') THEN
    RAISE EXCEPTION 'concurrent proposal was not accepted';
  END IF;
END $$;
SELECT 'proposal_concurrency_ok' AS result;
