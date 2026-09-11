create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.organizations (
  id uuid primary key,
  name text not null
);
create table public.profiles (
  id uuid primary key,
  organization_id uuid references public.organizations(id),
  role text not null default 'member',
  name text
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null,
  description text,
  type text not null default 'simple',
  status text not null default 'pending',
  priority text not null default 'medium',
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id),
  team_id uuid,
  created_at timestamptz not null default now()
);

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on public.tasks, public.task_assignees to authenticated;

create or replace function public.get_user_organization_id(_user_id uuid)
returns uuid language sql stable as $$ select organization_id from public.profiles where id = _user_id $$;
create or replace function public.has_org_role(p_user_id uuid, p_organization_id uuid, p_roles text[])
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles where id = p_user_id and organization_id = p_organization_id and role = any(p_roles))
$$;
create or replace function public.has_permission(p_user_id uuid, p_organization_id uuid, p_permission text)
returns boolean language sql stable as $$
  select public.has_org_role(p_user_id, p_organization_id, array['owner','admin','manager'])
$$;
create or replace function public.is_task_participant(p_user_id uuid, p_task_id uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.tasks t where t.id = p_task_id and (t.created_by = p_user_id or t.assigned_to = p_user_id)
  )
$$;
create or replace function public.can_view_task_strict(_user_id uuid, _task_id uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.tasks t
    where t.id = _task_id and t.organization_id = public.get_user_organization_id(_user_id)
      and (public.is_task_participant(_user_id, _task_id) or public.has_org_role(_user_id, t.organization_id, array['owner','admin','manager']))
  )
$$;

