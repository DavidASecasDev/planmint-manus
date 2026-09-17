BEGIN;

CREATE OR REPLACE FUNCTION public.link_broker_profile_to_company(
  p_organization_id uuid,
  p_broker_id uuid,
  p_user_id uuid,
  p_actor_user_id uuid,
  p_actor_role text
)
RETURNS TABLE (
  already_linked boolean,
  profile_created boolean,
  organization_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_broker_profile public.broker_profiles%ROWTYPE;
  v_broker public.transfer_brokers%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_organization_name text;
  v_already_linked boolean := false;
  v_profile_created boolean := false;
BEGIN
  IF p_organization_id IS NULL
     OR p_broker_id IS NULL
     OR p_user_id IS NULL
     OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Match the lock order used by unlink: portal profile first, broker second.
  SELECT bp.*
    INTO v_broker_profile
    FROM public.broker_profiles bp
   WHERE bp.user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'broker_profile_missing' USING ERRCODE = 'P0002';
  END IF;

  IF v_broker_profile.organization_id IS DISTINCT FROM p_organization_id
     OR v_broker_profile.broker_id IS DISTINCT FROM p_broker_id THEN
    RAISE EXCEPTION 'broker_profile_mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF v_broker_profile.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'broker_profile_inactive' USING ERRCODE = 'P0001';
  END IF;

  SELECT tb.*
    INTO v_broker
    FROM public.transfer_brokers tb
   WHERE tb.id = p_broker_id
     AND tb.organization_id = p_organization_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'broker_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_broker.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'broker_user_changed' USING ERRCODE = '40001';
  END IF;

  IF v_broker.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'broker_inactive' USING ERRCODE = 'P0001';
  END IF;

  SELECT o.name
    INTO v_organization_name
    FROM public.organizations o
   WHERE o.id = p_organization_id;

  IF v_organization_name IS NULL THEN
    RAISE EXCEPTION 'organization_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.*
    INTO v_profile
    FROM public.profiles p
   WHERE p.id = p_user_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_profile.organization_id IS NOT NULL
       AND v_profile.organization_id IS DISTINCT FROM p_organization_id THEN
      RAISE EXCEPTION 'profile_other_organization' USING ERRCODE = 'P0001';
    END IF;

    IF v_profile.organization_id = p_organization_id THEN
      v_already_linked := true;
    ELSE
      UPDATE public.profiles
         SET organization_id = p_organization_id
       WHERE id = p_user_id
         AND organization_id IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_changed' USING ERRCODE = '40001';
      END IF;
    END IF;
  ELSE
    BEGIN
      INSERT INTO public.profiles (id, name, organization_id, role)
      VALUES (p_user_id, v_broker.name, p_organization_id, 'member');
      v_profile_created := true;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT p.*
          INTO v_profile
          FROM public.profiles p
         WHERE p.id = p_user_id
         FOR UPDATE;

        IF NOT FOUND
           OR v_profile.organization_id IS DISTINCT FROM p_organization_id THEN
          RAISE EXCEPTION 'profile_changed' USING ERRCODE = '40001';
        END IF;
        v_already_linked := true;
    END;
  END IF;

  -- The locked identities must still describe the same active access before audit/commit.
  IF NOT EXISTS (
    SELECT 1
      FROM public.broker_profiles bp
      JOIN public.transfer_brokers tb
        ON tb.id = bp.broker_id
       AND tb.organization_id = bp.organization_id
     WHERE bp.id = v_broker_profile.id
       AND bp.user_id = p_user_id
       AND bp.broker_id = p_broker_id
       AND bp.organization_id = p_organization_id
       AND bp.is_active IS TRUE
       AND tb.user_id = p_user_id
       AND tb.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'broker_link_changed' USING ERRCODE = '40001';
  END IF;

  IF NOT v_already_linked THEN
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
      'broker.link_company',
      'transfer_brokers',
      p_broker_id,
      jsonb_build_object(
        'broker_id', p_broker_id,
        'linked_user_id', p_user_id,
        'profile_created', v_profile_created
      )
    );
  END IF;

  RETURN QUERY
  SELECT v_already_linked, v_profile_created, v_organization_name;
END;
$$;

REVOKE ALL ON FUNCTION public.link_broker_profile_to_company(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_broker_profile_to_company(uuid, uuid, uuid, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.link_broker_profile_to_company(uuid, uuid, uuid, uuid, text)
  IS 'Atomically links an existing active broker portal identity to its current organization profile. Service role only.';

COMMIT;
