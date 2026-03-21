-- =============================================================================
-- PlanMint: Notification Triggers Migration
-- Auto-generate in-app notifications for key operational events
-- =============================================================================
-- Triggers:
--   1. Repair status change      → notify created_by + assigned members
--   2. New accident reported      → notify all org members with garatech perms
--   3. Task assigned / reassigned → notify the assigned user
--   4. Task status changed        → notify the task creator
--   5. New transfer request       → notify all org members with transfer perms
--   6. Damage report finalized    → notify the reporter + vehicle responsible
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: Insert a notification for a specific user
-- Reusable by all trigger functions to avoid code duplication
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_notification(
  p_organization_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid
)
RETURNS void AS $$
BEGIN
  -- Skip if user_id is null
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    organization_id,
    user_id,
    type,
    title,
    body,
    entity_type,
    entity_id,
    is_read,
    created_at
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    false,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 1: Repair status change → notify repair creator
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_repair_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_plate text;
  v_status_label text;
  v_old_status_label text;
  v_title text;
  v_body text;
BEGIN
  -- Only fire on UPDATE when status actually changed
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get vehicle plate for context
  SELECT COALESCE(v.matricula, 'Sin matrícula') INTO v_vehicle_plate
  FROM public.vehicles v
  WHERE v.id = NEW.vehicle_id OR v.fleet_vehicle_id = NEW.vehicle_id
  LIMIT 1;

  -- Map status to human-readable labels
  v_status_label := CASE NEW.status
    WHEN 'pendiente_aprobacion' THEN 'Pendiente Aprobación'
    WHEN 'listo_entregar_taller' THEN 'Listo Entregar Taller'
    WHEN 'en_taller' THEN 'En Taller'
    WHEN 'esperando_piezas' THEN 'Esperando Piezas'
    WHEN 'listo_recoger' THEN 'Listo para Recoger'
    WHEN 'finalizado' THEN 'Finalizado'
    ELSE NEW.status
  END;

  IF TG_OP = 'UPDATE' THEN
    v_old_status_label := CASE OLD.status
      WHEN 'pendiente_aprobacion' THEN 'Pendiente Aprobación'
      WHEN 'listo_entregar_taller' THEN 'Listo Entregar Taller'
      WHEN 'en_taller' THEN 'En Taller'
      WHEN 'esperando_piezas' THEN 'Esperando Piezas'
      WHEN 'listo_recoger' THEN 'Listo para Recoger'
      WHEN 'finalizado' THEN 'Finalizado'
      ELSE OLD.status
    END;

    v_title := 'Reparación actualizada: ' || COALESCE(v_vehicle_plate, '');
    v_body := 'Estado cambiado de "' || v_old_status_label || '" a "' || v_status_label || '"';
  ELSE
    -- INSERT: new repair created
    v_title := 'Nueva reparación: ' || COALESCE(v_vehicle_plate, '');
    v_body := 'Tipo: ' || COALESCE(NEW.repair_type, 'N/A') || ' — Estado: ' || v_status_label;
  END IF;

  -- Notify the repair creator (if exists and is not the one who triggered the change)
  IF NEW.created_by IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.organization_id,
      NEW.created_by,
      'repair_update',
      v_title,
      v_body,
      'repair',
      NEW.id
    );
  END IF;

  -- Notify all org admins/managers who have garatech permissions
  -- (members with role that includes garatech access, excluding the creator to avoid duplicates)
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'repair_update',
    v_title,
    v_body,
    'repair',
    NEW.id,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.created_by
    AND (
      r.name = 'admin'
      OR r.name = 'super_admin'
      OR r.permissions::jsonb -> 'garatech' -> 'repairs' ->> 'view' = 'true'
    )
  LIMIT 10;  -- Safety cap to prevent notification storms

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_repair_notify ON public.repairs;
CREATE TRIGGER on_repair_notify
AFTER INSERT OR UPDATE OF status ON public.repairs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_repair_status_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 2: New accident reported → notify org admins/managers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_accident_created()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_plate text;
  v_severity_label text;
  v_title text;
  v_body text;
