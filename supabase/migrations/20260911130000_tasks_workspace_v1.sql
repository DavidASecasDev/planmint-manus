begin;

alter table public.tasks
  add column if not exists commissioned_at timestamptz,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists review_required boolean not null default false,
  add column if not exists review_state text,
  add column if not exists review_requested_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_return_reason text,
  add column if not exists project_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_review_state_check'
  ) then
    alter table public.tasks add constraint tasks_review_state_check
      check (review_state is null or review_state in ('not_required', 'pending_review', 'returned', 'approved'));
  end if;
end $$;

alter table public.task_assignees
  add column if not exists assignment_role text not null default 'collaborator';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'task_assignees_assignment_role_check'
  ) then
    alter table public.task_assignees add constraint task_assignees_assignment_role_check
      check (assignment_role in ('collaborator', 'supervisor'));
  end if;
end $$;

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint task_dependencies_not_self check (task_id <> depends_on_task_id),
  constraint task_dependencies_unique unique (task_id, depends_on_task_id)
);

create table if not exists public.task_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint task_documents_unique_path unique (task_id, storage_path)
);

create table if not exists public.task_workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'created', 'assigned', 'follow_up_changed', 'completion_requested',
    'completed', 'review_approved', 'review_returned', 'completion_undone'
  )),
  from_status text,
  to_status text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tasks_workspace_org_due_idx
  on public.tasks (organization_id, due_date, status)
  where deleted_at is null;
create index if not exists tasks_workspace_follow_up_idx
  on public.tasks (organization_id, next_follow_up_at)
  where deleted_at is null and next_follow_up_at is not null;
create index if not exists tasks_workspace_supervisor_idx
  on public.tasks (organization_id, supervisor_id, review_state)
  where deleted_at is null and supervisor_id is not null;
create index if not exists task_dependencies_task_idx on public.task_dependencies (task_id);
create index if not exists task_dependencies_depends_idx on public.task_dependencies (depends_on_task_id);
create index if not exists task_documents_task_idx on public.task_documents (task_id, created_at desc);
create index if not exists task_workflow_events_task_idx on public.task_workflow_events (task_id, created_at desc);

alter table public.task_dependencies enable row level security;
alter table public.task_dependencies force row level security;
alter table public.task_documents enable row level security;
alter table public.task_documents force row level security;
alter table public.task_workflow_events enable row level security;
alter table public.task_workflow_events force row level security;

drop policy if exists task_dependencies_select on public.task_dependencies;
create policy task_dependencies_select on public.task_dependencies for select to authenticated
using (
  task_dependencies.organization_id = get_user_organization_id(auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and can_view_task_strict(auth.uid(), t.id))
);
drop policy if exists task_dependencies_write on public.task_dependencies;
create policy task_dependencies_write on public.task_dependencies for all to authenticated
using (
  task_dependencies.organization_id = get_user_organization_id(auth.uid())
  and (
    has_org_role(auth.uid(), task_dependencies.organization_id, array['owner','admin','manager'])
    or has_permission(auth.uid(), task_dependencies.organization_id, 'tasks.update')
  )
)
with check (
  task_dependencies.organization_id = get_user_organization_id(auth.uid())
  and task_dependencies.created_by = auth.uid()
  and exists (
    select 1 from public.tasks task_record
    join public.tasks dependency_record on dependency_record.id = task_dependencies.depends_on_task_id
    where task_record.id = task_dependencies.task_id
      and task_record.organization_id = task_dependencies.organization_id
      and dependency_record.organization_id = task_dependencies.organization_id
  )
);

drop policy if exists task_documents_select on public.task_documents;
create policy task_documents_select on public.task_documents for select to authenticated
using (
  task_documents.organization_id = get_user_organization_id(auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_documents.task_id and can_view_task_strict(auth.uid(), t.id))
);
drop policy if exists task_documents_insert on public.task_documents;
create policy task_documents_insert on public.task_documents for insert to authenticated
with check (
  task_documents.organization_id = get_user_organization_id(auth.uid())
  and task_documents.uploaded_by = auth.uid()
  and exists (select 1 from public.tasks t where t.id = task_documents.task_id and is_task_participant(auth.uid(), t.id))
);
drop policy if exists task_documents_delete on public.task_documents;
create policy task_documents_delete on public.task_documents for delete to authenticated
using (
  task_documents.organization_id = get_user_organization_id(auth.uid())
  and (
    task_documents.uploaded_by = auth.uid()
    or has_org_role(auth.uid(), task_documents.organization_id, array['owner','admin','manager'])
  )
);

drop policy if exists task_workflow_events_select on public.task_workflow_events;
create policy task_workflow_events_select on public.task_workflow_events for select to authenticated
using (
  task_workflow_events.organization_id = get_user_organization_id(auth.uid())
  and exists (select 1 from public.tasks t where t.id = task_workflow_events.task_id and can_view_task_strict(auth.uid(), t.id))
);

