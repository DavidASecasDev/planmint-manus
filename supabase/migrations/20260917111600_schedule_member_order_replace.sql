BEGIN;

CREATE OR REPLACE FUNCTION public.replace_schedule_member_order(
  p_organization_id uuid,
  p_team_id uuid,
  p_week_start date,
  p_ordered_user_ids uuid[],
  p_actor_user_id uuid,
  p_actor_role text
)
RETURNS TABLE (
  changed boolean,
  member_count integer,
  stored_count integer,
  sequence_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_name text;
  v_input_count integer;
  v_distinct_input_count integer;
  v_member_count integer;
  v_stored_count integer;
  v_existing_exact boolean;
  v_sequence_valid boolean;
BEGIN
  IF p_organization_id IS NULL
     OR p_team_id IS NULL
     OR p_week_start IS NULL
     OR p_actor_user_id IS NULL
     OR p_ordered_user_ids IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  IF extract(isodow FROM p_week_start) <> 1 THEN
    RAISE EXCEPTION 'week_start_must_be_monday' USING ERRCODE = '22023';
  END IF;

  SELECT t.name
    INTO v_team_name
    FROM public.teams t
   WHERE t.id = p_team_id
     AND t.organization_id = p_organization_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*), count(DISTINCT uid)
    INTO v_input_count, v_distinct_input_count
    FROM unnest(p_ordered_user_ids) AS requested(uid);

  IF v_input_count = 0 OR v_input_count <> v_distinct_input_count THEN
    RAISE EXCEPTION 'ordered_user_ids_empty_or_duplicated' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT tm.user_id)
    INTO v_member_count
    FROM public.team_members tm
    JOIN public.organization_members om
      ON om.organization_id = tm.organization_id
     AND om.user_id = tm.user_id
     AND om.status = 'active'
   WHERE tm.organization_id = p_organization_id
     AND tm.team_id = p_team_id;

  IF v_input_count <> v_member_count THEN
    RAISE EXCEPTION 'ordered_member_count_mismatch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(p_ordered_user_ids) AS requested(uid)
      LEFT JOIN public.team_members tm
        ON tm.organization_id = p_organization_id
       AND tm.team_id = p_team_id
       AND tm.user_id = requested.uid
      LEFT JOIN public.organization_members om
        ON om.organization_id = p_organization_id
       AND om.user_id = requested.uid
       AND om.status = 'active'
     WHERE tm.user_id IS NULL OR om.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'ordered_user_not_active_team_member' USING ERRCODE = '22023';
  END IF;

  SELECT
    count(*) = v_member_count
    AND count(DISTINCT smo.user_id) = v_member_count
    AND count(DISTINCT smo.sort_order) = v_member_count
    AND count(*) FILTER (
      WHERE smo.sort_order BETWEEN 0 AND v_member_count - 1
        AND p_ordered_user_ids[smo.sort_order + 1] = smo.user_id
    ) = v_member_count
    INTO v_existing_exact
    FROM public.schedule_member_order smo
   WHERE smo.organization_id = p_organization_id
     AND smo.team_id = p_team_id
     AND smo.week_start = p_week_start;

  IF NOT coalesce(v_existing_exact, false) THEN
    DELETE FROM public.schedule_member_order
     WHERE organization_id = p_organization_id
       AND team_id = p_team_id
       AND week_start = p_week_start;

    INSERT INTO public.schedule_member_order (
      organization_id,
      team_id,
      week_start,
      user_id,
      sort_order
    )
    SELECT
      p_organization_id,
      p_team_id,
      p_week_start,
      requested.uid,
      (requested.ordinality - 1)::integer
    FROM unnest(p_ordered_user_ids) WITH ORDINALITY AS requested(uid, ordinality)
    ORDER BY requested.ordinality;

    INSERT INTO public.audit_logs (
      organization_id,
      actor_user_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      metadata_json
    ) VALUES (
      p_organization_id,
      p_actor_user_id,
      p_actor_role,
      'schedule.replace_member_order',
      'teams',
      p_team_id,
      jsonb_build_object(
        'week_start', p_week_start,
        'team_name', v_team_name,
        'member_count', v_member_count,
        'ordered_user_ids', to_jsonb(p_ordered_user_ids)
      )
    );
  END IF;

  SELECT
    count(*)::integer,
    count(*) = v_member_count
      AND count(DISTINCT smo.user_id) = v_member_count
      AND count(DISTINCT smo.sort_order) = v_member_count
      AND coalesce(min(smo.sort_order), 0) = 0
      AND coalesce(max(smo.sort_order), -1) = v_member_count - 1
    INTO v_stored_count, v_sequence_valid
    FROM public.schedule_member_order smo
   WHERE smo.organization_id = p_organization_id
     AND smo.team_id = p_team_id
     AND smo.week_start = p_week_start;

  IF NOT v_sequence_valid THEN
    RAISE EXCEPTION 'stored_order_validation_failed' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT NOT coalesce(v_existing_exact, false), v_member_count, v_stored_count, v_sequence_valid;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_schedule_member_order(uuid, uuid, date, uuid[], uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_schedule_member_order(uuid, uuid, date, uuid[], uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.replace_schedule_member_order(uuid, uuid, date, uuid[], uuid, text)
  IS 'Atomically replaces one team/week member order with the complete active membership, removing stale rows and validating a unique contiguous sequence. Does not modify staff schedules or time entries.';

COMMIT;
