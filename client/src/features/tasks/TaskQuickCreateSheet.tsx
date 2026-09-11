import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, FileText, Plus, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Area } from '@/types/areas';
import type { TaskPriority } from '@/types/tasks';

export interface TaskMemberOption {
  id: string;
  name: string;
}

export interface TaskQuickCreateValues {
  title: string;
  description: string;
  assignedTo: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  areaIds: string[];
  collaboratorIds: string[];
  supervisorId: string | null;
  reviewRequired: boolean;
  nextFollowUpAt: string | null;
  projectName: string | null;
  subtasks: string[];
}

interface TaskQuickCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TaskMemberOption[];
  areas: Area[];
  isSaving?: boolean;
  onSubmit: (values: TaskQuickCreateValues) => Promise<void>;
  onOpenFullForm: () => void;
}

const INITIAL_VALUES: TaskQuickCreateValues = {
  title: '',
  description: '',
  assignedTo: null,
  dueDate: null,
  priority: 'medium',
  areaIds: [],
  collaboratorIds: [],
  supervisorId: null,
  reviewRequired: false,
  nextFollowUpAt: null,
  projectName: null,
  subtasks: [],
};

export function TaskQuickCreateSheet({
  open,
  onOpenChange,
  members,
  areas,
  isSaving = false,
  onSubmit,
  onOpenFullForm,
}: TaskQuickCreateSheetProps) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setValues(INITIAL_VALUES);
    setDetailsOpen(false);
    setSubtaskDraft('');
  }, [open]);

  const activeAreas = useMemo(() => areas.filter(area => !area.is_archived), [areas]);
  const canSubmit = values.title.trim().length > 0 && Boolean(values.assignedTo) && Boolean(values.dueDate);

  const toggleCollaborator = (id: string, checked: boolean) => {
    setValues(current => ({
      ...current,
      collaboratorIds: checked
        ? Array.from(new Set(current.collaboratorIds.concat(id)))
        : current.collaboratorIds.filter(value => value !== id),
    }));
  };

  const addSubtask = () => {
    const title = subtaskDraft.trim();
    if (!title) return;
    setValues(current => ({ ...current, subtasks: [...current.subtasks, title] }));
    setSubtaskDraft('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nueva tarea</SheetTitle>
          <SheetDescription>Crea el encargo con lo esencial. Puedes completar el resto después.</SheetDescription>
        </SheetHeader>

        <form
          className="mt-6 space-y-5"
          onSubmit={async event => {
            event.preventDefault();
            if (!canSubmit) return;
            await onSubmit({
              ...values,
              title: values.title.trim(),
              description: values.description.trim(),
              projectName: values.projectName?.trim() || null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="quick-task-title">Título</Label>
            <Input
              id="quick-task-title"
              value={values.title}
              onChange={event => setValues(current => ({ ...current, title: event.target.value }))}
              placeholder="Qué hay que hacer"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Responsable principal</Label>
              <Select
                value={values.assignedTo ?? undefined}
                onValueChange={assignedTo => setValues(current => ({ ...current, assignedTo }))}
              >
                <SelectTrigger aria-label="Responsable principal">
                  <SelectValue placeholder="Seleccionar persona" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-task-due-date">Fecha límite</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="quick-task-due-date"
                  type="date"
                  className="pl-9"
                  value={values.dueDate ?? ''}
                  onChange={event => setValues(current => ({ ...current, dueDate: event.target.value || null }))}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-between border border-dashed"
            onClick={() => setDetailsOpen(value => !value)}
            aria-expanded={detailsOpen}
          >
            Más detalles
            {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {detailsOpen && (
            <div className="space-y-5 rounded-lg border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="quick-task-description">Descripción</Label>
                <Textarea
                  id="quick-task-description"
                  value={values.description}
                  onChange={event => setValues(current => ({ ...current, description: event.target.value }))}
                  placeholder="Contexto, resultado esperado o instrucciones"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={values.priority} onValueChange={priority => setValues(current => ({ ...current, priority: priority as TaskPriority }))}>
                    <SelectTrigger aria-label="Prioridad"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Área</Label>
                  <Select
                    value={values.areaIds[0] ?? undefined}
                    onValueChange={areaId => setValues(current => ({ ...current, areaIds: [areaId] }))}
                  >
                    <SelectTrigger aria-label="Área"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                    <SelectContent>
                      {activeAreas.map(area => <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quick-task-project">Proyecto</Label>
                  <Input
                    id="quick-task-project"
                    value={values.projectName ?? ''}
                    onChange={event => setValues(current => ({ ...current, projectName: event.target.value || null }))}
                    placeholder="Nombre de proyecto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-task-follow-up">Próximo seguimiento</Label>
                  <Input
                    id="quick-task-follow-up"
                    type="datetime-local"
                    value={values.nextFollowUpAt ?? ''}
                    onChange={event => setValues(current => ({ ...current, nextFollowUpAt: event.target.value || null }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Colaboradores</Label>
                <div className="grid max-h-36 gap-2 overflow-y-auto rounded-md border bg-background p-3 sm:grid-cols-2">
                  {members
                    .filter(member => member.id !== values.assignedTo)
                    .map(member => (
                      <label key={member.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={values.collaboratorIds.includes(member.id)}
                          onCheckedChange={checked => toggleCollaborator(member.id, checked === true)}
                        />
                        <span className="truncate">{member.name}</span>
                      </label>
                    ))}
                  {members.length === 0 && <p className="text-sm text-muted-foreground">No hay miembros disponibles.</p>}
                </div>
              </div>

              <div className="space-y-3 rounded-md border bg-background p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={values.reviewRequired}
                    onCheckedChange={checked => setValues(current => ({ ...current, reviewRequired: checked === true }))}
                  />
                  <span>
                    <span className="block text-sm font-medium">Requiere revisión</span>
                    <span className="block text-xs text-muted-foreground">La persona responsable la marca terminada y el supervisor valida o devuelve.</span>
                  </span>
                </label>
                {values.reviewRequired && (
                  <div className="space-y-2">
                    <Label>Supervisor</Label>
                    <Select
                      value={values.supervisorId ?? undefined}
                      onValueChange={supervisorId => setValues(current => ({ ...current, supervisorId }))}
                    >
                      <SelectTrigger aria-label="Supervisor"><SelectValue placeholder="Seleccionar supervisor" /></SelectTrigger>
                      <SelectContent>
                        {members.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Subtareas</Label>
                <div className="flex gap-2">
                  <Input
                    value={subtaskDraft}
                    onChange={event => setSubtaskDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addSubtask();
                      }
                    }}
                    placeholder="Añadir paso"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addSubtask} aria-label="Añadir subtarea">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {values.subtasks.map((subtask, index) => (
                  <div key={`${subtask}-${index}`} className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                    <span>{subtask}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setValues(current => ({ ...current, subtasks: current.subtasks.filter((_, itemIndex) => itemIndex !== index) }))}
                      aria-label={`Quitar subtarea ${subtask}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Los documentos se adjuntan en el panel de detalle después de crear la tarea, conservando el historial y sus autores.</span>
              </div>
            </div>
          )}

          {!canSubmit && (
            <p className="text-xs text-muted-foreground" role="status">Título, responsable y fecha son obligatorios en la creación rápida.</p>
          )}

          <SheetFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={onOpenFullForm}>Formulario completo</Button>
            <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={!canSubmit || isSaving}>{isSaving ? 'Creando…' : 'Crear tarea'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
