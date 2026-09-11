import { useEffect, useState } from 'react';
import { CalendarClock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkspaceTask } from './taskWorkspaceDomain';

export interface TaskWorkflowEditValues {
  dueDate: string | null;
  nextFollowUpAt: string | null;
  projectName: string | null;
  reviewRequired: boolean;
  supervisorId: string | null;
}

function toMadridLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}`;
}

export function TaskWorkflowPanel({
  task,
  members,
  canEdit,
  workflowAvailable,
  onSave,
}: {
  task: WorkspaceTask;
  members: { id: string; name: string }[];
  canEdit: boolean;
  workflowAvailable: boolean;
  onSave: (values: TaskWorkflowEditValues) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [nextFollowUpAt, setNextFollowUpAt] = useState(toMadridLocalInput(task.next_follow_up_at));
  const [projectName, setProjectName] = useState(task.project_name ?? '');
  const [reviewRequired, setReviewRequired] = useState(task.review_required === true);
  const [supervisorId, setSupervisorId] = useState(task.supervisor_id ?? 'none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDueDate(task.due_date ?? '');
    setNextFollowUpAt(toMadridLocalInput(task.next_follow_up_at));
    setProjectName(task.project_name ?? '');
    setReviewRequired(task.review_required === true);
    setSupervisorId(task.supervisor_id ?? 'none');
  }, [task]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-semibold">Planificación y seguimiento</h3></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`due-${task.id}`} className="text-xs">Vencimiento</Label>
          <Input id={`due-${task.id}`} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={!canEdit} className="h-9" />
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setDueDate('')} disabled={!canEdit}>Quitar fecha</button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`follow-up-${task.id}`} className="text-xs">Próximo seguimiento · Madrid</Label>
          <Input id={`follow-up-${task.id}`} type="datetime-local" value={nextFollowUpAt} onChange={event => setNextFollowUpAt(event.target.value)} disabled={!canEdit || !workflowAvailable} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`project-${task.id}`} className="text-xs">Proyecto</Label>
          <Input id={`project-${task.id}`} value={projectName} onChange={event => setProjectName(event.target.value)} disabled={!canEdit || !workflowAvailable} className="h-9" placeholder="Sin proyecto" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Supervisor</Label>
          <Select value={supervisorId} onValueChange={setSupervisorId} disabled={!canEdit || !workflowAvailable || !reviewRequired}>
            <SelectTrigger className="h-9" aria-label="Supervisor"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Sin supervisor</SelectItem>{members.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-start gap-2 rounded-md border px-3 py-2">
        <Checkbox checked={reviewRequired} onCheckedChange={checked => setReviewRequired(checked === true)} disabled={!canEdit || !workflowAvailable} />
        <span><span className="block text-sm font-medium">Requiere revisión</span><span className="block text-xs text-muted-foreground">Terminar no cierra: queda pendiente de validación.</span></span>
      </label>
      {!workflowAvailable && <p className="text-xs text-amber-700">Seguimiento, proyecto y revisión se activan al aplicar la migración aditiva. El vencimiento legacy sí puede editarse.</p>}
      {canEdit && (
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={saving || (reviewRequired && supervisorId === 'none')}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                dueDate: dueDate || null,
                nextFollowUpAt: nextFollowUpAt || null,
                projectName: projectName.trim() || null,
                reviewRequired,
                supervisorId: reviewRequired && supervisorId !== 'none' ? supervisorId : null,
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          <Save className="mr-2 h-4 w-4" />{saving ? 'Guardando…' : 'Guardar planificación'}
        </Button>
      )}
    </div>
  );
}
