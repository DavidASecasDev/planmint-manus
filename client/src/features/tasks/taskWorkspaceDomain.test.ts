import { describe, expect, it } from 'vitest';
import {
  buildTodayAgenda,
  classifyTaskForToday,
  filterTasksForWorkspace,
  getTaskDisplayStatus,
  madridLocalDateTimeToIso,
  requestTaskCompletion,
  reviewTaskCompletion,
  type WorkspaceTask,
} from './taskWorkspaceDomain';

function task(overrides: Partial<WorkspaceTask> = {}): WorkspaceTask {
  return {
    id: 'task-1', organization_id: 'org-1', title: 'Tarea', description: null,
    type: 'simple', status: 'pending', priority: 'medium', created_by: 'supervisor-1',
    assigned_to: 'employee-1', due_date: null, is_archived: false,
    created_at: '2026-09-10T08:00:00Z', updated_at: '2026-09-10T08:00:00Z',
    goal_target_value: null, goal_unit: null, operation_type: null, scheduled_at: null,
    location_type: null, location_text: null, location_notes: null, reservation_ref: null,
    customer_name: null, customer_phone: null, vehicle_out_id: null, vehicle_in_id: null,
    deleted_at: null, deleted_by: null, completed_at: null, started_at: null,
    areas: [], tags: [], assignees: { users: [], teams: [] },
    ...overrides,
  } as WorkspaceTask;
}

describe('task workspace domain', () => {
  const now = new Date('2026-09-11T09:00:00+02:00');

  it('clasifica Hoy sin duplicar una tarea que vence y tiene seguimiento hoy', () => {
    const item = task({ due_date: '2026-09-11', next_follow_up_at: '2026-09-11T13:00:00+02:00' });
    const agenda = buildTodayAgenda([item, item], [], now);
    expect(agenda.dueToday.map(task => task.id)).toEqual(['task-1']);
    expect(agenda.followUps).toHaveLength(0);
  });

  it('mantiene visibles las tareas sin fecha y nunca las considera resueltas', () => {
    const item = task({ due_date: null });
    expect(classifyTaskForToday(item, now)).toBe('undated');
    expect(filterTasksForWorkspace([item], 'mine', 'employee-1')).toHaveLength(1);
  });

  it('separa atrasadas, seguimientos y rutinas', () => {
    const overdue = task({ id: 'overdue', due_date: '2026-09-10' });
    const followUp = task({ id: 'follow', due_date: '2026-09-20', next_follow_up_at: '2026-09-11T12:00:00+02:00' });
    const agenda = buildTodayAgenda([followUp, overdue], [{ id: 'routine', title: 'Abrir oficina', assignedTo: null, completed: false }], now);
    expect(agenda.overdue[0].id).toBe('overdue');
    expect(agenda.followUps[0].id).toBe('follow');
    expect(agenda.routines[0].id).toBe('routine');
  });

  it('muestra Delegadas solo cuando el usuario solicitante encargó a otra persona', () => {
    const delegated = task({ id: 'delegated', created_by: 'david', assigned_to: 'employee-1' });
    const own = task({ id: 'own', created_by: 'david', assigned_to: 'david' });
    expect(filterTasksForWorkspace([delegated, own], 'delegated', 'david').map(item => item.id)).toEqual(['delegated']);
  });

  it('permite limpieza con revisión: terminada, pendiente, validada', () => {
    const cleaning = task({ title: 'Limpiar y verificar vehículo', review_required: true, supervisor_id: 'supervisor-1' });
    const requested = requestTaskCompletion(cleaning, { id: 'employee-1', role: 'member' }, '2026-09-11T10:00:00Z');
    expect(requested.status).toBe('pending');
    expect(requested.review_state).toBe('pending_review');
    expect(getTaskDisplayStatus(requested)).toBe('Pendiente de revisar');
    const approved = reviewTaskCompletion(requested, { id: 'supervisor-1', role: 'manager' }, 'approve', '2026-09-11T10:05:00Z');
    expect(approved.status).toBe('completed');
    expect(approved.review_state).toBe('approved');
  });

  it('devuelve un encargo con motivo sin cerrar documentos o dependencias', () => {
    const documents = task({ title: 'Pedir documentos antes de reservar ITV', review_required: true, review_state: 'pending_review', supervisor_id: 'supervisor-1' });
    const returned = reviewTaskCompletion(documents, { id: 'supervisor-1' }, 'return', '2026-09-11T11:00:00Z', 'Falta la ficha técnica');
    expect(returned.status).toBe('in_progress');
    expect(returned.review_state).toBe('returned');
    expect(returned.review_return_reason).toBe('Falta la ficha técnica');
  });

  it('impide que un colaborador no responsable cierre la tarea', () => {
    const delegated = task({ assignees: { users: [{ id: 'helper', name: 'Apoyo' }], teams: [] } });
    expect(() => requestTaskCompletion(delegated, { id: 'helper', role: 'member' }, '2026-09-11T10:00:00Z')).toThrow(/responsable/);
  });

  it('cierra directamente sin revisión y conserva estados históricos desconocidos', () => {
    const direct = requestTaskCompletion(
      task({ status: 'in_progress', review_required: false }),
      { id: 'employee-1', role: 'member' },
      '2026-09-11T10:00:00Z',
    );
    expect(direct.status).toBe('completed');
    expect(direct.review_state).toBe('not_required');
    expect(getTaskDisplayStatus(task({ status: 'legacy_waiting' as WorkspaceTask['status'] }))).toBe('legacy_waiting');
  });

  it('convierte seguimientos con semántica Europe/Madrid y rechaza la hora DST inexistente', () => {
    expect(madridLocalDateTimeToIso('2026-09-11T10:30')).toBe('2026-09-11T08:30:00.000Z');
    expect(() => madridLocalDateTimeToIso('2026-03-29T02:30')).toThrow(/no existe/);
  });
});
