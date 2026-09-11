import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTaskWorkspaceCapabilities() {
  return useQuery({
    queryKey: ['tasks-workspace-capabilities-v1'],
    queryFn: async () => {
      const { error } = await (supabase.from('tasks') as any)
        .select('id,commissioned_at,next_follow_up_at,review_state')
        .limit(1);
      if (!error) return { workflowV1: true, reason: null as string | null };
      const missingSchema = error.code === '42703' || error.code === 'PGRST204' || /column/i.test(error.message ?? '');
      if (missingSchema) return { workflowV1: false, reason: 'La migración aditiva del rediseño todavía no está aplicada.' };
      throw error;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useTaskWorkspaceWorkflow(organizationId?: string | null) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['all-reminders'] }),
      queryClient.invalidateQueries({ queryKey: ['task-workflow-events'] }),
    ]);
  };

  const requestCompletion = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await (supabase.rpc as any)('request_task_completion', { p_task_id: taskId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
    onError: error => {
      console.error('[tasks-workspace] request completion failed', error);
      toast.error('No se pudo terminar la tarea. Revisa tus permisos o vuelve a intentarlo.');
    },
  });

  const reviewCompletion = useMutation({
    mutationFn: async ({ taskId, decision, reason }: { taskId: string; decision: 'approve' | 'return'; reason?: string }) => {
      const { data, error } = await (supabase.rpc as any)('review_task_completion', {
        p_task_id: taskId,
        p_decision: decision,
        p_reason: reason?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
    onError: error => {
      console.error('[tasks-workspace] review failed', error);
      toast.error('No se pudo registrar la revisión.');
    },
  });

  const undoCompletion = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await (supabase.rpc as any)('undo_task_completion', { p_task_id: taskId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
    onError: error => {
      console.error('[tasks-workspace] undo completion failed', error);
      toast.error('No se pudo deshacer el cierre.');
    },
  });

  const updateWorkflowFields = useMutation({
    mutationFn: async ({ taskId, values }: { taskId: string; values: Record<string, unknown> }) => {
      if (!organizationId) throw new Error('organization_required');
      const allowed = new Set([
        'commissioned_at', 'next_follow_up_at', 'supervisor_id', 'review_required', 'review_state',
        'review_requested_at', 'reviewed_at', 'reviewed_by', 'review_return_reason', 'project_name',
      ]);
      const safeValues = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
      if (Object.keys(safeValues).length === 0) throw new Error('no_allowed_fields');
      const { error } = await (supabase.from('tasks') as any)
        .update(safeValues)
        .eq('id', taskId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: error => {
      console.error('[tasks-workspace] metadata update failed', error);
      toast.error('No se pudieron guardar los datos del encargo.');
    },
  });

  return {
    requestCompletion,
    reviewCompletion,
    undoCompletion,
    updateWorkflowFields,
  };
}
