DO $$
DECLARE
  org_a uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a) <> 224 THEN
    RAISE EXCEPTION 'Expected 224 preserved drafts';
  END IF;
  IF (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'ready') <> 18
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'incomplete') <> 204
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'accepted') <> 1
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'needs_revision') <> 1 THEN
    RAISE EXCEPTION 'Unexpected post-migration status distribution';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ses_contract_drafts
    WHERE organization_id = org_a AND reference = '4942' AND status = 'accepted'
      AND is_officially_clear = true AND ready_for_xml = false
  ) THEN RAISE EXCEPTION '4942 was not preserved as accepted and non-exportable'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ses_batches
    WHERE organization_id = org_a AND status = 'accepted'
      AND official_lot_code = '3d0ccc9e-a184-11f1-80b7-005056957a69'
  ) THEN RAISE EXCEPTION 'Historical accepted batch/lot was not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ses_contract_drafts
    WHERE organization_id = org_a AND reference = '5164' AND status = 'needs_revision'
      AND legacy_review_reason = 'already_communicated' AND ready_for_xml = false
  ) THEN RAISE EXCEPTION '5164 is not protected'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ses_contract_drafts
    WHERE organization_id = org_a AND reference = '5343'
      AND legacy_review_reason = 'future_delivery' AND ready_for_xml = false
  ) THEN RAISE EXCEPTION '5343 is not excluded'; END IF;
  IF (SELECT count(*) FROM public.ses_settings WHERE organization_id = org_a AND lessor_code = '0000065825') <> 1 THEN
    RAISE EXCEPTION 'Historical SES settings were not preserved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ses_settings WHERE organization_id = org_a
      AND (official_xsd_hash IS NOT NULL OR official_xsd_version IS NOT NULL OR official_xsd_storage_key IS NOT NULL)
  ) THEN RAISE EXCEPTION 'The migration must not invent an official XSD'; END IF;
  IF (SELECT count(*) FROM public.ses_batch_items) <> 1
     OR (SELECT count(*) FROM public.ses_historical_snapshots) <> 1
     OR (SELECT count(*) FROM public.ses_official_communications WHERE organization_id = org_a AND status = 'accepted') <> 1 THEN
    RAISE EXCEPTION 'Historical item, snapshot or official inventory was not preserved exactly once';
  END IF;
  IF (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = '00000000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'Second organization was changed';
  END IF;
END;
$$;