BEGIN
  -- Get vehicle plate
  SELECT COALESCE(v.matricula, 'Sin matrícula') INTO v_vehicle_plate
  FROM public.vehicles v
  WHERE v.id = NEW.vehicle_id OR v.fleet_vehicle_id = NEW.vehicle_id
  LIMIT 1;

  v_severity_label := CASE NEW.severity
    WHEN 'leve' THEN 'Leve'
    WHEN 'moderado' THEN 'Moderado'
    WHEN 'grave' THEN 'GRAVE'
    ELSE NEW.severity
  END;

  v_title := 'Accidente reportado: ' || COALESCE(v_vehicle_plate, 'Vehículo');
  v_body := 'Severidad: ' || v_severity_label;

  IF NEW.location IS NOT NULL AND NEW.location != '' THEN
    v_body := v_body || ' — Ubicación: ' || NEW.location;
  END IF;

  IF NEW.has_injuries THEN
    v_body := v_body || ' — ⚠ Con lesiones personales';
  END IF;

  -- Notify all active org members with admin/garatech access
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'accident_report',
    v_title,
    v_body,
    'accident',
    NEW.id,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.reported_by
    AND (
      r.name = 'admin'
      OR r.name = 'super_admin'
      OR r.permissions::jsonb -> 'garatech' -> 'accidents' ->> 'view' = 'true'
    )
  LIMIT 15;  -- Safety cap

  -- Also notify the reporter as confirmation
  IF NEW.reported_by IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.organization_id,
      NEW.reported_by,
      'accident_report',
      'Accidente registrado correctamente',
      'Tu reporte del accidente de ' || COALESCE(v_vehicle_plate, 'vehículo') || ' ha sido registrado.',
      'accident',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_accident_notify ON public.accidents;
