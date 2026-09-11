import type { TaskWithRelations } from '@/types/tasks';

export type TaskWorkspaceView = 'today' | 'mine' | 'delegated' | 'calendar' | 'completed' | 'all';
export type TodaySection = 'overdue' | 'due_today' | 'follow_up' | 'routine' | 'undated';
export type TaskReviewState = 'not_required' | 'pending_review' | 'returned' | 'approved' | null;

export interface TaskWorkflowFields {
  commissioned_at?: string | null;
  next_follow_up_at?: string | null;
  supervisor_id?: string | null;
  supervisor?: { id: string; name: string | null } | null;
  review_required?: boolean | null;
  review_state?: TaskReviewState;
  review_requested_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_return_reason?: string | null;
  project_name?: string | null;
}

export type WorkspaceTask = TaskWithRelations & TaskWorkflowFields & {
  nextReminderAt?: string | null;
  latestUpdate?: { text: string | null; created_at: string } | null;
};

export interface RoutineAgendaItem {
  id: string;
  title: string;
  assignedTo: string | null;
  completed: boolean;
}

export interface TodayAgenda {
  overdue: WorkspaceTask[];
  dueToday: WorkspaceTask[];
  followUps: WorkspaceTask[];
  undated: WorkspaceTask[];
  routines: RoutineAgendaItem[];
}

export interface WorkflowActor {
  id: string;
  role?: string | null;
}

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

function madridParts(value: Date | string): { year: number; month: number; day: number } {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function toMadridDateKey(value: Date | string): string {
  const { year, month, day } = madridParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function madridLocalDateTimeToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Fecha local de Madrid no válida.');
  const desired = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]),
  };
  let candidate = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
    const observedUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'));
    const desiredUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute);
    candidate += desiredUtc - observedUtc;
  }
  const finalParts = formatter.formatToParts(new Date(candidate));
  const finalRead = (type: Intl.DateTimeFormatPartTypes) => Number(finalParts.find(part => part.type === type)?.value);
  if (
    finalRead('year') !== desired.year || finalRead('month') !== desired.month || finalRead('day') !== desired.day
    || finalRead('hour') !== desired.hour || finalRead('minute') !== desired.minute
  ) throw new Error('La hora seleccionada no existe en Europe/Madrid por el cambio horario.');
  return new Date(candidate).toISOString();
}

function dateOnlyKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toMadridDateKey(value);
}

export function getTaskFollowUpAt(task: WorkspaceTask): string | null {
  const candidates = [task.next_follow_up_at, task.nextReminderAt]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return candidates[0] ?? null;
}

export function isTaskCompleted(task: WorkspaceTask): boolean {
  return task.status === 'completed';
}

export function getTaskDisplayStatus(task: WorkspaceTask): string {
  if (task.review_state === 'pending_review') return 'Pendiente de revisar';
  if (task.review_state === 'returned') return 'Devuelta';
  if (task.review_state === 'approved') return 'Validada';
  if (task.status === 'completed') return 'Hecha';
  if (task.status === 'in_progress') return 'En curso';
  if (task.status === 'blocked') return 'Bloqueada';
  if (task.status === 'pending') return 'Pendiente';
  return task.status;
}

export function classifyTaskForToday(
  task: WorkspaceTask,
  now: Date,
): Exclude<TodaySection, 'routine'> | null {
  if (isTaskCompleted(task) || task.is_archived || task.deleted_at) return null;
  const todayKey = toMadridDateKey(now);
  const dueKey = task.due_date ? dateOnlyKey(task.due_date) : null;
  const followUp = getTaskFollowUpAt(task);
  const followUpKey = followUp ? toMadridDateKey(followUp) : null;

  if (dueKey && dueKey < todayKey) return 'overdue';
  if (dueKey === todayKey) return 'due_today';
  if (followUpKey === todayKey) return 'follow_up';
  if (!dueKey) return 'undated';
  return null;
}

