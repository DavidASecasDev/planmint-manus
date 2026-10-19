BEGIN;

-- Vehicle plate identity (case 9772 NNS / 9772NNS).
-- Additive and forward-only: one pure function, one private alias table,
-- two service_role-only RPCs, and a normalized replacement of the existing
-- fleet -> vehicles trigger function. Installing it modifies no rows.

CREATE OR REPLACE FUNCTION public.normalize_vehicle_plate(p_plate text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT pg_catalog.upper(pg_catalog.regexp_replace(COALESCE(p_plate, ''), '[^0-9A-Za-z]', '', 'g'))
$$;

COMMENT ON FUNCTION public.normalize_vehicle_plate(text) IS
  'Identity key for a plate: uppercase ASCII letters/digits only. Stored literals are never rewritten.';

CREATE TABLE IF NOT EXISTS public.vehicle_identity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alias_vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  canonical_vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  plate_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reverted')),
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL,
  moved_history_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  merged_by uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  reverted_by uuid,
  reverted_at timestamptz,
  CONSTRAINT vehicle_identity_aliases_distinct CHECK (alias_vehicle_id <> canonical_vehicle_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_identity_aliases_active_alias_uidx
  ON public.vehicle_identity_aliases (alias_vehicle_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS vehicle_identity_aliases_org_plate_idx
  ON public.vehicle_identity_aliases (organization_id, plate_key);

ALTER TABLE public.vehicle_identity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_identity_aliases FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.vehicle_identity_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vehicle_identity_aliases TO service_role;
DROP POLICY IF EXISTS vehicle_identity_aliases_service_role ON public.vehicle_identity_aliases;
CREATE POLICY vehicle_identity_aliases_service_role ON public.vehicle_identity_aliases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.vehicle_identity_aliases IS
  'Private, recoverable record of a consolidated duplicate vehicle: alias -> canonical, pre-merge snapshot and moved history ids.';

CREATE OR REPLACE FUNCTION public.merge_vehicle_identity_alias(
  p_organization_id uuid,
  p_alias_vehicle_id uuid,
  p_canonical_vehicle_id uuid,
  p_expected_alias_updated_at timestamptz,
  p_expected_canonical_updated_at timestamptz,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text
)
RETURNS TABLE (changed boolean, alias_record_id uuid, moved_history integer, alias_tasks_preserved integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alias public.vehicles%ROWTYPE;
  v_canon public.vehicles%ROWTYPE;
  v_alias_fleet public.fleet_vehicles%ROWTYPE;
  v_canon_fleet public.fleet_vehicles%ROWTYPE;
  v_existing public.vehicle_identity_aliases%ROWTYPE;
  v_key text;
  v_moved uuid[];
  v_blocking integer;
  v_foreign_history integer;
  v_tasks integer;
  v_updated integer;
  v_record_id uuid;
  v_alias_vin text;
  v_canon_vin text;
BEGIN
  IF p_organization_id IS NULL OR p_alias_vehicle_id IS NULL OR p_canonical_vehicle_id IS NULL
     OR p_actor_user_id IS NULL OR COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'vehicle_merge_invalid_arguments' USING ERRCODE = '22023';
  END IF;
  IF p_alias_vehicle_id = p_canonical_vehicle_id THEN
    RAISE EXCEPTION 'vehicle_merge_same_vehicle' USING ERRCODE = '22023';
  END IF;

  -- Deterministic lock order prevents deadlocks between concurrent merges.
  PERFORM 1 FROM public.vehicles
   WHERE id IN (p_alias_vehicle_id, p_canonical_vehicle_id)
   ORDER BY id
   FOR UPDATE;

  SELECT * INTO v_alias FROM public.vehicles WHERE id = p_alias_vehicle_id;
  SELECT * INTO v_canon FROM public.vehicles WHERE id = p_canonical_vehicle_id;
  IF v_alias.id IS NULL OR v_canon.id IS NULL THEN
    RAISE EXCEPTION 'vehicle_merge_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_alias.organization_id <> p_organization_id OR v_canon.organization_id <> p_organization_id THEN
    RAISE EXCEPTION 'vehicle_merge_cross_organization' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.vehicle_identity_aliases
   WHERE alias_vehicle_id = p_alias_vehicle_id AND status = 'active'
   FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.canonical_vehicle_id = p_canonical_vehicle_id AND v_alias.is_archived IS TRUE THEN
      RETURN QUERY SELECT false, v_existing.id, 0, 0;
      RETURN;
    END IF;
    RAISE EXCEPTION 'vehicle_merge_alias_conflict' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vehicle_identity_aliases
              WHERE alias_vehicle_id = p_canonical_vehicle_id AND status = 'active') THEN
    RAISE EXCEPTION 'vehicle_merge_canonical_is_alias' USING ERRCODE = '22023';
  END IF;

  IF v_alias.updated_at IS DISTINCT FROM p_expected_alias_updated_at
     OR v_canon.updated_at IS DISTINCT FROM p_expected_canonical_updated_at THEN
    RAISE EXCEPTION 'vehicle_merge_concurrent_change' USING ERRCODE = '40001';
  END IF;

  v_key := public.normalize_vehicle_plate(v_alias.matricula);
  IF v_key = '' OR v_key <> public.normalize_vehicle_plate(v_canon.matricula) THEN
    RAISE EXCEPTION 'vehicle_merge_plate_mismatch' USING ERRCODE = '22023';
  END IF;
  IF v_alias.is_archived IS TRUE OR v_canon.is_archived IS TRUE THEN
    RAISE EXCEPTION 'vehicle_merge_archived_state' USING ERRCODE = '22023';
  END IF;
  IF v_alias.current_reservation_id IS NOT NULL OR v_alias.status IN ('alquilado', 'en_servicio') THEN
    RAISE EXCEPTION 'vehicle_merge_alias_in_use' USING ERRCODE = '22023';
  END IF;

  IF v_alias.fleet_vehicle_id IS NOT NULL THEN
    SELECT * INTO v_alias_fleet FROM public.fleet_vehicles WHERE id = v_alias.fleet_vehicle_id;
  END IF;
  IF v_canon.fleet_vehicle_id IS NOT NULL THEN
    SELECT * INTO v_canon_fleet FROM public.fleet_vehicles WHERE id = v_canon.fleet_vehicle_id;
  END IF;
  IF (v_alias_fleet.id IS NOT NULL AND (v_alias_fleet.organization_id <> p_organization_id
        OR public.normalize_vehicle_plate(v_alias_fleet.matricula) <> v_key))
     OR (v_canon_fleet.id IS NOT NULL AND (v_canon_fleet.organization_id <> p_organization_id
        OR public.normalize_vehicle_plate(v_canon_fleet.matricula) <> v_key)) THEN
    RAISE EXCEPTION 'vehicle_merge_fleet_identity_mismatch' USING ERRCODE = '22023';
  END IF;
  v_alias_vin := NULLIF(public.normalize_vehicle_plate(v_alias_fleet.numero_bastidor), '');
  v_canon_vin := NULLIF(public.normalize_vehicle_plate(v_canon_fleet.numero_bastidor), '');
  IF v_alias_vin IS NOT NULL AND v_canon_vin IS NOT NULL AND v_alias_vin <> v_canon_vin THEN
    RAISE EXCEPTION 'vehicle_merge_vin_conflict' USING ERRCODE = '22023';
  END IF;

  -- This RPC only consolidates cleaning history. Any other record bound to the
  -- alias would need an explicit decision, so its presence blocks the merge.
  SELECT (SELECT count(*) FROM public.vehicle_movements WHERE vehicle_id = p_alias_vehicle_id)
       + (SELECT count(*) FROM public.accidents WHERE vehicle_id = p_alias_vehicle_id)
       + (SELECT count(*) FROM public.damage_reports WHERE vehicle_id = p_alias_vehicle_id)
       + (SELECT count(*) FROM public.repairs WHERE vehicle_id = p_alias_vehicle_id)
       + (SELECT count(*) FROM public.vehicle_quality_audits WHERE vehicle_id = p_alias_vehicle_id)
       + (SELECT count(*) FROM public.vehicle_status_audit_log WHERE vehicle_id = p_alias_vehicle_id)
    INTO v_blocking;
  IF v_blocking > 0 THEN
    RAISE EXCEPTION 'vehicle_merge_unsupported_references' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_foreign_history FROM public.vehicle_cleaning_history
   WHERE vehicle_id = p_alias_vehicle_id AND organization_id <> p_organization_id;
  IF v_foreign_history > 0 THEN
    RAISE EXCEPTION 'vehicle_merge_cross_organization_history' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_tasks FROM public.vehicle_cleaning_tasks WHERE vehicle_id = p_alias_vehicle_id;
  SELECT COALESCE(array_agg(id ORDER BY completed_at, id), '{}'::uuid[]) INTO v_moved
    FROM public.vehicle_cleaning_history WHERE vehicle_id = p_alias_vehicle_id;

  INSERT INTO public.vehicle_identity_aliases (
    organization_id, alias_vehicle_id, canonical_vehicle_id, plate_key, reason, evidence, snapshot,
    moved_history_ids, merged_by
  ) VALUES (
    p_organization_id, p_alias_vehicle_id, p_canonical_vehicle_id, v_key, p_reason,
    jsonb_build_object(
      'alias_plate_literal', v_alias.matricula,
      'canonical_plate_literal', v_canon.matricula,
      'alias_vin', v_alias_vin,
      'canonical_vin', v_canon_vin
    ),
    jsonb_build_object(
      'alias_vehicle', to_jsonb(v_alias),
      'canonical_vehicle', to_jsonb(v_canon),
      'alias_fleet_vehicle', CASE WHEN v_alias_fleet.id IS NULL THEN NULL ELSE to_jsonb(v_alias_fleet) END,
      'canonical_fleet_vehicle', CASE WHEN v_canon_fleet.id IS NULL THEN NULL ELSE to_jsonb(v_canon_fleet) END,
      'alias_cleaning_tasks', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.task_key, t.id), '[]'::jsonb)
                                 FROM public.vehicle_cleaning_tasks t WHERE t.vehicle_id = p_alias_vehicle_id),
      'alias_cleaning_history', (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.completed_at, h.id), '[]'::jsonb)
                                   FROM public.vehicle_cleaning_history h WHERE h.vehicle_id = p_alias_vehicle_id),
      'canonical_history_count_before', (SELECT count(*) FROM public.vehicle_cleaning_history
                                           WHERE vehicle_id = p_canonical_vehicle_id)
    ),
    v_moved, p_actor_user_id
  ) RETURNING id INTO v_record_id;

  -- Historical events keep their id, author, timestamps and notes; only the
  -- owning vehicle changes. Nothing new is invented.
  UPDATE public.vehicle_cleaning_history
     SET vehicle_id = p_canonical_vehicle_id
   WHERE id = ANY(v_moved) AND vehicle_id = p_alias_vehicle_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> COALESCE(cardinality(v_moved), 0) THEN
    RAISE EXCEPTION 'vehicle_merge_history_drift' USING ERRCODE = '40001';
  END IF;

  -- The alias is retired recoverably: archived, never deleted. Its checklist,
  -- status, location and fleet link stay untouched as evidence.
  UPDATE public.vehicles
     SET is_archived = true,
         archived_at = now(),
         archived_by = p_actor_user_id
   WHERE id = p_alias_vehicle_id
     AND updated_at IS NOT DISTINCT FROM p_expected_alias_updated_at;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'vehicle_merge_concurrent_change' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata_json)
  VALUES (
    p_organization_id, p_actor_user_id, p_actor_role, 'vehicle.identity_merge', 'vehicle', p_canonical_vehicle_id,
    jsonb_build_object(
      'alias_vehicle_id', p_alias_vehicle_id,
      'canonical_vehicle_id', p_canonical_vehicle_id,
      'alias_record_id', v_record_id,
      'plate_key', v_key,
      'moved_cleaning_history', COALESCE(cardinality(v_moved), 0),
      'alias_cleaning_tasks_preserved', v_tasks,
      'reason', p_reason
    )
  );

  RETURN QUERY SELECT true, v_record_id, COALESCE(cardinality(v_moved), 0), v_tasks;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_vehicle_identity_alias(uuid, uuid, uuid, timestamptz, timestamptz, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_vehicle_identity_alias(uuid, uuid, uuid, timestamptz, timestamptz, uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.revert_vehicle_identity_merge(
  p_organization_id uuid,
  p_alias_record_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text
)
RETURNS TABLE (changed boolean, restored_history integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec public.vehicle_identity_aliases%ROWTYPE;
  v_alias_snapshot jsonb;
  v_updated integer;
BEGIN
  IF p_organization_id IS NULL OR p_alias_record_id IS NULL OR p_actor_user_id IS NULL
     OR COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'vehicle_merge_invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rec FROM public.vehicle_identity_aliases WHERE id = p_alias_record_id FOR UPDATE;
  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'vehicle_merge_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_rec.organization_id <> p_organization_id THEN
    RAISE EXCEPTION 'vehicle_merge_cross_organization' USING ERRCODE = '42501';
  END IF;
  IF v_rec.status = 'reverted' THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
              AND indexname = 'vehicles_org_plate_key_active_uidx') THEN
    RAISE EXCEPTION 'vehicle_merge_revert_requires_index_rollback' USING ERRCODE = '55000';
  END IF;

  PERFORM 1 FROM public.vehicles
   WHERE id IN (v_rec.alias_vehicle_id, v_rec.canonical_vehicle_id)
   ORDER BY id
   FOR UPDATE;

  UPDATE public.vehicle_cleaning_history
     SET vehicle_id = v_rec.alias_vehicle_id
   WHERE id = ANY(v_rec.moved_history_ids) AND vehicle_id = v_rec.canonical_vehicle_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> COALESCE(cardinality(v_rec.moved_history_ids), 0) THEN
    RAISE EXCEPTION 'vehicle_merge_revert_history_drift' USING ERRCODE = '40001';
  END IF;

  v_alias_snapshot := v_rec.snapshot -> 'alias_vehicle';
  UPDATE public.vehicles
     SET is_archived = (v_alias_snapshot ->> 'is_archived')::boolean,
         archived_at = (v_alias_snapshot ->> 'archived_at')::timestamptz,
         archived_by = (v_alias_snapshot ->> 'archived_by')::uuid
   WHERE id = v_rec.alias_vehicle_id AND is_archived IS TRUE;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'vehicle_merge_revert_alias_state_changed' USING ERRCODE = '40001';
  END IF;

  UPDATE public.vehicle_identity_aliases
     SET status = 'reverted', reverted_at = now(), reverted_by = p_actor_user_id
   WHERE id = v_rec.id;

  INSERT INTO public.audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata_json)
  VALUES (
    p_organization_id, p_actor_user_id, p_actor_role, 'vehicle.identity_merge_reverted', 'vehicle', v_rec.canonical_vehicle_id,
    jsonb_build_object(
      'alias_vehicle_id', v_rec.alias_vehicle_id,
      'canonical_vehicle_id', v_rec.canonical_vehicle_id,
      'alias_record_id', v_rec.id,
      'restored_cleaning_history', COALESCE(cardinality(v_rec.moved_history_ids), 0),
      'reason', p_reason
    )
  );

  RETURN QUERY SELECT true, COALESCE(cardinality(v_rec.moved_history_ids), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.revert_vehicle_identity_merge(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revert_vehicle_identity_merge(uuid, uuid, uuid, text, text)
  TO service_role;

-- Fleet -> vehicles sync: same behaviour as before, but identity uses the
-- normalized plate, prefers the active record, never resurrects a consolidated
-- alias, refuses ambiguous matches and refuses contradictory VINs.
CREATE OR REPLACE FUNCTION public.sync_fleet_vehicle_to_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_existing_id uuid;
  v_target_id uuid;
  v_active_count integer;
  v_archived_count integer;
  v_linked_vin text;
  v_new_vin text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) FILTER (WHERE v.is_archived IS NOT TRUE),
           count(*) FILTER (WHERE v.is_archived IS TRUE)
      INTO v_active_count, v_archived_count
      FROM public.vehicles v
     WHERE v.organization_id = NEW.organization_id
       AND public.normalize_vehicle_plate(v.matricula) = public.normalize_vehicle_plate(NEW.matricula)
       AND NOT EXISTS (SELECT 1 FROM public.vehicle_identity_aliases a
                        WHERE a.alias_vehicle_id = v.id AND a.status = 'active');

    IF v_active_count > 1 OR (v_active_count = 0 AND v_archived_count > 1) THEN
      RAISE EXCEPTION 'vehicle_identity_ambiguous: % (%)', NEW.matricula, NEW.organization_id
        USING ERRCODE = '23505';
    END IF;

    SELECT v.id INTO v_existing_id
      FROM public.vehicles v
     WHERE v.organization_id = NEW.organization_id
       AND public.normalize_vehicle_plate(v.matricula) = public.normalize_vehicle_plate(NEW.matricula)
       AND NOT EXISTS (SELECT 1 FROM public.vehicle_identity_aliases a
                        WHERE a.alias_vehicle_id = v.id AND a.status = 'active')
     ORDER BY (v.is_archived IS TRUE), v.created_at
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      SELECT NULLIF(public.normalize_vehicle_plate(fv.numero_bastidor), '') INTO v_linked_vin
        FROM public.vehicles v
        JOIN public.fleet_vehicles fv ON fv.id = v.fleet_vehicle_id
       WHERE v.id = v_existing_id AND fv.id <> NEW.id;
      v_new_vin := NULLIF(public.normalize_vehicle_plate(NEW.numero_bastidor), '');
      IF v_linked_vin IS NOT NULL AND v_new_vin IS NOT NULL AND v_linked_vin <> v_new_vin THEN
        RAISE EXCEPTION 'vehicle_identity_vin_conflict: %', NEW.matricula USING ERRCODE = '23505';
      END IF;

      UPDATE public.vehicles
      SET fleet_vehicle_id = NEW.id,
          modelo = COALESCE(NEW.modelo, modelo),
          categoria = COALESCE(NEW.categoria, categoria),
          is_archived = false,
          archived_at = NULL,
          archived_by = NULL,
          updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.vehicles (
        organization_id, matricula, modelo, categoria,
        status, is_archived, fleet_vehicle_id, created_at, updated_at
      ) VALUES (
        NEW.organization_id, UPPER(TRIM(NEW.matricula)), NEW.modelo, NEW.categoria,
        'sucio', false, NEW.id, NOW(), NOW()
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT id INTO v_target_id
    FROM public.vehicles
    WHERE fleet_vehicle_id = NEW.id
    LIMIT 1;

    IF v_target_id IS NOT NULL THEN
      UPDATE public.vehicles
      SET matricula = UPPER(TRIM(NEW.matricula)),
          modelo = COALESCE(NEW.modelo, modelo),
          categoria = COALESCE(NEW.categoria, categoria),
          updated_at = NOW()
      WHERE id = v_target_id;
    ELSE
      SELECT v.id INTO v_target_id
      FROM public.vehicles v
      WHERE v.organization_id = NEW.organization_id
        AND public.normalize_vehicle_plate(v.matricula) = public.normalize_vehicle_plate(OLD.matricula)
        AND v.fleet_vehicle_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.vehicle_identity_aliases a
                         WHERE a.alias_vehicle_id = v.id AND a.status = 'active')
      ORDER BY (v.is_archived IS TRUE), v.created_at
      LIMIT 1;

      IF v_target_id IS NOT NULL THEN
        UPDATE public.vehicles
        SET matricula = UPPER(TRIM(NEW.matricula)),
            modelo = COALESCE(NEW.modelo, modelo),
            categoria = COALESCE(NEW.categoria, categoria),
            fleet_vehicle_id = NEW.id,
            updated_at = NOW()
        WHERE id = v_target_id;
      END IF;
    END IF;

    UPDATE public.vehicles v
    SET fleet_vehicle_id = NEW.id
    WHERE v.organization_id = NEW.organization_id
      AND public.normalize_vehicle_plate(v.matricula) = public.normalize_vehicle_plate(NEW.matricula)
      AND v.fleet_vehicle_id IS NULL
      AND v.id != COALESCE(v_target_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT EXISTS (SELECT 1 FROM public.vehicle_identity_aliases a
                       WHERE a.alias_vehicle_id = v.id AND a.status = 'active');

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.vehicles
    SET is_archived = true,
        archived_at = NOW(),
        fleet_vehicle_id = NULL,
        updated_at = NOW()
    WHERE fleet_vehicle_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

COMMIT;
