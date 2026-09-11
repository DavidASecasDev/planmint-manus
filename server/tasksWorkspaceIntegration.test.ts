import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const tasksPage = read('client/src/pages/Tasks.tsx');
const workspace = read('client/src/features/tasks/TaskWorkspace.tsx');
const quickCreate = read('client/src/features/tasks/TaskQuickCreateSheet.tsx');
const detail = read('client/src/components/tasks/TaskDetail.tsx');
const calendar = read('client/src/pages/Calendar.tsx');
const calendarCard = read('client/src/components/calendar/CalendarTaskCard.tsx');
const workflow = read('client/src/features/tasks/useTaskWorkspaceWorkflow.ts');

describe('tasks workspace integration contract', () => {
  it('keeps the established routes and exposes the compact workspace views', () => {
    expect(tasksPage).toContain('<TaskWorkspace');
    expect(workspace).toContain("value: 'today'");
    expect(workspace).toContain("value: 'mine'");
    expect(workspace).toContain("value: 'delegated'");
    expect(workspace).toContain("value: 'calendar'");
    expect(workspace).toContain("value: 'completed'");
    expect(workspace).toContain("setView('all')");
    expect(tasksPage).toContain("navigate('/tasks/kanban')");
    expect(tasksPage).toContain("navigate('/tasks/daily')");
  });

  it('creates with a real responsible person and separates collaborators and supervisor', () => {
    expect(quickCreate).toContain('Responsable principal');
    expect(quickCreate).toContain('Colaboradores');
    expect(quickCreate).toContain('Supervisor');
    expect(quickCreate).not.toContain('Persona de ejemplo');
    expect(tasksPage).toContain('setAssignees');
  });

  it('does not bypass optional review when completion is requested from list or detail', () => {
    expect(tasksPage).toContain("if (status === 'completed') await handleRequestCompletion");
    expect(tasksPage).toContain('workflow.requestCompletion.mutateAsync');
    expect(tasksPage).toContain('workflow.reviewCompletion.mutateAsync');
    expect(workspace).toContain("task.review_state === 'pending_review'");
  });

  it('keeps details, subtasks, dependencies, updates and reminders in one panel', () => {
    expect(detail).toContain('<TaskSubtasksPanel');
    expect(detail).toContain('<TaskDependenciesPanel');
    expect(detail).toContain('<TimelineSection');
    expect(detail).toContain('<RemindersSection');
    expect(detail).toContain('<TaskWorkflowPanel');
  });

  it('projects due dates and follow-ups as distinct events from the same task', () => {
    expect(calendar).toContain("calendar_event_kind: 'due'");
    expect(calendar).toContain("calendar_event_kind: 'follow_up'");
    expect(calendarCard).toContain("task.calendar_event_kind === 'follow_up'");
    expect(calendar).toContain('task.next_follow_up_at || task.nextReminderAt');
  });

  it('scopes advanced metadata writes to the organization and an explicit allowlist', () => {
    expect(workflow).toContain(".eq('organization_id', organizationId)");
    expect(workflow).toContain("'next_follow_up_at'");
    expect(workflow).toContain("'review_required'");
    expect(workflow).toContain('no_allowed_fields');
  });

  it('does not introduce external email or WhatsApp sending in the new module', () => {
    const source = [workspace, quickCreate, workflow, tasksPage].join('\n').toLowerCase();
    expect(source).not.toContain('sendemail');
    expect(source).not.toContain('whatsapp');
    expect(source).not.toContain('respond.io');
  });
});
