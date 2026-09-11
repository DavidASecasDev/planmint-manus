import { useMemo, useState } from 'react';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Columns3,
  Filter,
  Inbox,
  LayoutList,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Area } from '@/types/areas';
import type { TaskWithRelations } from '@/types/tasks';
import {
  buildTodayAgenda,
  canReviewTask,
  filterTasksForWorkspace,
  getTaskDisplayStatus,
  getTaskFollowUpAt,
  type RoutineAgendaItem,
  type TaskWorkspaceView,
  type WorkspaceTask,
} from './taskWorkspaceDomain';

interface MemberOption { id: string; name: string }

interface TaskWorkspaceProps {
  tasks: WorkspaceTask[];
  routines: RoutineAgendaItem[];
  loading: boolean;
  actorId: string;
  actorRole?: string | null;
  members: MemberOption[];
  areas: Area[];
  canCreate: boolean;
  workflowAvailable: boolean;
  workflowUnavailableReason?: string | null;
  onCreate: () => void;
  onOpenTask: (task: TaskWithRelations) => void;
  onNavigateCalendar: () => void;
  onNavigateKanban: () => void;
  onNavigateRoutines: () => void;
  onNavigateReminders: () => void;
  onRequestCompletion: (task: WorkspaceTask) => Promise<void>;
  onReview: (task: WorkspaceTask, decision: 'approve' | 'return', reason?: string) => Promise<void>;
  onUndoCompletion: (task: WorkspaceTask) => Promise<void>;
  onToggleRoutine: (routine: RoutineAgendaItem) => void;
}

const NAV_ITEMS: { value: TaskWorkspaceView; label: string; icon: typeof Inbox }[] = [
  { value: 'today', label: 'Hoy', icon: Inbox },
  { value: 'mine', label: 'Mis tareas', icon: UserRound },
  { value: 'delegated', label: 'Delegadas', icon: UsersRound },
  { value: 'calendar', label: 'Calendario', icon: CalendarDays },
  { value: 'completed', label: 'Hechas', icon: CheckCircle2 },
];

const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

function formatTaskDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  return format(parseISO(value), 'd MMM', { locale: es });
}

function formatTaskDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return format(parseISO(value), "d MMM · HH:mm", { locale: es });
}

