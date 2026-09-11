import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Subtask } from '@/types/subtasks';

export function TaskSubtasksPanel({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();
  const queryKey = ['task-subtasks', taskId];
  const { data: subtasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('task_subtasks').select('*').eq('task_id', taskId).order('sort_order');
      if (error) throw error;
      return (data ?? []) as Subtask[];
    },
    enabled: Boolean(taskId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const create = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;
      const { error } = await supabase.from('task_subtasks').insert({ task_id: taskId, title: cleanTitle, sort_order: subtasks.length });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(''); void invalidate(); },
    onError: () => toast.error('No se pudo añadir la subtarea.'),
  });
  const toggle = useMutation({
    mutationFn: async (subtask: Subtask) => {
      const { error } = await supabase.from('task_subtasks').update({ status: subtask.status === 'done' ? 'pending' : 'done' }).eq('id', subtask.id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error('No se pudo actualizar la subtarea.'),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_subtasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error('No se pudo eliminar la subtarea.'),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando pasos…</p>;
  const completed = subtasks.filter(subtask => subtask.status === 'done').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><h3 className="text-sm font-semibold">Subtareas</h3><p className="text-xs text-muted-foreground">{completed} de {subtasks.length} completadas</p></div>
        {subtasks.length > 0 && <span className="text-xs font-medium tabular-nums">{Math.round((completed / subtasks.length) * 100)}%</span>}
      </div>
      <div className="space-y-1">
        {subtasks.map(subtask => (
          <div key={subtask.id} className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => toggle.mutate(subtask)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${subtask.status === 'done' ? 'Reabrir' : 'Completar'} subtarea ${subtask.title}`}
            >
              {subtask.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </button>
            <span className={cn('flex-1 text-sm', subtask.status === 'done' && 'text-muted-foreground line-through')}>{subtask.title}</span>
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove.mutate(subtask.id)} aria-label={`Eliminar subtarea ${subtask.title}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {subtasks.length === 0 && <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No hay subtareas. Completar una subtarea nunca cierra automáticamente el encargo.</p>}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Input value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); create.mutate(); } }} placeholder="Añadir subtarea" className="h-8" />
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => create.mutate()} disabled={!title.trim() || create.isPending} aria-label="Añadir subtarea"><Plus className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

