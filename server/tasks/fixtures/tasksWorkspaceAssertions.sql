do $$
declare
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_other_org uuid := '00000000-0000-0000-0000-000000000002';
  v_manager uuid := '10000000-0000-0000-0000-000000000001';
  v_employee uuid := '10000000-0000-0000-0000-000000000002';
  v_helper uuid := '10000000-0000-0000-0000-000000000003';
  v_other uuid := '10000000-0000-0000-0000-000000000004';
  v_cleaning uuid := '20000000-0000-0000-0000-000000000001';
  v_itv uuid := '20000000-0000-0000-0000-000000000002';
  v_legacy uuid := '20000000-0000-0000-0000-000000000003';
  v_row public.tasks%rowtype;
begin
  insert into public.organizations(id, name) values (v_org, 'Fixture Azul'), (v_other_org, 'Fixture Other');
  insert into public.profiles(id, organization_id, role, name) values
    (v_manager, v_org, 'manager', 'Supervisor Fixture'),
    (v_employee, v_org, 'member', 'Empleado Fixture'),
    (v_helper, v_org, 'member', 'Colaborador Fixture'),
    (v_other, v_other_org, 'manager', 'Otro Fixture');
  insert into public.tasks(id, organization_id, title, status, created_by, assigned_to, due_date, review_required, supervisor_id, commissioned_at)
  values
    (v_cleaning, v_org, 'Limpiar y verificar vehículo', 'pending', v_manager, v_employee, '2026-09-11', true, v_manager, '2026-09-11T08:00:00Z'),
    (v_itv, v_org, 'Pedir documentos antes de reservar ITV', 'in_progress', v_manager, v_employee, null, false, null, '2026-09-11T08:00:00Z'),
    (v_legacy, v_org, 'Estado histórico', 'legacy_waiting', v_manager, v_employee, null, false, null, null);
  insert into public.task_assignees(task_id, user_id) values (v_cleaning, v_helper);

  update public.tasks
  set due_date = '2026-09-12', next_follow_up_at = '2026-09-11T14:00:00Z', project_name = 'Preparación diaria'
  where id = v_cleaning;
  if not exists (
    select 1 from public.tasks
    where id = v_cleaning and due_date = '2026-09-12' and next_follow_up_at = '2026-09-11T14:00:00Z' and project_name = 'Preparación diaria'
  ) then raise exception 'planning_update_failed'; end if;

  update public.tasks set due_date = null where id = v_itv;
  if not exists (select 1 from public.tasks where id = v_itv and due_date is null and status <> 'completed') then
    raise exception 'undated_task_was_resolved';
  end if;

  update public.tasks set due_date = '2026-09-10' where id = v_legacy;
  if not exists (select 1 from public.tasks where id = v_legacy and due_date < '2026-09-11' and status = 'legacy_waiting') then
    raise exception 'overdue_legacy_task_changed';
  end if;

  perform set_config('request.jwt.claim.sub', v_helper::text, true);
  begin
    perform public.request_task_completion(v_cleaning);
    raise exception 'collaborator_was_allowed_to_complete';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  v_row := public.request_task_completion(v_cleaning);
  if v_row.review_state <> 'pending_review' or v_row.status <> 'pending' then
    raise exception 'cleaning_review_request_failed';
  end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_row := public.review_task_completion(v_cleaning, 'return', 'Repetir cristales');
  if v_row.review_state <> 'returned' or v_row.status <> 'in_progress' or v_row.review_return_reason <> 'Repetir cristales' then
    raise exception 'cleaning_return_failed';
  end if;

  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  v_row := public.request_task_completion(v_cleaning);
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_row := public.review_task_completion(v_cleaning, 'approve', null);
  if v_row.review_state <> 'approved' or v_row.status <> 'completed' or v_row.completed_at is null then
    raise exception 'cleaning_approval_failed';
  end if;

  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  v_row := public.request_task_completion(v_itv);
  if v_row.status <> 'completed' or v_row.review_state <> 'not_required' then
    raise exception 'direct_completion_failed';
  end if;
  v_row := public.undo_task_completion(v_itv);
  if v_row.status <> 'in_progress' or v_row.completed_at is not null then
    raise exception 'undo_completion_failed';
  end if;

  select * into v_row from public.tasks where id = v_legacy;
  if v_row.status <> 'legacy_waiting' or v_row.commissioned_at is not null then
    raise exception 'legacy_state_or_history_was_reinterpreted';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.request_task_completion(v_itv);
    raise exception 'cross_organization_completion_allowed';
  exception when no_data_found then null;
  end;

  if (select count(*) from public.task_workflow_events where task_id = v_cleaning) <> 4 then
    raise exception 'workflow_history_not_preserved';
  end if;
  if (select status from public.tasks where id = v_itv) <> 'in_progress' then
    raise exception 'itv_dependency_flow_was_closed';
  end if;
end $$;

do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing from (values
    ('commissioned_at'), ('next_follow_up_at'), ('supervisor_id'), ('review_required'), ('review_state'),
    ('review_requested_at'), ('reviewed_at'), ('reviewed_by'), ('review_return_reason'), ('project_name')
  ) expected(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'tasks' and c.column_name = expected.column_name
  );
  if v_missing <> 0 then raise exception 'missing_workspace_columns:%', v_missing; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('task_dependencies','task_documents','task_workflow_events') and c.relrowsecurity and c.relforcerowsecurity) <> 3 then
    raise exception 'new_tables_missing_forced_rls';
  end if;
end $$;

select 'TASKS_WORKSPACE_FIXTURE_OK' as result;