CREATE TRIGGER on_accident_notify
AFTER INSERT ON public.accidents
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_accident_created();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 3: Task assigned or reassigned → notify the assigned user
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_area_name text;
BEGIN
  -- Only fire when assigned_to changes and is not null
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire if assigned_to actually changed
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Get area name for context
  SELECT name INTO v_area_name
  FROM public.areas
  WHERE id = NEW.area_id
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_title := 'Nueva tarea asignada';
  ELSE
    v_title := 'Tarea reasignada';
  END IF;

  v_body := COALESCE(NEW.title, 'Sin título');
  IF v_area_name IS NOT NULL THEN
    v_body := v_body || ' — Área: ' || v_area_name;
  END IF;
  IF NEW.priority IS NOT NULL THEN
    v_body := v_body || ' — Prioridad: ' || CASE NEW.priority
      WHEN 'urgent' THEN 'Urgente'
      WHEN 'high' THEN 'Alta'
      WHEN 'medium' THEN 'Media'
      WHEN 'low' THEN 'Baja'
      ELSE NEW.priority
    END;
  END IF;

  PERFORM public.create_notification(
    NEW.organization_id,
    NEW.assigned_to,
    'assignment',
    v_title,
    v_body,
    'task',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_task_assigned_notify ON public.tasks;
CREATE TRIGGER on_task_assigned_notify
AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_task_assigned();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 4: Task status changed → notify the task creator
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_status_label text;
  v_old_status_label text;
  v_title text;
  v_body text;
BEGIN
  -- Only fire on UPDATE when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Don't notify if there's no creator
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify the creator if they are the one who changed it
  -- (We can't easily detect WHO changed it in a trigger, so we notify anyway)

  v_status_label := CASE NEW.status
    WHEN 'todo' THEN 'Pendiente'
    WHEN 'in_progress' THEN 'En Progreso'
    WHEN 'review' THEN 'En Revisión'
    WHEN 'done' THEN 'Completada'
    WHEN 'blocked' THEN 'Bloqueada'
    ELSE NEW.status
  END;

  v_old_status_label := CASE OLD.status
    WHEN 'todo' THEN 'Pendiente'
    WHEN 'in_progress' THEN 'En Progreso'
    WHEN 'review' THEN 'En Revisión'
    WHEN 'done' THEN 'Completada'
    WHEN 'blocked' THEN 'Bloqueada'
    ELSE OLD.status
  END;

  v_title := 'Tarea actualizada: ' || COALESCE(NEW.title, 'Sin título');
  v_body := 'Estado cambiado de "' || v_old_status_label || '" a "' || v_status_label || '"';

  -- Notify the creator
  PERFORM public.create_notification(
    NEW.organization_id,
    NEW.created_by,
    'assignment',
    v_title,
    v_body,
    'task',
    NEW.id
  );

  -- If there's an assigned user different from creator, notify them too
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM NEW.created_by THEN
    PERFORM public.create_notification(
      NEW.organization_id,
      NEW.assigned_to,
      'assignment',
      v_title,
      v_body,
      'task',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_task_status_notify ON public.tasks;
CREATE TRIGGER on_task_status_notify
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_task_status_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 5: New transfer request → notify org members with transfer perms
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_transfer_request_created()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_broker_name text;
  v_item_count integer;
BEGIN
  -- Get broker name
  SELECT COALESCE(b.company_name, b.contact_name, 'Broker') INTO v_broker_name
  FROM public.brokers b
  WHERE b.id = NEW.broker_id
  LIMIT 1;

  -- Count items in the request
  SELECT COUNT(*) INTO v_item_count
  FROM public.transfer_request_items
  WHERE request_id = NEW.id;

  v_title := 'Nueva solicitud de transfer';
  v_body := 'De: ' || v_broker_name;

  IF v_item_count > 0 THEN
    v_body := v_body || ' — ' || v_item_count || ' servicio(s)';
  END IF;

  IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
    v_body := v_body || ' — ' || LEFT(NEW.notes, 100);
  END IF;

  -- Notify all active members with transfer permissions
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'transfer_note',
    v_title,
    v_body,
    'transfer_request',
    NEW.id,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND (
      r.name = 'admin'
      OR r.name = 'super_admin'
      OR r.permissions::jsonb -> 'transfers' ->> 'view' = 'true'
    )
  LIMIT 15;  -- Safety cap

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_transfer_request_notify ON public.transfer_requests;
CREATE TRIGGER on_transfer_request_notify
AFTER INSERT ON public.transfer_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_transfer_request_created();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 6: Damage report finalized → notify reporter + admins
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_damage_report_finalized()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_vehicle_plate text;
BEGIN
  -- Only fire when status changes TO 'finalizado' or 'enviado'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('finalizado', 'enviado') THEN
    RETURN NEW;
  END IF;

  v_vehicle_plate := COALESCE(NEW.vehicle_plate, 'Sin matrícula');

  IF NEW.status = 'finalizado' THEN
    v_title := 'Informe de daños finalizado: ' || v_vehicle_plate;
    v_body := 'Importe total: ' || COALESCE(NEW.total_amount::text, '0') || '€';
  ELSE
    v_title := 'Informe de daños enviado: ' || v_vehicle_plate;
    v_body := 'El informe de ' || v_vehicle_plate || ' ha sido enviado al cliente.';
  END IF;

  IF NEW.customer_name IS NOT NULL AND NEW.customer_name != '' THEN
    v_body := v_body || ' — Cliente: ' || NEW.customer_name;
  END IF;

  -- Notify the reporter
  IF NEW.reported_by IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.organization_id,
      NEW.reported_by,
      'damage_report_update',
      v_title,
      v_body,
      'damage_report',
      NEW.id
    );
  END IF;

  -- Notify admins
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'damage_report_update',
    v_title,
    v_body,
    'damage_report',
    NEW.id,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND m.user_id IS DISTINCT FROM NEW.reported_by
    AND (
      r.name = 'admin'
      OR r.name = 'super_admin'
    )
  LIMIT 10;  -- Safety cap

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_damage_report_notify ON public.damage_reports;
CREATE TRIGGER on_damage_report_notify
AFTER UPDATE OF status ON public.damage_reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_damage_report_finalized();


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER 7 (Bonus): Transfer request status change → notify broker via in-app
-- When a transfer request changes status (e.g., presupuesto enviado, confirmado)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_transfer_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_status_label text;
  v_old_status_label text;
BEGIN
  -- Only fire when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_status_label := CASE NEW.status
    WHEN 'pendiente' THEN 'Pendiente'
    WHEN 'en_gestion' THEN 'En Gestión'
    WHEN 'presupuesto_enviado' THEN 'Presupuesto Enviado'
    WHEN 'confirmado' THEN 'Confirmado'
    WHEN 'cancelado' THEN 'Cancelado'
    WHEN 'completado' THEN 'Completado'
    ELSE NEW.status
  END;

  v_old_status_label := CASE OLD.status
    WHEN 'pendiente' THEN 'Pendiente'
    WHEN 'en_gestion' THEN 'En Gestión'
    WHEN 'presupuesto_enviado' THEN 'Presupuesto Enviado'
    WHEN 'confirmado' THEN 'Confirmado'
    WHEN 'cancelado' THEN 'Cancelado'
    WHEN 'completado' THEN 'Completado'
    ELSE OLD.status
  END;

  v_title := 'Solicitud de transfer actualizada';
  v_body := 'Estado cambiado de "' || v_old_status_label || '" a "' || v_status_label || '"';

  -- Notify all active members with transfer permissions
  INSERT INTO public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
  SELECT
    NEW.organization_id,
    m.user_id,
    'transfer_note',
    v_title,
    v_body,
    'transfer_request',
    NEW.id,
    false,
    now()
  FROM public.members m
  INNER JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND (
      r.name = 'admin'
      OR r.name = 'super_admin'
      OR r.permissions::jsonb -> 'transfers' ->> 'view' = 'true'
    )
  LIMIT 15;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_transfer_status_notify ON public.transfer_requests;
CREATE TRIGGER on_transfer_status_notify
AFTER UPDATE OF status ON public.transfer_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_transfer_status_change();
