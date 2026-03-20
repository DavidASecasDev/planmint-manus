-- =============================================================================
-- PlanMint: Integrated Operations Migration
-- Phases 1-6: Auto-sync, triggers, fleet linkage, movements, Garatech, auto-tasks
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: Auto-sync Rently every 5 minutes
-- ─────────────────────────────────────────────────────────────────────────────

-- Add auto_sync columns to integration_settings
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_sync_interval_minutes integer DEFAULT 5;

-- Add last_auto_sync_at to rently_sync_status for tracking
ALTER TABLE public.rently_sync_status
  ADD COLUMN IF NOT EXISTS last_auto_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_sync_triggered_by text DEFAULT 'manual';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: Automatic vehicle status triggers on reservation changes
-- ─────────────────────────────────────────────────────────────────────────────

-- Function: When a reservation status changes, update the corresponding vehicle
CREATE OR REPLACE FUNCTION public.sync_vehicle_status_from_reservation()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_id uuid;
  v_current_status text;
  v_matricula text;
BEGIN
  -- Only process if the reservation has a vehicle (auto field = matricula)
  v_matricula := COALESCE(NEW.auto, '');
  IF v_matricula = '' THEN
    RETURN NEW;
  END IF;

  -- Find the corresponding vehicle by matricula
  SELECT id, status INTO v_vehicle_id, v_current_status
  FROM public.vehicles
  WHERE matricula = v_matricula
    AND organization_id = NEW.organization_id
    AND (is_archived = false OR is_archived IS NULL)
  LIMIT 1;

  -- If no vehicle found, skip (sync_vehicles_from_reservations will create it)
  IF v_vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Handle status transitions based on reservation estado
  CASE NEW.estado
    -- Reservation confirmed: mark vehicle as en_servicio (reserved but not yet delivered)
    WHEN 'Confirmada' THEN
      IF v_current_status NOT IN ('alquilado', 'en_servicio') THEN
        UPDATE public.vehicles
        SET status = 'en_servicio',
            current_reservation_id = NEW.id,
            last_status_change = now()
        WHERE id = v_vehicle_id;
      END IF;

    -- Vehicle delivered to client: mark as alquilado
    WHEN 'Entregado' THEN
      UPDATE public.vehicles
      SET status = 'alquilado',
          current_reservation_id = NEW.id,
          last_status_change = now()
      WHERE id = v_vehicle_id;

    -- Reservation finished: mark vehicle as sucio (needs cleaning)
    WHEN 'Terminada' THEN
      IF v_current_status = 'alquilado' OR v_current_status = 'en_servicio' THEN
        UPDATE public.vehicles
        SET status = 'sucio',
            current_reservation_id = NULL,
            last_status_change = now()
        WHERE id = v_vehicle_id;

        -- Auto-create cleaning tasks for this vehicle
        PERFORM public.create_cleaning_tasks_for_vehicle(v_vehicle_id);
      END IF;

    -- Reservation cancelled: revert vehicle to previous available state
    WHEN 'Cancelada' THEN
      IF v_current_status IN ('en_servicio', 'alquilado') 
         AND (SELECT current_reservation_id FROM public.vehicles WHERE id = v_vehicle_id) = NEW.id THEN
        -- Check if vehicle was clean before this reservation
        UPDATE public.vehicles
        SET status = 'limpio',
            current_reservation_id = NULL,
            last_status_change = now()
        WHERE id = v_vehicle_id;
      END IF;

    ELSE
      -- No action for other states
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function: Create default cleaning tasks for a vehicle
CREATE OR REPLACE FUNCTION public.create_cleaning_tasks_for_vehicle(p_vehicle_id uuid)
RETURNS void AS $$
DECLARE
  v_task_keys text[] := ARRAY['inicio_prep', 'repostaje', 'presion', 'avisos', 'borrado', 'limpieza_int', 'limpieza_ext'];
  v_key text;
