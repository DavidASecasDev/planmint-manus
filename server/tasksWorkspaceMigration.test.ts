import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260911130000_tasks_workspace_v1.sql'),
  'utf8',
);

describe('tasks workspace migration contract', () => {
  it('is additive and does not rewrite historical task rows', () => {
    const installationSql = migration.split('create or replace function public.request_task_completion')[0];
    expect(installationSql).not.toMatch(/\b(drop\s+table|truncate|delete\s+from|update\s+public\.tasks\s+set)\b/i);
    expect(migration).not.toMatch(/\b(drop\s+table|truncate|delete\s+from)\b/i);
    expect(migration).toContain('add column if not exists commissioned_at');
    expect(migration).toContain('add column if not exists next_follow_up_at');
    expect(migration).toContain('add column if not exists review_required');
  });

  it('keeps history, dependencies and document metadata in additive tables', () => {
    expect(migration).toContain('create table if not exists public.task_workflow_events');
    expect(migration).toContain('create table if not exists public.task_dependencies');
    expect(migration).toContain('create table if not exists public.task_documents');
    expect(migration).toContain("metadata jsonb not null default '{}'::jsonb");
  });

  it('uses authenticated RPC transitions with role and organization checks', () => {
    expect(migration).toContain('function public.request_task_completion');
    expect(migration).toContain('function public.review_task_completion');
    expect(migration).toContain('function public.undo_task_completion');
    expect(migration).toContain('get_user_organization_id(v_actor)');
    expect(migration).toContain("array['owner','admin','manager']");
    expect(migration).toContain('only_primary_assignee_can_complete');
  });

  it('forces RLS on every new table and does not grant workflow-event writes', () => {
    for (const table of ['task_dependencies', 'task_documents', 'task_workflow_events']) {
      expect(migration).toContain(`alter table public.${table} force row level security`);
    }
    expect(migration).toContain('revoke insert, update, delete on public.task_workflow_events from anon, authenticated');
  });
});
