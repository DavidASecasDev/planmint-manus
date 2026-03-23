-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Invitation Sent → Notify admins of the organization
-- When a new invitation is created in organization_invitations,
-- notify all admin/super_admin members about the new invitation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_invitation_sent()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_org_name text;
  v_role_name text;
  v_inviter_name text;
BEGIN
  -- Get organization name
  SELECT COALESCE(o.name, 'Organización') INTO v_org_name
  FROM public.organizations o
  WHERE o.id = NEW.organization_id
  LIMIT 1;

  -- Get the role name for the invitation
  SELECT COALESCE(r.name, 'miembro') INTO v_role_name
  FROM public.roles r
  WHERE r.id = NEW.role_id
  LIMIT 1;

  -- Get inviter name
  IF NEW.invited_by IS NOT NULL THEN
    SELECT COALESCE(p.full_name, p.email, 'Un administrador') INTO v_inviter_name
    FROM public.profiles p
    WHERE p.id = NEW.invited_by
    LIMIT 1;
  ELSE
    v_inviter_name := 'El sistema';
  END IF;

  v_title := 'Nueva invitación enviada';
  v_body := v_inviter_name || ' ha invitado a ' || COALESCE(NEW.email, 'un usuario') || ' como ' || v_role_name;

  -- Notify all active admins/super_admins in the organization (except the inviter)
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'invitation_sent',
    v_title,
    v_body,
    'invitation',
    NEW.id::text,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND (r.name = 'admin' OR r.name = 'super_admin')
    AND (NEW.invited_by IS NULL OR m.user_id IS DISTINCT FROM NEW.invited_by)
  LIMIT 10;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_invitation_sent_notify ON public.organization_invitations;
CREATE TRIGGER on_invitation_sent_notify
AFTER INSERT ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_invitation_sent();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: Invitation Accepted → Notify inviter and admins
-- When an invitation status changes to 'accepted',
-- notify the person who sent the invitation and org admins.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_invitation_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_org_name text;
  v_role_name text;
  v_accepted_name text;
BEGIN
  -- Only fire when status changes TO 'accepted'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Get organization name
  SELECT COALESCE(o.name, 'Organización') INTO v_org_name
  FROM public.organizations o
  WHERE o.id = NEW.organization_id
  LIMIT 1;

  -- Get the role name
  SELECT COALESCE(r.name, 'miembro') INTO v_role_name
  FROM public.roles r
  WHERE r.id = NEW.role_id
  LIMIT 1;

  -- Try to get the name of the person who accepted (from profiles by email)
  SELECT COALESCE(p.full_name, p.email, NEW.email) INTO v_accepted_name
  FROM public.profiles p
  WHERE p.email = NEW.email
  LIMIT 1;

  IF v_accepted_name IS NULL THEN
    v_accepted_name := COALESCE(NEW.email, 'Un usuario');
  END IF;

  v_title := 'Invitación aceptada';
  v_body := v_accepted_name || ' ha aceptado la invitación y se ha unido como ' || v_role_name;

  -- 1) Notify the inviter directly
  IF NEW.invited_by IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.organization_id,
      NEW.invited_by,
      'invitation_accepted',
      v_title,
      v_body,
      'invitation',
      NEW.id::text
    );
  END IF;

  -- 2) Notify other admins/super_admins (excluding the inviter, they already got notified)
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'invitation_accepted',
    v_title,
    v_body,
    'invitation',
    NEW.id::text,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND (r.name = 'admin' OR r.name = 'super_admin')
    AND (NEW.invited_by IS NULL OR m.user_id IS DISTINCT FROM NEW.invited_by)
  LIMIT 10;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_invitation_accepted_notify ON public.organization_invitations;
CREATE TRIGGER on_invitation_accepted_notify
AFTER UPDATE OF status ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_invitation_accepted();
