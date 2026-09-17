BEGIN;

DROP FUNCTION IF EXISTS public.replace_schedule_member_order(uuid, uuid, date, uuid[], uuid, text);

COMMIT;
