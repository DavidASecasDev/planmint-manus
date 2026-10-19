-- Conservative rollback for 20261019120000_vehicle_plate_identity.sql and
-- 20261019120500_vehicle_plate_identity_unique.sql. NOT executed automatically.
--
-- Order to undo the 9772 NNS consolidation, if ever needed:
--   1. Drop the normalized unique index (step 1 below).
--   2. SELECT * FROM public.revert_vehicle_identity_merge(
--        '<organization_id>', '<alias_record_id>', '<actor_user_id>', '<role>', '<reason>');
--      This moves back exactly the history rows recorded in moved_history_ids
--      and restores the alias archive flags from the stored snapshot.
--   3. Optionally restore the original trigger function (step 2 below).
-- The private table public.vehicle_identity_aliases is intentionally kept: it
-- is the audit evidence and snapshot of the consolidation. No rows are deleted.

BEGIN;

-- 1. Remove the normalized uniqueness guard.
DROP INDEX IF EXISTS public.vehicles_org_plate_key_active_uidx;

-- 2. Restore the original fleet -> vehicles trigger function (pre-2026-10-19).
CREATE OR REPLACE FUNCTION public.sync_fleet_vehicle_to_vehicles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_existing_id uuid;
  v_target_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_existing_id
    FROM public.vehicles
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
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
    -- Find the specific vehicle linked to this fleet vehicle (by fleet_vehicle_id)
    SELECT id INTO v_target_id
    FROM public.vehicles
    WHERE fleet_vehicle_id = NEW.id
    LIMIT 1;

    IF v_target_id IS NOT NULL THEN
      -- Update only that specific vehicle row
      UPDATE public.vehicles
      SET matricula = UPPER(TRIM(NEW.matricula)),
          modelo = COALESCE(NEW.modelo, modelo),
          categoria = COALESCE(NEW.categoria, categoria),
          updated_at = NOW()
      WHERE id = v_target_id;
    ELSE
      -- Fallback: try to find by old matricula (no fleet_vehicle_id link)
      SELECT id INTO v_target_id
      FROM public.vehicles
      WHERE organization_id = NEW.organization_id
        AND UPPER(TRIM(matricula)) = UPPER(TRIM(OLD.matricula))
        AND fleet_vehicle_id IS NULL
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

    -- Also link any unlinked vehicle with matching new matricula
    UPDATE public.vehicles
    SET fleet_vehicle_id = NEW.id
    WHERE organization_id = NEW.organization_id
      AND UPPER(TRIM(matricula)) = UPPER(TRIM(NEW.matricula))
      AND fleet_vehicle_id IS NULL
      AND id != COALESCE(v_target_id, '00000000-0000-0000-0000-000000000000'::uuid);

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

-- The functions merge_vehicle_identity_alias / revert_vehicle_identity_merge /
-- normalize_vehicle_plate are left installed on purpose (revert needs them and
-- they change no data unless invoked).