BEGIN
  -- Delete any existing incomplete tasks for this vehicle
  DELETE FROM public.vehicle_cleaning_tasks
  WHERE vehicle_id = p_vehicle_id
    AND (completed = false OR completed IS NULL);

  -- Create fresh cleaning tasks
  FOREACH v_key IN ARRAY v_task_keys
  LOOP
    INSERT INTO public.vehicle_cleaning_tasks (vehicle_id, task_key, completed)
    VALUES (p_vehicle_id, v_key, false)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on reservation INSERT (new reservations from Rently sync)
DROP TRIGGER IF EXISTS on_reservation_inserted ON public.reservations;
CREATE TRIGGER on_reservation_inserted
AFTER INSERT ON public.reservations
FOR EACH ROW
WHEN (NEW.auto IS NOT NULL AND NEW.auto != '')
EXECUTE FUNCTION public.sync_vehicle_status_from_reservation();

-- Trigger on reservation UPDATE (status changes from Rently sync)
DROP TRIGGER IF EXISTS on_reservation_status_changed ON public.reservations;
CREATE TRIGGER on_reservation_status_changed
AFTER UPDATE OF estado ON public.reservations
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.auto IS NOT NULL AND NEW.auto != '')
EXECUTE FUNCTION public.sync_vehicle_status_from_reservation();

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Link Fleet (fleet_vehicles) with Vehicle Status (vehicles)
-- ─────────────────────────────────────────────────────────────────────────────

-- Add FK from vehicles to fleet_vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fleet_vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL;

-- Create index for the FK
CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_vehicle_id ON public.vehicles(fleet_vehicle_id);

-- Function to auto-link vehicles with fleet_vehicles by matricula
CREATE OR REPLACE FUNCTION public.link_vehicles_to_fleet()
RETURNS jsonb AS $$
DECLARE
  v_linked_count integer := 0;
  v_vehicle record;
