\set ON_ERROR_STOP on
DO $$
DECLARE
  b1 public.ses_review_batches;
  b1_repeat public.ses_review_batches;
  b2 public.ses_review_batches;
  overlap public.ses_review_batches;
  claimed public.ses_review_batches;
  proposal public.ses_review_evidence_proposals;
  proposal_id uuid;
  item_id uuid;
  cas_applied boolean;
  current_updated_at timestamptz;
  current_version integer;
  rejected_unlinked boolean := false;
  conflict_resolved boolean;
  conflict_ready boolean;
  conflict_open_count integer;
  item_updated_at timestamptz;
BEGIN
  b1 := public.create_or_resume_ses_review_batch(
    '00000000-0000-4000-8000-000000000001','2026-09-09','2026-09-08 22:00+00','2026-09-09 22:00+00',
    'daily','manual','10000000-0000-4000-8000-000000000001',NULL,NULL,NULL
  );
  UPDATE public.ses_review_batches SET status='completed',gmail_draft_reference='draft-synthetic' WHERE id=b1.id;
  b1_repeat := public.create_or_resume_ses_review_batch(
    '00000000-0000-4000-8000-000000000001','2026-09-09','2026-09-08 22:00+00','2026-09-09 22:00+00',
    'daily','manual','10000000-0000-4000-8000-000000000001',NULL,NULL,NULL
  );
  IF b1_repeat.id <> b1.id OR b1_repeat.gmail_draft_reference <> 'draft-synthetic' THEN RAISE EXCEPTION 'completed batch was not reused'; END IF;
  UPDATE public.ses_review_batches SET status='partial' WHERE id=b1.id;

  b2 := public.create_or_resume_ses_review_batch(
    '00000000-0000-4000-8000-000000000002','2026-09-09','2026-09-08 22:00+00','2026-09-09 22:00+00',
    'daily','manual',NULL,NULL,NULL,NULL
  );
  overlap := public.create_or_resume_ses_review_batch(
    '00000000-0000-4000-8000-000000000001','2026-09-08','2026-09-08 00:00+00','2026-09-09 00:00+00',
    'historical','historical','10000000-0000-4000-8000-000000000001','2026-09-08','2026-09-08',NULL
  );
  claimed := public.acquire_ses_review_batch_lease('00000000-0000-4000-8000-000000000001',b1.id,'60000000-0000-4000-8000-000000000001',110);
  IF claimed.id IS NULL THEN RAISE EXCEPTION 'first lease not acquired'; END IF;
  IF NOT public.renew_ses_review_batch_lease('00000000-0000-4000-8000-000000000001',b1.id,'60000000-0000-4000-8000-000000000001',110) THEN RAISE EXCEPTION 'lease not renewed'; END IF;
  IF public.renew_ses_review_batch_lease('00000000-0000-4000-8000-000000000001',b1.id,'60000000-0000-4000-8000-000000000099',110) THEN RAISE EXCEPTION 'wrong token renewed lease'; END IF;
  IF (public.acquire_ses_review_batch_lease('00000000-0000-4000-8000-000000000001',overlap.id,'60000000-0000-4000-8000-000000000002',110)).id IS NOT NULL THEN RAISE EXCEPTION 'overlapping org lease was acquired'; END IF;
  IF (public.acquire_ses_review_batch_lease('00000000-0000-4000-8000-000000000002',b2.id,'60000000-0000-4000-8000-000000000003',110)).id IS NULL THEN RAISE EXCEPTION 'second organization was blocked'; END IF;
  UPDATE public.ses_review_batches SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=b1.id;
  IF (public.acquire_ses_review_batch_lease('00000000-0000-4000-8000-000000000001',b1.id,'60000000-0000-4000-8000-000000000004',110)).id IS NULL THEN RAISE EXCEPTION 'expired lease was not reclaimed'; END IF;

  INSERT INTO public.ses_review_items(
    organization_id,batch_id,external_booking_id,reservation_id,draft_id,status,
    planned_from_literal,planned_from_at,delivery_actual_literal,delivery_actual_at,
    dropoff_actual_literal,dropoff_actual_at,evidence_reference,evidence_generated_literal,evidence_generated_at
  ) VALUES (
    '00000000-0000-4000-8000-000000000001',b1.id,5582,
    '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','verified_delivery',
    '2026-09-10T10:00:00','2026-09-10 08:00:00+00','2026-09-09T23:05:19.643','2026-09-09 21:05:19.643+00',
    '2026-09-10T18:00:00','2026-09-10 16:00:00+00','Delivery 5582.pdf','2026-09-09T23:05:19','2026-09-09 21:05:19+00'
  ) RETURNING id INTO item_id;
  INSERT INTO public.rently_booking_events(
    organization_id,external_booking_id,reservation_id,current_status,updated_literal,updated_at,
    planned_from_literal,planned_from_at,planned_to_literal,planned_to_at,
    delivery_actual_literal,delivery_actual_at,dropoff_actual_literal,dropoff_actual_at,raw_event_fields
  ) VALUES
    ('00000000-0000-4000-8000-000000000001',5578,NULL,2,'2026-09-09T17:56:39.05','2026-09-09 15:56:39.05+00',
      '2026-09-09T18:00:00','2026-09-09 16:00:00+00','2026-09-10T10:00:00','2026-09-10 08:00:00+00',
      '2026-09-09T17:56:39.05','2026-09-09 15:56:39.05+00',NULL,NULL,'{"CurrentStatus":2}'::jsonb),
    ('00000000-0000-4000-8000-000000000001',5582,'20000000-0000-4000-8000-000000000001',3,'2026-09-10T17:30:11.73','2026-09-10 15:30:11.73+00',
      '2026-09-10T10:00:00','2026-09-10 08:00:00+00','2026-09-10T18:00:00','2026-09-10 16:00:00+00',
      '2026-09-09T23:05:19.643','2026-09-09 21:05:19.643+00','2026-09-10T17:30:11.73','2026-09-10 15:30:11.73+00','{"CurrentStatus":3}'::jsonb);
  INSERT INTO public.ses_review_evidence_proposals(
    organization_id,batch_id,item_id,source,external_submission_id,request_hash,payload,
    target_type,target_id,target_updated_at,submitted_by
  ) SELECT
    '00000000-0000-4000-8000-000000000001',b1.id,item_id,'hubspot','synthetic-5582','hash-1',
    '{"address_line":"CALLE SINTÉTICA","postal_code":"07000","licence_valid_until":"2030-01-01"}'::jsonb,
    'person',id,updated_at,'10000000-0000-4000-8000-000000000001'
  FROM public.ses_person_profiles WHERE id='30000000-0000-4000-8000-000000000001'
  RETURNING id INTO proposal_id;
  proposal := public.claim_ses_review_proposal('00000000-0000-4000-8000-000000000001',proposal_id,'70000000-0000-4000-8000-000000000001');
  proposal := public.apply_ses_review_proposal_decision(
    '00000000-0000-4000-8000-000000000001',proposal_id,'70000000-0000-4000-8000-000000000001','accept',
    'Acreditación sintética revisada','10000000-0000-4000-8000-000000000001',
    '{"address_line":"CALLE SINTÉTICA","postal_code":"07000","licence_valid_until":"2030-01-01"}'::jsonb,
    '[{"conflictKey":"fixture-licence-5582","status":"open","field":"licence_number","currentValue":"P123456A","proposedValue":"LIC-9000","source":"hubspot","targetType":"person","targetId":"30000000-0000-4000-8000-000000000001"}]'::jsonb,
    '[]'::jsonb
  );
  IF proposal.status <> 'accepted' THEN RAISE EXCEPTION 'proposal not accepted'; END IF;

  UPDATE public.ses_contract_drafts SET manual_fields=ARRAY['return_at'],return_at='2026-09-10 18:00:00+00'
  WHERE id='50000000-0000-4000-8000-000000000001';
  SELECT applied INTO cas_applied FROM public.apply_ses_verified_review_draft(
    '00000000-0000-4000-8000-000000000001',b1.id,'60000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000001','2000-01-01 00:00:00+00',1,
    '{"return_at":"2026-09-10T16:00:00Z","manual_fields":[]}'::jsonb,
    '{"return_at":"2026-09-10T16:00:00Z"}'::jsonb,0,'unchanged','10000000-0000-4000-8000-000000000001'
  );
  IF cas_applied THEN RAISE EXCEPTION 'stale CAS overwrote a concurrent manual edit'; END IF;
  IF (SELECT return_at FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001') <> '2026-09-10 18:00:00+00' THEN RAISE EXCEPTION 'manual return edit was lost'; END IF;
  SELECT updated_at,draft_version INTO current_updated_at,current_version
  FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001';
  SELECT applied INTO cas_applied FROM public.apply_ses_verified_review_draft(
    '00000000-0000-4000-8000-000000000001',b1.id,'60000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000001',current_updated_at,current_version,
    jsonb_build_object('vehicle_brand','MARCA SINTÉTICA','draft_version',current_version+1),
    '{"vehicle_brand":"MARCA SINTÉTICA"}'::jsonb,1,'conflict','10000000-0000-4000-8000-000000000001'
  );
  IF NOT cas_applied THEN RAISE EXCEPTION 'current CAS was not applied'; END IF;
  IF (SELECT vehicle_brand FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001') <> 'MARCA SINTÉTICA' THEN RAISE EXCEPTION 'CAS value missing'; END IF;

  INSERT INTO public.ses_review_evidence_proposals(
    id,organization_id,batch_id,item_id,source,external_submission_id,request_hash,payload,target_type,target_id,target_updated_at,submitted_by
  ) SELECT '71000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',b1.id,item_id,
    'hubspot','concurrent-person','hash-concurrent-person','{"first_name":"PROPUESTO"}'::jsonb,'person',id,updated_at,
    '10000000-0000-4000-8000-000000000001' FROM public.ses_person_profiles WHERE id='30000000-0000-4000-8000-000000000001';
  INSERT INTO public.ses_review_evidence_proposals(
    id,organization_id,batch_id,item_id,source,external_submission_id,request_hash,payload,target_type,target_id,target_updated_at,submitted_by
  ) SELECT '71000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',b1.id,item_id,
    'document','concurrent-location','hash-concurrent-location','{"postal_code":"07000"}'::jsonb,'pickup_location',id,updated_at,
    '10000000-0000-4000-8000-000000000001' FROM public.ses_locations WHERE id='40000000-0000-4000-8000-000000000001';
  INSERT INTO public.ses_review_evidence_proposals(
    id,organization_id,batch_id,item_id,source,external_submission_id,request_hash,payload,target_type,target_id,target_updated_at,submitted_by
  ) SELECT '71000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',b1.id,item_id,
    'document','unlinked-null-location','hash-unlinked-null','{"postal_code":"07000"}'::jsonb,'pickup_location',id,updated_at,
    '10000000-0000-4000-8000-000000000001' FROM public.ses_locations WHERE id='40000000-0000-4000-8000-000000000001';
  UPDATE public.ses_contract_drafts SET pickup_location_id=NULL WHERE id='50000000-0000-4000-8000-000000000001';
  PERFORM public.claim_ses_review_proposal(
    '00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000003'
  );
  BEGIN
    PERFORM public.apply_ses_review_proposal_decision(
      '00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000003',
      'accept','debe rechazarse','10000000-0000-4000-8000-000000000001','{}'::jsonb,'[]'::jsonb,'[]'::jsonb
    );
  EXCEPTION WHEN others THEN rejected_unlinked := true;
  END;
  IF NOT rejected_unlinked THEN RAISE EXCEPTION 'NULL-safe unlinked location was accepted'; END IF;
  UPDATE public.ses_contract_drafts SET pickup_location_id='40000000-0000-4000-8000-000000000001'
  WHERE id='50000000-0000-4000-8000-000000000001';

  UPDATE public.ses_person_profiles SET
    licence_number='LIC-9000',
    manual_fields=ARRAY(SELECT DISTINCT value FROM unnest(manual_fields || ARRAY['licence_number']) AS fields(value))
  WHERE id='30000000-0000-4000-8000-000000000001';
  SELECT updated_at INTO item_updated_at FROM public.ses_review_items WHERE id=item_id;
  SELECT resolved,ready_for_xml,open_conflict_count
    INTO conflict_resolved,conflict_ready,conflict_open_count
  FROM public.resolve_ses_review_item_conflict(
    '00000000-0000-4000-8000-000000000001',item_id,'fixture-licence-5582',item_updated_at,
    'Permiso corregido y revisado','HS-1','10000000-0000-4000-8000-000000000001'
  );
  IF NOT conflict_resolved OR NOT conflict_ready OR conflict_open_count <> 0 THEN
    RAISE EXCEPTION 'corrected conflict did not resolve and recalculate ready';
  END IF;
  INSERT INTO public.ses_review_evidence_proposals(
    id,organization_id,batch_id,item_id,source,external_submission_id,request_hash,payload,
    target_type,target_id,target_updated_at,submitted_by
  ) SELECT
    '71000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',b1.id,item_id,
    'hubspot','same-evidence-after-resolution','hash-same-evidence','{}'::jsonb,
    'draft',id,updated_at,'10000000-0000-4000-8000-000000000001'
  FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001';
  PERFORM public.claim_ses_review_proposal(
    '00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000004'
  );
  PERFORM public.apply_ses_review_proposal_decision(
    '00000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000004',
    'accept','Reanudación de la misma evidencia','10000000-0000-4000-8000-000000000001','{}'::jsonb,
    '[{"conflictKey":"fixture-licence-5582","status":"open","field":"licence_number","currentValue":"P123456A","proposedValue":"LIC-9000","source":"hubspot","targetType":"person","targetId":"30000000-0000-4000-8000-000000000001"}]'::jsonb,
    '[]'::jsonb
  );
  IF EXISTS (
    SELECT 1 FROM public.ses_review_items,
      LATERAL jsonb_array_elements(conflicts) conflict
    WHERE id=item_id AND COALESCE(conflict->>'status','open') <> 'resolved'
  ) THEN RAISE EXCEPTION 'resolved conflict was resurrected without new evidence'; END IF;
  IF NOT (SELECT ready_for_xml FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'same evidence blocked ready draft again';
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT address_line FROM public.ses_person_profiles WHERE id='30000000-0000-4000-8000-000000000001') <> 'CALLE SINTÉTICA' THEN RAISE EXCEPTION 'person address not applied'; END IF;
  IF (SELECT licence_number FROM public.ses_person_profiles WHERE id='30000000-0000-4000-8000-000000000001') <> 'LIC-9000' THEN RAISE EXCEPTION 'manual licence correction missing'; END IF;
  IF (SELECT count(*) FROM public.ses_field_audit_events WHERE entity_id='30000000-0000-4000-8000-000000000001') <> 3 THEN RAISE EXCEPTION 'person field audit rows missing'; END IF;
  IF (SELECT count(*) FROM public.ses_field_audit_events WHERE entity_id='50000000-0000-4000-8000-000000000001' AND field_name='vehicle_brand') <> 1 THEN RAISE EXCEPTION 'draft CAS audit row missing'; END IF;
  IF (SELECT jsonb_array_length(conflicts) FROM public.ses_review_items WHERE external_booking_id=5582) <> 1 THEN RAISE EXCEPTION 'resolved conflict history was deleted'; END IF;
  IF (SELECT conflicts->0->>'status' FROM public.ses_review_items WHERE external_booking_id=5582) <> 'resolved' THEN RAISE EXCEPTION 'conflict did not remain resolved'; END IF;
  IF NOT (SELECT ready_for_xml FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'draft did not become ready after resolution'; END IF;
  IF (SELECT status FROM public.ses_contract_drafts WHERE id='50000000-0000-4000-8000-000000000001') <> 'ready' THEN RAISE EXCEPTION 'draft status not recalculated'; END IF;
  IF (SELECT count(*) FROM public.ses_audit_events WHERE entity_type='review_item' AND action='review_conflict_resolved') <> 1 THEN RAISE EXCEPTION 'resolution audit missing'; END IF;
  IF (SELECT delivery_actual_literal FROM public.ses_review_items WHERE external_booking_id=5582) <> '2026-09-09T23:05:19.643' THEN RAISE EXCEPTION '5582 literal changed'; END IF;
  IF to_char((SELECT delivery_actual_at FROM public.ses_review_items WHERE external_booking_id=5582) AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD HH24:MI:SS.MS') <> '2026-09-09 23:05:19.643' THEN RAISE EXCEPTION '5582 Madrid roundtrip shifted'; END IF;
  IF (SELECT count(*) FROM public.rently_booking_events WHERE organization_id='00000000-0000-4000-8000-000000000001') <> 2 THEN RAISE EXCEPTION 'Rently list events missing'; END IF;
  IF (SELECT delivery_actual_literal FROM public.rently_booking_events WHERE external_booking_id=5582) <> '2026-09-09T23:05:19.643' THEN RAISE EXCEPTION '5582 event literal changed'; END IF;
  IF (SELECT dropoff_actual_literal FROM public.rently_booking_events WHERE external_booking_id=5582) <> '2026-09-10T17:30:11.73' THEN RAISE EXCEPTION '5582 dropoff event literal changed'; END IF;
  IF to_char((SELECT dropoff_actual_at FROM public.rently_booking_events WHERE external_booking_id=5582) AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD HH24:MI:SS.MS') <> '2026-09-10 17:30:11.730' THEN RAISE EXCEPTION '5582 dropoff Madrid roundtrip shifted'; END IF;
  IF has_table_privilege('authenticated','public.ses_review_batches','SELECT') THEN RAISE EXCEPTION 'authenticated retained review access'; END IF;
  IF NOT has_table_privilege('service_role','public.ses_review_batches','SELECT') THEN RAISE EXCEPTION 'service role lacks review access'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE relname LIKE 'ses_review_%' AND relkind='r' AND (NOT relrowsecurity OR NOT relforcerowsecurity)) THEN RAISE EXCEPTION 'RLS not forced'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE relname='rently_booking_events' AND (NOT relrowsecurity OR NOT relforcerowsecurity)) THEN RAISE EXCEPTION 'Rently event RLS not forced'; END IF;
END $$;

SELECT 'fixture_ok' AS result,
  (SELECT count(*) FROM public.ses_review_batches) AS batches,
  (SELECT count(*) FROM public.ses_review_items) AS items,
  (SELECT count(*) FROM public.ses_field_audit_events) AS field_audits;
