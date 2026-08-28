DO $$
DECLARE
  org_a uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a) <> 224
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'ready') <> 19
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'incomplete') <> 204
     OR (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = org_a AND status = 'accepted') <> 1 THEN
    RAISE EXCEPTION 'Expected preserved 224/19/204/1 distribution';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ses_contract_drafts WHERE ready_for_xml = true) THEN
    RAISE EXCEPTION 'A legacy draft became exportable without revalidation';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ses_fixture_facts fact
    JOIN public.ses_contract_drafts draft ON draft.id = fact.draft_id
    JOIN public.ses_batch_items item ON item.draft_id = draft.id
    JOIN public.ses_batches batch ON batch.id = item.batch_id
    JOIN public.ses_official_communications official
      ON official.organization_id = draft.organization_id
     AND official.official_communication_code = item.official_communication_code
     AND official.reference = draft.reference
     AND official.contract_date = draft.contract_date
     AND official.normalized_plate = regexp_replace(upper(draft.vehicle_plate), '[^A-Z0-9]', '', 'g')
     AND official.status = 'accepted'
    WHERE fact.fact_key = 'accepted_history'
      AND draft.status = 'accepted' AND draft.ready_for_xml = false
      AND batch.status = 'accepted'
      AND batch.official_lot_code = '3d0ccc9e-a184-11f1-80b7-005056957a69'
  ) THEN RAISE EXCEPTION 'Accepted historical identity was not preserved generically'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ses_contract_drafts
    WHERE organization_id = org_a AND status <> 'accepted'
      AND (eligibility_snapshot->>'revalidated')::boolean IS DISTINCT FROM false
  ) THEN RAISE EXCEPTION 'A legacy draft was marked revalidated without current facts'; END IF;
  IF (SELECT count(*) FROM public.ses_settings WHERE organization_id = org_a) <> 1 THEN
    RAISE EXCEPTION 'Historical SES settings were not preserved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ses_settings WHERE organization_id = org_a
      AND (official_xsd_hash IS NOT NULL OR official_xsd_version IS NOT NULL OR official_xsd_storage_key IS NOT NULL)
  ) THEN RAISE EXCEPTION 'The migration must not invent an official XSD'; END IF;
  IF (SELECT count(*) FROM public.ses_batch_items) <> 1
     OR (SELECT count(*) FROM public.ses_historical_snapshots) <> 1
     OR (SELECT count(*) FROM public.ses_official_communications WHERE organization_id = org_a AND status = 'accepted') <> 1
     OR (SELECT count(*) FROM public.ses_audit_events WHERE organization_id = org_a) <> 1 THEN
    RAISE EXCEPTION 'Historical item, snapshot, inventory or audit was not preserved exactly once';
  END IF;
  IF (SELECT count(*) FROM public.ses_contract_drafts WHERE organization_id = '00000000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'Second organization was changed';
  END IF;
END;
$$;
