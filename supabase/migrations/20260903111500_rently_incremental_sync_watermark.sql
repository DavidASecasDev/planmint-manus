begin;

alter table public.rently_sync_status
  add column if not exists watermark_updated_at timestamptz,
  add column if not exists last_full_sync_at timestamptz,
  add column if not exists sync_mode text not null default 'full';

alter table public.rently_sync_status
  drop constraint if exists rently_sync_status_sync_mode_check;

alter table public.rently_sync_status
  add constraint rently_sync_status_sync_mode_check
  check (sync_mode in ('full', 'incremental'));

comment on column public.rently_sync_status.watermark_updated_at is
  'Inicio confirmado del último ciclo; updatedSince se solapa 10 minutos para no perder actualizaciones.';
comment on column public.rently_sync_status.last_full_sync_at is
  'Última reconciliación completa; fuerza un barrido full al menos cada 24 horas para incluir legados sin UpdatedOn.';

commit;
