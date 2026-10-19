BEGIN;

-- Second step of the 9772 NNS / 9772NNS fix. Apply ONLY after the duplicate
-- has been consolidated. It rewrites no rows: it aborts if any organization
-- still has two active operational vehicles with the same normalized plate,
-- so no other plate is ever deduplicated implicitly.

DO $$
DECLARE
  v_groups integer;
BEGIN
  SELECT count(*) INTO v_groups
    FROM (
      SELECT organization_id, public.normalize_vehicle_plate(matricula)
        FROM public.vehicles
       WHERE is_archived IS NOT TRUE
       GROUP BY 1, 2
      HAVING count(*) > 1
    ) d;
  IF v_groups > 0 THEN
    RAISE EXCEPTION 'vehicle_plate_index_blocked: % active duplicate group(s) remain', v_groups;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_plate_key_active_uidx
  ON public.vehicles (organization_id, public.normalize_vehicle_plate(matricula))
  WHERE is_archived IS NOT TRUE;

COMMIT;