revoke insert, update, delete on public.task_workflow_events from anon, authenticated;
grant select on public.task_workflow_events to authenticated;
grant select, insert, update, delete on public.task_dependencies, public.task_documents to authenticated;

create or replace function public.request_task_completion(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_result public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.organization_id <> get_user_organization_id(v_actor) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  if v_actor <> v_task.assigned_to and not has_org_role(v_actor, v_task.organization_id, array['owner','admin','manager']) then
    raise exception 'only_primary_assignee_can_complete' using errcode = '42501';
  end if;

  if v_task.review_required then
    update public.tasks set
      review_state = 'pending_review', review_requested_at = now(),
      review_return_reason = null, updated_at = now()
    where id = p_task_id returning * into v_result;
    insert into public.task_workflow_events
      (organization_id, task_id, actor_id, event_type, from_status, to_status)
    values (v_task.organization_id, p_task_id, v_actor, 'completion_requested', v_task.status, v_task.status);
  else
    update public.tasks set
      status = 'completed', completed_at = now(), review_state = coalesce(review_state, 'not_required'), updated_at = now()
    where id = p_task_id returning * into v_result;
    insert into public.task_workflow_events
      (organization_id, task_id, actor_id, event_type, from_status, to_status)
    values (v_task.organization_id, p_task_id, v_actor, 'completed', v_task.status, 'completed');
  end if;
  return v_result;
end;
$$;

create or replace function public.review_task_completion(
  p_task_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_result public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'return') then raise exception 'invalid_review_decision'; end if;
  if p_decision = 'return' and nullif(btrim(p_reason), '') is null then raise exception 'return_reason_required'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.organization_id <> get_user_organization_id(v_actor) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  if v_actor <> v_task.supervisor_id and v_actor <> v_task.created_by
     and not has_org_role(v_actor, v_task.organization_id, array['owner','admin','manager']) then
    raise exception 'review_not_allowed' using errcode = '42501';
  end if;
  if v_task.review_state <> 'pending_review' then raise exception 'task_not_pending_review'; end if;

  if p_decision = 'approve' then
    update public.tasks set
      status = 'completed', completed_at = now(), review_state = 'approved',
      reviewed_at = now(), reviewed_by = v_actor, review_return_reason = null, updated_at = now()
    where id = p_task_id returning * into v_result;
    insert into public.task_workflow_events
      (organization_id, task_id, actor_id, event_type, from_status, to_status)
    values (v_task.organization_id, p_task_id, v_actor, 'review_approved', v_task.status, 'completed');
  else
    update public.tasks set
      status = 'in_progress', completed_at = null, review_state = 'returned',
      reviewed_at = now(), reviewed_by = v_actor, review_return_reason = btrim(p_reason), updated_at = now()
    where id = p_task_id returning * into v_result;
    insert into public.task_workflow_events
      (organization_id, task_id, actor_id, event_type, from_status, to_status, reason)
    values (v_task.organization_id, p_task_id, v_actor, 'review_returned', v_task.status, 'in_progress', btrim(p_reason));
  end if;
  return v_result;
end;
$$;

create or replace function public.undo_task_completion(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_previous_status text;
  v_result public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.organization_id <> get_user_organization_id(v_actor) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  if v_actor <> v_task.assigned_to and v_actor <> v_task.created_by
     and not has_org_role(v_actor, v_task.organization_id, array['owner','admin','manager']) then
    raise exception 'undo_not_allowed' using errcode = '42501';
  end if;
  if v_task.status <> 'completed' then raise exception 'task_not_completed'; end if;
  select coalesce(from_status, 'in_progress') into v_previous_status
  from public.task_workflow_events
  where task_id = p_task_id and event_type in ('completed','review_approved')
  order by created_at desc limit 1;
  v_previous_status := case when v_previous_status in ('pending','in_progress','blocked') then v_previous_status else 'in_progress' end;
  update public.tasks set
    status = v_previous_status, completed_at = null,
    review_state = case when review_required then 'returned' else 'not_required' end,
    updated_at = now()
  where id = p_task_id returning * into v_result;
  insert into public.task_workflow_events
    (organization_id, task_id, actor_id, event_type, from_status, to_status)
  values (v_task.organization_id, p_task_id, v_actor, 'completion_undone', 'completed', v_previous_status);
  return v_result;
end;
$$;

revoke all on function public.request_task_completion(uuid) from public;
revoke all on function public.review_task_completion(uuid, text, text) from public;
revoke all on function public.undo_task_completion(uuid) from public;
grant execute on function public.request_task_completion(uuid) to authenticated;
grant execute on function public.review_task_completion(uuid, text, text) to authenticated;
grant execute on function public.undo_task_completion(uuid) to authenticated;

commit;
