BEGIN;

ALTER TABLE public.rently_sync_status
  ADD COLUMN IF NOT EXISTS schedule_cron_task_uid varchar(65);

CREATE INDEX IF NOT EXISTS idx_rently_sync_status_schedule_task_uid
  ON public.rently_sync_status(schedule_cron_task_uid)
  WHERE schedule_cron_task_uid IS NOT NULL;

COMMENT ON COLUMN public.rently_sync_status.schedule_cron_task_uid IS
  'Identificador Heartbeat que autoriza la sincronización periódica de reservas Rently para esta organización.';

COMMIT;