function TaskRow({
  task,
  actorId,
  actorRole,
  workflowAvailable,
  onOpen,
  onRequestCompletion,
  onReview,
  onUndo,
}: {
  task: WorkspaceTask;
  actorId: string;
  actorRole?: string | null;
  workflowAvailable: boolean;
  onOpen: () => void;
  onRequestCompletion: () => Promise<void>;
  onReview: (decision: 'approve' | 'return', reason?: string) => Promise<void>;
  onUndo: () => Promise<void>;
}) {
  const [reviewDialog, setReviewDialog] = useState<'approve' | 'return' | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const followUp = formatTaskDateTime(getTaskFollowUpAt(task));
  const overdue = Boolean(task.due_date && task.status !== 'completed' && isPast(parseISO(`${task.due_date}T23:59:59`)));
  const reviewer = canReviewTask(task, { id: actorId, role: actorRole });
  const canFinish = task.assigned_to === actorId || ['owner', 'admin', 'manager'].includes(actorRole ?? '');

  return (
    <>
      <div className="group grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-2 py-2.5 transition-colors hover:bg-muted/35 sm:grid-cols-[auto_minmax(0,1fr)_160px_118px_145px_auto]">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void onRequestCompletion()}
          disabled={!canFinish || task.status === 'completed' || task.review_state === 'pending_review' || (task.review_required === true && !workflowAvailable)}
          aria-label={task.status === 'completed' ? `${task.title}, completada` : `Marcar ${task.title} como terminada`}
        >
          {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
        </button>

        <button type="button" onClick={onOpen} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])} aria-hidden="true" />
            <span className={cn('truncate text-sm font-medium', task.status === 'completed' && 'text-muted-foreground line-through')}>{task.title}</span>
            {task.review_state === 'pending_review' && <Badge className="shrink-0 bg-violet-100 text-violet-700 hover:bg-violet-100">Revisar</Badge>}
            {task.review_state === 'returned' && <Badge variant="destructive" className="shrink-0">Devuelta</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
            <span>{task.assignee?.name || 'Sin responsable'}</span>
            <span className={cn(overdue && 'font-medium text-destructive')}>{formatTaskDate(task.due_date)}</span>
            {followUp && <span>Seguimiento {followUp}</span>}
          </div>
        </button>

        <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground">
            {(task.assignee?.name || '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{task.assignee?.name || 'Sin responsable'}</span>
        </div>
        <span className={cn('hidden text-xs sm:block', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>{formatTaskDate(task.due_date)}</span>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-xs font-medium">{getTaskDisplayStatus(task)}</p>
          {followUp && <p className="truncate text-[11px] text-muted-foreground">Seguimiento {followUp}</p>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones de ${task.title}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Abrir detalle</DropdownMenuItem>
            {task.review_state === 'pending_review' && reviewer && workflowAvailable && (
              <>
                <DropdownMenuItem onClick={() => setReviewDialog('approve')}>Validar tarea</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReviewDialog('return')}>Devolver con motivo</DropdownMenuItem>
              </>
            )}
            {task.status === 'completed' && workflowAvailable && (
              <DropdownMenuItem onClick={() => void onUndo()}><RotateCcw className="mr-2 h-4 w-4" />Deshacer cierre</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={reviewDialog !== null} onOpenChange={open => !open && setReviewDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reviewDialog === 'approve' ? 'Validar tarea' : 'Devolver tarea'}</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewDialog === 'approve'
                ? `Confirmas que “${task.title}” está verificada y puede cerrarse.`
                : `La tarea volverá a En curso. Indica qué debe corregirse en “${task.title}”.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {reviewDialog === 'return' && (
            <Textarea
              value={returnReason}
              onChange={event => setReturnReason(event.target.value)}
              placeholder="Motivo de devolución"
              aria-label="Motivo de devolución"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reviewDialog === 'return' && returnReason.trim().length === 0}
              onClick={() => {
                if (!reviewDialog) return;
                void onReview(reviewDialog, returnReason);
                setReviewDialog(null);
                setReturnReason('');
              }}
            >
              {reviewDialog === 'approve' ? 'Validar y cerrar' : 'Devolver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: 'danger' | 'primary' | 'muted';
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section aria-labelledby={`section-${title}`} className="overflow-hidden rounded-lg border bg-card">
      <div className="flex h-10 items-center justify-between border-b bg-muted/25 px-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', tone === 'danger' ? 'bg-red-500' : tone === 'primary' ? 'bg-emerald-500' : 'bg-slate-400')} />
          <h2 id={`section-${title}`} className="text-sm font-semibold">{title}</h2>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

export function TaskWorkspace(props: TaskWorkspaceProps) {
  const [view, setView] = useState<TaskWorkspaceView>('today');
  const [search, setSearch] = useState('');
  const [personId, setPersonId] = useState('all');
  const [areaId, setAreaId] = useState('all');
  const [projectName, setProjectName] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const tasksMatchingControls = useMemo(() => {
    let items = [...props.tasks];
    const query = search.trim().toLocaleLowerCase('es');
    if (query) items = items.filter(task => `${task.title} ${task.description ?? ''}`.toLocaleLowerCase('es').includes(query));
    if (personId !== 'all') items = items.filter(task => task.assigned_to === personId || task.assignees?.users.some(user => user.id === personId));
    if (areaId !== 'all') items = items.filter(task => task.areas.some(area => area.id === areaId));
    if (projectName !== 'all') items = items.filter(task => task.project_name === projectName);
    return items;
  }, [areaId, personId, projectName, props.tasks, search]);

  const visibleTasks = useMemo(
    () => filterTasksForWorkspace(tasksMatchingControls, view, props.actorId),
    [props.actorId, tasksMatchingControls, view],
  );

  const projects = useMemo(() => Array.from(new Set(props.tasks.map(task => task.project_name).filter((value): value is string => Boolean(value)))).sort(), [props.tasks]);
  const personalTodayTasks = useMemo(
    () => tasksMatchingControls.filter(task => task.created_by === props.actorId || task.assigned_to === props.actorId || task.assignees?.users.some(user => user.id === props.actorId)),
    [props.actorId, tasksMatchingControls],
  );
  const agenda = useMemo(() => buildTodayAgenda(personalTodayTasks, props.routines, new Date()), [personalTodayTasks, props.routines]);

  const renderRows = (tasks: WorkspaceTask[]) => tasks.map(task => (
    <TaskRow
      key={task.id}
      task={task}
      actorId={props.actorId}
      actorRole={props.actorRole}
      workflowAvailable={props.workflowAvailable}
      onOpen={() => props.onOpenTask(task)}
      onRequestCompletion={() => props.onRequestCompletion(task)}
      onReview={(decision, reason) => props.onReview(task, decision, reason)}
      onUndo={() => props.onUndoCompletion(task)}
    />
  ));

  const handleView = (nextView: TaskWorkspaceView) => {
    if (nextView === 'calendar') {
      props.onNavigateCalendar();
      return;
    }
    setView(nextView);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px]">
      <header className="mb-4 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Agenda y encargos</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tu trabajo y los encargos al equipo, en una sola vista.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={props.onNavigateKanban}><Columns3 className="mr-2 h-4 w-4" />Kanban</Button>
          <Button variant="outline" size="sm" onClick={props.onNavigateRoutines}><RefreshCw className="mr-2 h-4 w-4" />Rutinas</Button>
          {props.canCreate && <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={props.onCreate}><Plus className="mr-2 h-4 w-4" />Nueva tarea</Button>}
        </div>
      </header>

      {!props.workflowAvailable && props.workflowUnavailableReason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{props.workflowUnavailableReason} La agenda legacy sigue disponible; revisión, supervisor y seguimiento avanzado quedan en modo lectura.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav aria-label="Vistas de tareas" className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 lg:block lg:space-y-1 lg:p-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = view === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleView(item.value)}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full',
                  active ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <div className="hidden border-t pt-2 lg:mt-2 lg:block">
            <button type="button" onClick={() => setView('all')} className={cn('flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-medium', view === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <LayoutList className="h-4 w-4" />Todas
            </button>
            <button type="button" onClick={props.onNavigateReminders} className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Clock3 className="h-4 w-4" />Recordatorios
            </button>
          </div>
        </nav>

        <main className="min-w-0">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar tareas" className="h-9 pl-9" />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />Filtros
            </Button>
          </div>

          {filtersOpen && (
            <div className="mb-3 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3">
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger className="h-9" aria-label="Filtrar por persona"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas las personas</SelectItem>{props.members.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger className="h-9" aria-label="Filtrar por área"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas las áreas</SelectItem>{props.areas.filter(area => !area.is_archived).map(area => <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={projectName} onValueChange={setProjectName}>
                <SelectTrigger className="h-9" aria-label="Filtrar por proyecto"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos los proyectos</SelectItem>{projects.map(project => <SelectItem key={project} value={project}>{project}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {props.loading ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Cargando tareas…</div>
          ) : view === 'today' ? (
            <div className="space-y-3">
              <Section title="Atrasadas" count={agenda.overdue.length} tone="danger">{renderRows(agenda.overdue)}</Section>
              <Section title="Para hoy" count={agenda.dueToday.length} tone="primary">{renderRows(agenda.dueToday)}</Section>
              <Section title="Seguimientos" count={agenda.followUps.length} tone="primary">{renderRows(agenda.followUps)}</Section>
              <Section title="Rutinas" count={agenda.routines.length} tone="muted">
                {agenda.routines.map(routine => (
                  <div key={routine.id} className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b px-3 py-2.5 last:border-0">
                    <button type="button" onClick={() => props.onToggleRoutine(routine)} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${routine.completed ? 'Desmarcar' : 'Completar'} rutina ${routine.title}`}>
                      {routine.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div className="min-w-0"><p className={cn('truncate text-sm font-medium', routine.completed && 'line-through text-muted-foreground')}>{routine.title}</p><p className="text-xs text-muted-foreground">Rutina de hoy</p></div>
                    <Badge variant="outline">Rutina</Badge>
                  </div>
                ))}
              </Section>
              <Section title="Sin fecha" count={agenda.undated.length} tone="muted">{renderRows(agenda.undated)}</Section>
              {agenda.overdue.length + agenda.dueToday.length + agenda.followUps.length + agenda.routines.length + agenda.undated.length === 0 && (
                <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center"><Check className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-3 font-semibold">Todo al día</h2><p className="mt-1 text-sm text-muted-foreground">No hay tareas ni seguimientos pendientes para hoy.</p></div>
              )}
            </div>
          ) : visibleTasks.length > 0 ? (
            <section className="overflow-hidden rounded-lg border bg-card">
              <div className="hidden h-9 grid-cols-[auto_minmax(0,1fr)_160px_118px_145px_auto] items-center gap-3 border-b bg-muted/30 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span /><span>Tarea</span><span>Responsable</span><span>Plazo</span><span>Estado / seguimiento</span><span />
              </div>
              {renderRows(visibleTasks)}
            </section>
          ) : (
            <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center"><Filter className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No hay tareas en esta vista</h2><p className="mt-1 text-sm text-muted-foreground">Prueba otra vista o limpia los filtros.</p></div>
          )}

          <div className="mt-3 flex justify-end sm:hidden">
            <Button variant="ghost" size="sm" onClick={() => setView('all')}>Ver todas <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </main>
      </div>
    </div>
  );
}
