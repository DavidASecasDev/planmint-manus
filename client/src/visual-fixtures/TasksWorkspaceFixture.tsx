import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { addDays, format } from 'date-fns';
import { FileText, History, Link2, Paperclip, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { TaskWorkspace } from '@/features/tasks/TaskWorkspace';
import { TaskQuickCreateSheet, type TaskQuickCreateValues } from '@/features/tasks/TaskQuickCreateSheet';
import { requestTaskCompletion, reviewTaskCompletion, type RoutineAgendaItem, type WorkspaceTask } from '@/features/tasks/taskWorkspaceDomain';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import '@/index.css';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const YESTERDAY = format(addDays(new Date(), -1), 'yyyy-MM-dd');
const TOMORROW = format(addDays(new Date(), 1), 'yyyy-MM-dd');

const members = [
  { id: 'david-fixture', name: 'David (fixture)' },
  { id: 'ana-fixture', name: 'Ana (fixture)' },
  { id: 'leo-fixture', name: 'Leo (fixture)' },
];

const areas = [
  { id: 'prep-fixture', organization_id: 'org-fixture', name: 'Preparación', description: null, color: '#10b981', icon: 'sparkles', is_archived: false, visibility: 'org' as const, created_at: new Date().toISOString() },
  { id: 'admin-fixture', organization_id: 'org-fixture', name: 'Administración', description: null, color: '#3b82f6', icon: 'files', is_archived: false, visibility: 'org' as const, created_at: new Date().toISOString() },
];

function makeTask(overrides: Partial<WorkspaceTask>): WorkspaceTask {
  return {
    id: crypto.randomUUID(), organization_id: 'org-fixture', title: 'Tarea sintética', description: null,
    type: 'simple', status: 'pending', priority: 'medium', created_by: 'david-fixture', assigned_to: 'ana-fixture',
    due_date: TODAY, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_archived: false,
    goal_target_value: null, goal_unit: null, operation_type: null, scheduled_at: null, location_type: null,
    location_text: null, location_notes: null, reservation_ref: null, customer_name: null, customer_phone: null,
    vehicle_out_id: null, vehicle_in_id: null, deleted_at: null, deleted_by: null, started_at: null, completed_at: null,
    areas: [areas[0]], tags: [], assignees: { users: [], teams: [] }, creator: { id: 'david-fixture', name: 'David (fixture)' },
    assignee: { id: 'ana-fixture', name: 'Ana (fixture)' },
    commissioned_at: new Date().toISOString(), next_follow_up_at: null, supervisor_id: 'david-fixture',
    supervisor: { id: 'david-fixture', name: 'David (fixture)' }, review_required: false, review_state: 'not_required',
    review_requested_at: null, reviewed_at: null, reviewed_by: null, review_return_reason: null, project_name: null,
    ...overrides,
  } as WorkspaceTask;
}

const initialTasks: WorkspaceTask[] = [
  makeTask({
    id: 'cleaning-fixture', title: 'Limpiar y verificar vehículo antes de entrega', due_date: TODAY,
    priority: 'high', review_required: true, review_state: null, project_name: 'Entregas de hoy',
    next_follow_up_at: `${TODAY}T12:30:00+02:00`, latestUpdate: { text: 'Pendiente de comprobación final', created_at: new Date().toISOString() },
  }),
  makeTask({
    id: 'itv-fixture', title: 'Pedir documentos antes de reservar ITV', due_date: TOMORROW,
    assigned_to: 'leo-fixture', assignee: { id: 'leo-fixture', name: 'Leo (fixture)' }, priority: 'urgent',
    areas: [areas[1]], project_name: 'ITV septiembre', next_follow_up_at: `${TODAY}T16:00:00+02:00`,
    latestUpdate: { text: 'Solicitada la ficha técnica', created_at: new Date().toISOString() },
  }),
  makeTask({ id: 'overdue-fixture', title: 'Revisar material de limpieza', due_date: YESTERDAY, priority: 'urgent' }),
  makeTask({ id: 'undated-fixture', title: 'Ordenar archivo de proveedores', due_date: null, assigned_to: 'david-fixture', assignee: { id: 'david-fixture', name: 'David (fixture)' }, commissioned_at: null }),
  makeTask({ id: 'done-fixture', title: 'Confirmar disponibilidad de furgoneta', due_date: YESTERDAY, status: 'completed', completed_at: new Date().toISOString(), review_state: 'not_required' }),
];

function FixtureDetail({ task, onClose }: { task: WorkspaceTask | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(task)} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {task && (
          <>
            <SheetHeader><SheetTitle className="pr-8 text-left">{task.title}</SheetTitle></SheetHeader>
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Solicitante</p><p className="mt-1 font-medium">{task.creator?.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Responsable</p><p className="mt-1 font-medium">{task.assignee?.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Vencimiento</p><p className="mt-1 font-medium">{task.due_date || 'Sin fecha'}</p></div>
                <div><p className="text-xs text-muted-foreground">Seguimiento</p><p className="mt-1 font-medium">{task.next_follow_up_at ? 'Hoy' : 'Sin seguimiento'}</p></div>
              </div>
              <section className="rounded-lg border p-4">
                <div className="flex items-center gap-2"><Link2 className="h-4 w-4" /><h3 className="font-semibold">Subtareas y dependencias</h3></div>
                <div className="mt-3 space-y-2 text-sm"><p>○ Recibir documentación</p><p>○ Verificar datos</p><p className="text-xs text-muted-foreground">Completar un paso no cierra los demás.</p></div>
              </section>
              <section className="rounded-lg border p-4">
                <div className="flex items-center gap-2"><Paperclip className="h-4 w-4" /><h3 className="font-semibold">Documentos</h3></div>
                <div className="mt-3 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />ficha-tecnica.pdf</span><Badge variant="outline">Fixture</Badge></div>
              </section>
              <section className="rounded-lg border p-4">
                <div className="flex items-center gap-2"><History className="h-4 w-4" /><h3 className="font-semibold">Última novedad e historial</h3></div>
                <p className="mt-3 text-sm">{task.latestUpdate?.text || 'Sin novedades todavía.'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Datos sintéticos aislados · no se envía ninguna comunicación</p>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TasksWorkspaceFixture() {
  const [tasks, setTasks] = useState(initialTasks);
  const [routines, setRoutines] = useState<RoutineAgendaItem[]>([
    { id: 'routine-fixture', title: 'Abrir y revisar zona de preparación', assignedTo: 'ana-fixture', completed: false },
  ]);
  const fixtureMode = new URLSearchParams(window.location.search);
  const [createOpen, setCreateOpen] = useState(fixtureMode.get('create') === '1');
  const [selectedTask, setSelectedTask] = useState<WorkspaceTask | null>(() => fixtureMode.get('detail') === '1' ? initialTasks[0] : null);
  const actor = useMemo(() => ({ id: 'david-fixture', role: 'manager' }), []);

  const replaceTask = (next: WorkspaceTask) => setTasks(current => current.map(task => task.id === next.id ? next : task));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card px-4 py-2 text-xs text-muted-foreground">
        Preview aislada · datos sintéticos · ninguna escritura en Supabase
      </div>
      <div className="p-3 sm:p-6">
        <TaskWorkspace
          tasks={tasks}
          routines={routines}
          loading={false}
          actorId={actor.id}
          actorRole={actor.role}
          members={members}
          areas={areas}
          canCreate
          workflowAvailable
          onCreate={() => setCreateOpen(true)}
          onOpenTask={task => setSelectedTask(task as WorkspaceTask)}
          onNavigateCalendar={() => toast.info('Calendario mes / semana / día usa estas mismas tareas y seguimientos.')}
          onNavigateKanban={() => toast.info('Kanban existente conservado.')}
          onNavigateRoutines={() => toast.info('Rutinas existentes conservadas.')}
          onNavigateReminders={() => toast.info('Recordatorios existentes conservados.')}
          onRequestCompletion={async task => {
            replaceTask(requestTaskCompletion(task, actor, new Date().toISOString()));
            toast.success(task.review_required ? 'Enviada a revisión.' : 'Tarea completada.');
          }}
          onReview={async (task, decision, reason) => {
            replaceTask(reviewTaskCompletion(task, actor, decision, new Date().toISOString(), reason));
            toast.success(decision === 'approve' ? 'Tarea validada.' : 'Tarea devuelta.');
          }}
          onUndoCompletion={async task => replaceTask({ ...task, status: 'in_progress', completed_at: null, review_state: task.review_required ? 'returned' : 'not_required' })}
          onToggleRoutine={routine => setRoutines(current => current.map(item => item.id === routine.id ? { ...item, completed: !item.completed } : item))}
        />
      </div>
      <TaskQuickCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        areas={areas}
        onOpenFullForm={() => toast.info('El formulario completo legacy se conserva en la aplicación.')}
        onSubmit={async (values: TaskQuickCreateValues) => {
          const assignee = members.find(member => member.id === values.assignedTo) || null;
          setTasks(current => [makeTask({
            id: `created-${Date.now()}`,
            title: values.title,
            description: values.description,
            assigned_to: values.assignedTo,
            assignee,
            due_date: values.dueDate,
            priority: values.priority,
            review_required: values.reviewRequired,
            review_state: values.reviewRequired ? null : 'not_required',
            supervisor_id: values.supervisorId,
            next_follow_up_at: values.nextFollowUpAt,
            project_name: values.projectName,
            areas: areas.filter(area => values.areaIds.includes(area.id)),
            assignees: { users: members.filter(member => values.collaboratorIds.includes(member.id)), teams: [] },
          }), ...current]);
          setCreateOpen(false);
          toast.success('Tarea sintética creada.');
        }}
      />
      <FixtureDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TasksWorkspaceFixture />);