function byDueAndPriority(a: WorkspaceTask, b: WorkspaceTask): number {
  const priorityWeight = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
  const aDue = a.due_date ?? '9999-12-31';
  const bDue = b.due_date ?? '9999-12-31';
  return aDue.localeCompare(bDue) || priorityWeight[a.priority] - priorityWeight[b.priority] || a.title.localeCompare(b.title);
}

export function buildTodayAgenda(
  tasks: WorkspaceTask[],
  routines: RoutineAgendaItem[],
  now: Date,
): TodayAgenda {
  const agenda: TodayAgenda = { overdue: [], dueToday: [], followUps: [], undated: [], routines };
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    const section = classifyTaskForToday(task, now);
    if (!section) continue;
    seen.add(task.id);
    if (section === 'overdue') agenda.overdue.push(task);
    if (section === 'due_today') agenda.dueToday.push(task);
    if (section === 'follow_up') agenda.followUps.push(task);
    if (section === 'undated') agenda.undated.push(task);
  }
  agenda.overdue.sort(byDueAndPriority);
  agenda.dueToday.sort(byDueAndPriority);
  agenda.followUps.sort(byDueAndPriority);
  agenda.undated.sort(byDueAndPriority);
  return agenda;
}

export function filterTasksForWorkspace(
  tasks: WorkspaceTask[],
  view: TaskWorkspaceView,
  actorId: string,
): WorkspaceTask[] {
  return tasks.filter(task => {
    const completed = isTaskCompleted(task);
    if (view === 'completed') return completed;
    if (view === 'all' || view === 'calendar') return true;
    if (completed) return false;
    if (view === 'mine' || view === 'today') {
      return task.assigned_to === actorId || task.assignees?.users.some(user => user.id === actorId) === true;
    }
    if (view === 'delegated') {
      return task.created_by === actorId && task.assigned_to !== null && task.assigned_to !== actorId;
    }
    return false;
  });
}

export function canRequestTaskCompletion(task: WorkspaceTask, actor: WorkflowActor): boolean {
  return actor.id === task.assigned_to || MANAGER_ROLES.has(actor.role ?? '');
}

export function canReviewTask(task: WorkspaceTask, actor: WorkflowActor): boolean {
  return actor.id === task.supervisor_id || actor.id === task.created_by || MANAGER_ROLES.has(actor.role ?? '');
}

export function requestTaskCompletion(
  task: WorkspaceTask,
  actor: WorkflowActor,
  at: string,
): WorkspaceTask {
  if (!canRequestTaskCompletion(task, actor)) throw new Error('Solo la persona responsable o un gestor puede terminar la tarea.');
  if (task.review_required) {
    return {
      ...task,
      review_state: 'pending_review',
      review_requested_at: at,
      review_return_reason: null,
      updated_at: at,
    };
  }
  return {
    ...task,
    status: 'completed',
    completed_at: at,
    review_state: task.review_state ?? 'not_required',
    updated_at: at,
  };
}

export function reviewTaskCompletion(
  task: WorkspaceTask,
  actor: WorkflowActor,
  decision: 'approve' | 'return',
  at: string,
  reason?: string,
): WorkspaceTask {
  if (!canReviewTask(task, actor)) throw new Error('Solo el supervisor, solicitante o un gestor puede revisar la tarea.');
  if (task.review_state !== 'pending_review') throw new Error('La tarea no está pendiente de revisión.');
  if (decision === 'return' && !reason?.trim()) throw new Error('Indica el motivo de devolución.');
  return decision === 'approve'
    ? {
        ...task,
        status: 'completed',
        completed_at: at,
        review_state: 'approved',
        reviewed_at: at,
        reviewed_by: actor.id,
        review_return_reason: null,
        updated_at: at,
      }
    : {
        ...task,
        status: 'in_progress',
        completed_at: null,
        review_state: 'returned',
        reviewed_at: at,
        reviewed_by: actor.id,
        review_return_reason: reason!.trim(),
        updated_at: at,
      };
}

export function canCompleteDependencyStep(dependencyStatus: string): boolean {
  return dependencyStatus === 'completed';
}