BEGIN
  -- Link vehicles to fleet_vehicles where matricula matches and not already linked
  FOR v_vehicle IN
    SELECT v.id as vehicle_id, fv.id as fleet_vehicle_id
    FROM public.vehicles v
    INNER JOIN public.fleet_vehicles fv 
      ON UPPER(TRIM(v.matricula)) = UPPER(TRIM(fv.matricula))
      AND v.organization_id = fv.organization_id
    WHERE v.fleet_vehicle_id IS NULL
      AND (v.is_archived = false OR v.is_archived IS NULL)
  LOOP
    UPDATE public.vehicles
    SET fleet_vehicle_id = v_vehicle.fleet_vehicle_id
    WHERE id = v_vehicle.vehicle_id;
    
    v_linked_count := v_linked_count + 1;
  END LOOP;

  RETURN jsonb_build_object('linked', v_linked_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-link when a new fleet_vehicle is created
CREATE OR REPLACE FUNCTION public.auto_link_fleet_vehicle()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to link any existing vehicle with matching matricula
  UPDATE public.vehicles
  SET fleet_vehicle_id = NEW.id
  WHERE UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
    AND organization_id = NEW.organization_id
    AND fleet_vehicle_id IS NULL
    AND (is_archived = false OR is_archived IS NULL);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_fleet_vehicle_created ON public.fleet_vehicles;
CREATE TRIGGER on_fleet_vehicle_created
AFTER INSERT ON public.fleet_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_fleet_vehicle();

-- Auto-link when a new vehicle is created (from sync)
CREATE OR REPLACE FUNCTION public.auto_link_vehicle_to_fleet()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to link to existing fleet_vehicle with matching matricula
  IF NEW.fleet_vehicle_id IS NULL THEN
    UPDATE public.vehicles
    SET fleet_vehicle_id = (
      SELECT id FROM public.fleet_vehicles
      WHERE UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
        AND organization_id = NEW.organization_id
      LIMIT 1
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_vehicle_created_link_fleet ON public.vehicles;
CREATE TRIGGER on_vehicle_created_link_fleet
AFTER INSERT ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_vehicle_to_fleet();

-- Run initial linking for existing data
SELECT public.link_vehicles_to_fleet();

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: Movements update vehicle status and location
-- ─────────────────────────────────────────────────────────────────────────────

-- Function: When a movement is completed, update vehicle status and location
CREATE OR REPLACE FUNCTION public.sync_vehicle_from_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_id uuid;
  v_matricula text;
BEGIN
  v_matricula := COALESCE(NEW.matricula, '');
  IF v_matricula = '' THEN
    RETURN NEW;
  END IF;

  -- Find the vehicle
  SELECT id INTO v_vehicle_id
  FROM public.vehicles
  WHERE matricula = v_matricula
    AND organization_id = NEW.organization_id
    AND (is_archived = false OR is_archived IS NULL)
  LIMIT 1;

  IF v_vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only act when movement is completed
  IF NEW.status = 'completado' AND (OLD.status IS NULL OR OLD.status != 'completado') THEN
    CASE NEW.movement_type
      -- Entrega completed: vehicle is now with client = alquilado
      WHEN 'entrega' THEN
        UPDATE public.vehicles
        SET status = 'alquilado',
            last_status_change = now()
        WHERE id = v_vehicle_id;

      -- Recogida completed: vehicle returned = sucio + create cleaning tasks
      WHEN 'recogida' THEN
        UPDATE public.vehicles
        SET status = 'sucio',
            current_reservation_id = NULL,
            last_status_change = now()
        WHERE id = v_vehicle_id;
        
        -- Create cleaning tasks
        PERFORM public.create_cleaning_tasks_for_vehicle(v_vehicle_id);

      -- Escoba/Limpieza completed: just update location if available
      WHEN 'escoba', 'limpieza' THEN
        -- No status change, location update handled below
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on movement status change
DROP TRIGGER IF EXISTS on_movement_completed ON public.vehicle_movements;
CREATE TRIGGER on_movement_completed
AFTER UPDATE OF status ON public.vehicle_movements
FOR EACH ROW
WHEN (NEW.status = 'completado' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_vehicle_from_movement();

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: Garatech (repairs) connected with vehicle availability
-- ─────────────────────────────────────────────────────────────────────────────

-- Add is_in_repair flag to vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_in_repair boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_repair_id uuid REFERENCES public.repairs(id) ON DELETE SET NULL;

-- Function: When a repair status changes, update vehicle flag
CREATE OR REPLACE FUNCTION public.sync_vehicle_repair_status()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_id uuid;
BEGIN
  -- repairs.vehicle_id can reference fleet_vehicles, so we need to find the operational vehicle
  IF NEW.vehicle_id IS NOT NULL THEN
    -- First try direct match (if vehicle_id points to vehicles table)
    SELECT id INTO v_vehicle_id
    FROM public.vehicles
    WHERE id = NEW.vehicle_id
      AND (is_archived = false OR is_archived IS NULL);

    -- If not found, try via fleet_vehicle_id link
    IF v_vehicle_id IS NULL THEN
      SELECT id INTO v_vehicle_id
      FROM public.vehicles
      WHERE fleet_vehicle_id = NEW.vehicle_id
        AND (is_archived = false OR is_archived IS NULL)
      LIMIT 1;
    END IF;
  END IF;

  IF v_vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update repair status based on repair state
  IF NEW.status IN ('pending', 'in_progress', 'scheduled') THEN
    UPDATE public.vehicles
    SET is_in_repair = true,
        current_repair_id = NEW.id
    WHERE id = v_vehicle_id;
  ELSIF NEW.status IN ('completed', 'cancelled') THEN
    -- Check if there are other active repairs for this vehicle
    IF NOT EXISTS (
      SELECT 1 FROM public.repairs
      WHERE vehicle_id = NEW.vehicle_id
        AND id != NEW.id
        AND status IN ('pending', 'in_progress', 'scheduled')
    ) THEN
      UPDATE public.vehicles
      SET is_in_repair = false,
          current_repair_id = NULL
      WHERE id = v_vehicle_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on repair status changes
DROP TRIGGER IF EXISTS on_repair_status_changed ON public.repairs;
CREATE TRIGGER on_repair_status_changed
AFTER INSERT OR UPDATE OF status ON public.repairs
FOR EACH ROW
EXECUTE FUNCTION public.sync_vehicle_repair_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: Auto-generation of tasks from operational events
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new trigger types to automation_rules if they exist
-- These allow users to configure automatic task creation from events
DO $$
BEGIN
  -- Check if automation_rules table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules' AND table_schema = 'public') THEN
    -- Add new trigger_type values if the column allows it
    -- The automation_rules table already supports custom trigger types
    NULL;
  END IF;
END $$;

-- Function: Create a task when a vehicle enters 'sucio' status
-- This integrates the task system with vehicle operations
CREATE OR REPLACE FUNCTION public.auto_create_task_on_vehicle_dirty()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_task_area_id uuid;
BEGIN
  -- Only trigger when status changes TO 'sucio'
  IF NEW.status = 'sucio' AND (OLD.status IS NULL OR OLD.status != 'sucio') THEN
    v_org_id := NEW.organization_id;
    
    -- Find the "Preparación" or "Limpieza" area, or the default area
    SELECT id INTO v_task_area_id
    FROM public.areas
    WHERE organization_id = v_org_id
      AND (LOWER(name) LIKE '%preparaci%' OR LOWER(name) LIKE '%limpieza%' OR LOWER(name) LIKE '%cleaning%')
    LIMIT 1;

    -- Only create task if we found a relevant area
    IF v_task_area_id IS NOT NULL THEN
      INSERT INTO public.tasks (
        organization_id,
        area_id,
        title,
        description,
        status,
        priority,
        created_at
      ) VALUES (
        v_org_id,
        v_task_area_id,
        'Preparar vehículo ' || NEW.matricula,
        'El vehículo ' || NEW.matricula || ' (' || COALESCE(NEW.modelo, 'Sin modelo') || ') ha sido devuelto y necesita preparación.',
        'todo',
        'medium',
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_vehicle_needs_cleaning ON public.vehicles;
CREATE TRIGGER on_vehicle_needs_cleaning
AFTER UPDATE OF status ON public.vehicles
FOR EACH ROW
WHEN (NEW.status = 'sucio' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.auto_create_task_on_vehicle_dirty();

-- Function: Create a task when a repair is created
CREATE OR REPLACE FUNCTION public.auto_create_task_on_repair()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_matricula text;
  v_task_area_id uuid;
BEGIN
  -- Get vehicle matricula
  SELECT matricula INTO v_vehicle_matricula
  FROM public.vehicles
  WHERE id = NEW.vehicle_id OR fleet_vehicle_id = NEW.vehicle_id
  LIMIT 1;

  -- Find the "Taller" or "Reparaciones" area
  SELECT id INTO v_task_area_id
  FROM public.areas
  WHERE organization_id = NEW.organization_id
    AND (LOWER(name) LIKE '%taller%' OR LOWER(name) LIKE '%reparaci%' OR LOWER(name) LIKE '%garatech%')
  LIMIT 1;

  IF v_task_area_id IS NOT NULL THEN
    INSERT INTO public.tasks (
      organization_id,
      area_id,
      title,
      description,
      status,
      priority,
      created_at
    ) VALUES (
      NEW.organization_id,
      v_task_area_id,
      'Reparación: ' || COALESCE(v_vehicle_matricula, 'Vehículo') || ' - ' || NEW.repair_type,
      NEW.description,
      'todo',
      CASE WHEN NEW.repair_type = 'urgente' THEN 'high' ELSE 'medium' END,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_repair_created_task ON public.repairs;
CREATE TRIGGER on_repair_created_task
AFTER INSERT ON public.repairs
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_task_on_repair();
