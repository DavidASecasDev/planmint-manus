BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS marca text;

COMMENT ON COLUMN public.reservations.marca IS
  'Marca del vehículo importada desde Rently o mantenida por PlanMint; puede quedar nula si la fuente no la aporta.';

NOTIFY pgrst, 'reload schema';

COMMIT;
