-- ============================================================================
-- Trigger: Sync fleet_vehicles → vehicles
-- 
-- Purpose: Automatically synchronize fleet_vehicles changes to the operational
-- vehicles table to keep both tables aligned without manual intervention.
--
-- Behavior:
--   INSERT: Creates a new vehicle in 'vehicles' with status 'sucio' and links
--           it via fleet_vehicle_id. If a vehicle with the same matricula already
--           exists in the same org, it updates the link instead.
--   UPDATE: Syncs matricula, modelo, and categoria changes to the linked vehicle.
--   DELETE: Soft-deletes the linked vehicle (is_archived = true).
-- ============================================================================

-- First, ensure fleet_vehicle_id column exists on vehicles table
-- (It exists in the DB but may not be in generated types)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'fleet_vehicle_id'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN fleet_vehicle_id uuid REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_vehicle_id
      ON public.vehicles(fleet_vehicle_id);
  END IF;
END
$$;

-- ============================================================================
-- Function: sync_fleet_vehicle_to_vehicles()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_fleet_vehicle_to_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- ── INSERT ──────────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    -- Check if a vehicle with same org + matricula already exists
    SELECT id INTO v_existing_id
    FROM public.vehicles
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Link existing vehicle to the new fleet record and unarchive if needed
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
      -- Create new operational vehicle linked to the fleet record
      INSERT INTO public.vehicles (
        organization_id,
        matricula,
        modelo,
        categoria,
        status,
        is_archived,
        fleet_vehicle_id,
        created_at,
        updated_at
      ) VALUES (
        NEW.organization_id,
        UPPER(TRIM(NEW.matricula)),
        NEW.modelo,
        NEW.categoria,
        'sucio',
        false,
        NEW.id,
        NOW(),
        NOW()
      );
    END IF;

    RETURN NEW;

  -- ── UPDATE ──────────────────────────────────────────────────────────────
  ELSIF TG_OP = 'UPDATE' THEN
    -- Sync shared fields to the linked operational vehicle
    UPDATE public.vehicles
    SET matricula = UPPER(TRIM(NEW.matricula)),
        modelo = COALESCE(NEW.modelo, modelo),
        categoria = COALESCE(NEW.categoria, categoria),
        updated_at = NOW()
    WHERE fleet_vehicle_id = NEW.id
       OR (
         organization_id = NEW.organization_id
         AND UPPER(TRIM(matricula)) = UPPER(TRIM(OLD.matricula))
         AND fleet_vehicle_id IS NULL
       );

    -- Also link unlinked vehicles that match by matricula
    UPDATE public.vehicles
    SET fleet_vehicle_id = NEW.id
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
      AND fleet_vehicle_id IS NULL;

    RETURN NEW;

  -- ── DELETE ──────────────────────────────────────────────────────────────
  ELSIF TG_OP = 'DELETE' THEN
    -- Soft-delete the linked operational vehicle
    UPDATE public.vehicles
    SET is_archived = true,
        archived_at = NOW(),
        fleet_vehicle_id = NULL,
        updated_at = NOW()
    WHERE fleet_vehicle_id = OLD.id
       OR (
         organization_id = OLD.organization_id
         AND UPPER(TRIM(matricula)) = UPPER(TRIM(OLD.matricula))
         AND fleet_vehicle_id IS NULL
       );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================================
-- Trigger: Attach to fleet_vehicles table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_fleet_to_vehicles ON public.fleet_vehicles;

CREATE TRIGGER trg_sync_fleet_to_vehicles
  AFTER INSERT OR UPDATE OR DELETE
  ON public.fleet_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fleet_vehicle_to_vehicles();

-- ============================================================================
-- Backfill: Link existing fleet_vehicles to vehicles by matching matricula
-- ============================================================================
UPDATE public.vehicles v
SET fleet_vehicle_id = fv.id
FROM public.fleet_vehicles fv
WHERE v.organization_id = fv.organization_id
  AND UPPER(TRIM(v.matricula)) = UPPER(TRIM(fv.matricula))
  AND v.fleet_vehicle_id IS NULL;

-- Also create missing vehicles for fleet records that have no operational match
INSERT INTO public.vehicles (
  organization_id,
  matricula,
  modelo,
  categoria,
  status,
  is_archived,
  fleet_vehicle_id,
  created_at,
  updated_at
)
SELECT
  fv.organization_id,
  UPPER(TRIM(fv.matricula)),
  fv.modelo,
  fv.categoria,
  'sucio',
  false,
  fv.id,
  NOW(),
  NOW()
FROM public.fleet_vehicles fv
WHERE NOT EXISTS (
  SELECT 1 FROM public.vehicles v
  WHERE v.organization_id = fv.organization_id
    AND UPPER(TRIM(v.matricula)) = UPPER(TRIM(fv.matricula))
);
