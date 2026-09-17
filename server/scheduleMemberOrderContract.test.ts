import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260917111600_schedule_member_order_replace.sql'),
  'utf8',
);
const rollback = fs.readFileSync(
  path.join(root, 'supabase/rollbacks/20260917111600_schedule_member_order_replace.rollback.sql'),
  'utf8',
);
const endpoint = fs.readFileSync(path.join(root, 'server/scheduleEndpoints.ts'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'client/src/pages/Schedules.tsx'), 'utf8');

describe('weekly schedule member order contract', () => {
  it('scopes replacement to organization, team and week and validates the full active team', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.replace_schedule_member_order');
    expect(migration).toContain('ordered_member_count_mismatch');
    expect(migration).toContain('ordered_user_not_active_team_member');
    expect(migration).toContain('DELETE FROM public.schedule_member_order');
    expect(migration).toContain('organization_id = p_organization_id');
    expect(migration).toContain('team_id = p_team_id');
    expect(migration).toContain('week_start = p_week_start');
  });

  it('cannot modify staff schedules or time entries', () => {
    expect(migration).not.toMatch(/(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.staff_schedules/i);
    expect(migration).not.toMatch(/(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.time_entries/i);
  });

  it('is service-role only and has an exact conservative rollback', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.replace_schedule_member_order(uuid, uuid, date, uuid[], uuid, text)',
    );
  });

  it('the endpoint requires schedule-management permission and delegates one atomic replacement', () => {
    const handler = endpoint.slice(
      endpoint.indexOf('export async function handleReorderTeamMembers'),
      endpoint.indexOf('// ─── Schedule Week Publication'),
    );
    expect(handler).toContain('requireAnyPermission');
    expect(handler).toContain('schedules.manage');
    expect(handler).toContain('schedules.assign');
    expect(handler).toContain('replace_schedule_member_order');
    expect(handler).not.toContain('.from("schedule_member_order")');
    expect(handler).not.toContain('.upsert(');
  });

  it('the interface preserves authoritative weekly order and validates displayed counts', () => {
    expect(ui).toContain('customOrderTeamIds.has(t.team_id)');
    expect(ui).toContain('memberOrderValidation');
    expect(ui).toContain('validation.member_count !== team.members.length');
    expect(ui).toContain('validation.displayed_count !== team.members.length');
  });
});
