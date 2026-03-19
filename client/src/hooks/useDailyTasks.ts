import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';

export interface DailyTaskTemplate {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  weekdays: number[] | null;
  assigned_to: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  assigned_to_profile?: { name: string | null } | null;
}

export interface DailyTaskCompletion {
  id: string;
  organization_id: string;
  template_id: string;
  completed_by: string;
  completed_at: string;
  completion_date: string;
  notes: string | null;
  created_at: string;
  // Joined
  completed_by_profile?: { name: string | null } | null;
}

export interface DailyTaskWithStatus extends DailyTaskTemplate {
  todayCompletion: DailyTaskCompletion | null;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function useDailyTasks(selectedDate?: Date) {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const userId = profile?.id;

  const effectiveDate = selectedDate || new Date();
  const dateString = getDateString(effectiveDate);
  const dayOfWeek = effectiveDate.getDay();

  const canManage = !permissionsLoading && hasPermission('daily_tasks.manage');
  const canComplete = !permissionsLoading && hasPermission('daily_tasks.complete');
  const canViewOtherDays = !permissionsLoading && hasPermission('daily_tasks.view_other_days');

  // Fetch templates + selected date's completions
  const { data, isLoading, error } = useQuery({
    queryKey: ['daily-tasks', orgId, dateString],
    queryFn: async (): Promise<DailyTaskWithStatus[]> => {
      if (!orgId) return [];

      const [templatesRes, completionsRes] = await Promise.all([
        supabase
          .from('daily_task_templates')
          .select(`
            *,
            assigned_to_profile:profiles!daily_task_templates_assigned_to_fkey(name)
          `)
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('daily_task_completions')
          .select(`
            *,
            completed_by_profile:profiles!daily_task_completions_completed_by_fkey(name)
          `)
          .eq('organization_id', orgId)
          .eq('completion_date', dateString),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (completionsRes.error) throw completionsRes.error;

      const completions = completionsRes.data || [];

      return (templatesRes.data || [])
        .filter((template) => {
          if (!template.weekdays || template.weekdays.length === 0) return true;
          return template.weekdays.includes(dayOfWeek);
        })
        .filter((template) => {
          if (canManage) return true;
          return !template.assigned_to || template.assigned_to === userId;
        })
        .map((template) => ({
          ...template,
          todayCompletion: completions.find((c) => c.template_id === template.id) || null,
        }));
    },
    enabled: !!orgId,
  });

  // Complete a daily task
  const completeMutation = useMutation({
    mutationFn: async ({ templateId, notes }: { templateId: string; notes?: string }) => {
      if (!profile?.id || !orgId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('daily_task_completions')
        .insert({
          organization_id: orgId,
          template_id: templateId,
          completed_by: profile.id,
          completion_date: dateString,
          notes: notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', orgId, dateString] });
    },
    onError: (error) => {
      console.error('[useDailyTasks] Complete error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo completar la tarea.',
        variant: 'destructive',
      });
    },
  });

  // Uncomplete a daily task
  const uncompleteMutation = useMutation({
    mutationFn: async (completionId: string) => {
      const { error } = await supabase
        .from('daily_task_completions')
        .delete()
        .eq('id', completionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', orgId, dateString] });
    },
    onError: (error) => {
      console.error('[useDailyTasks] Uncomplete error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo desmarcar la tarea.',
        variant: 'destructive',
      });
    },
  });

  // Create template
  const createTemplateMutation = useMutation({
    mutationFn: async ({ title, description, weekdays, assigned_to }: { title: string; description?: string; weekdays?: number[] | null; assigned_to?: string | null }) => {
      if (!profile?.id || !orgId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('daily_task_templates')
        .insert({
          organization_id: orgId,
          title,
          description: description || null,
          weekdays: weekdays && weekdays.length > 0 ? weekdays : null,
          assigned_to: assigned_to || null,
          created_by: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', orgId] });
      toast({ title: 'Tarea diaria creada' });
    },
    onError: (error) => {
      console.error('[useDailyTasks] Create error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la tarea diaria.',
        variant: 'destructive',
      });
    },
  });

  // Delete (deactivate) template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('daily_task_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', orgId] });
      toast({ title: 'Tarea diaria eliminada' });
    },
    onError: (error) => {
      console.error('[useDailyTasks] Delete error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la tarea.',
        variant: 'destructive',
      });
    },
  });

  // Update template
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, title, description, weekdays, assigned_to }: { id: string; title: string; description?: string; weekdays?: number[] | null; assigned_to?: string | null }) => {
      const { error } = await supabase
        .from('daily_task_templates')
        .update({
          title,
          description: description || null,
          weekdays: weekdays && weekdays.length > 0 ? weekdays : null,
          assigned_to: assigned_to === undefined ? undefined : (assigned_to || null),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', orgId] });
      toast({ title: 'Tarea diaria actualizada' });
    },
    onError: (error) => {
      console.error('[useDailyTasks] Update error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la tarea.',
        variant: 'destructive',
      });
    },
  });

  // Fetch history for a specific date range
  const useHistory = (startDate: string, endDate: string, filterUserId?: string | null) => {
    return useQuery({
      queryKey: ['daily-tasks-history', orgId, startDate, endDate, filterUserId],
      queryFn: async () => {
        if (!orgId) return [];

        let query = supabase
          .from('daily_task_completions')
          .select(`
            *,
            completed_by_profile:profiles!daily_task_completions_completed_by_fkey(name),
            template:daily_task_templates!daily_task_completions_template_id_fkey(title)
          `)
          .eq('organization_id', orgId)
          .gte('completion_date', startDate)
          .lte('completion_date', endDate)
          .order('completion_date', { ascending: false });

        if (filterUserId) {
          query = query.eq('completed_by', filterUserId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
      },
      enabled: !!orgId,
    });
  };

  return {
    tasks: data || [],
    isLoading,
    error,
    canManage,
    canComplete,
    canViewOtherDays,
    completeTask: completeMutation.mutate,
    isCompleting: completeMutation.isPending,
    uncompleteTask: uncompleteMutation.mutate,
    isUncompleting: uncompleteMutation.isPending,
    createTemplate: createTemplateMutation.mutate,
    isCreating: createTemplateMutation.isPending,
    deleteTemplate: deleteTemplateMutation.mutate,
    isDeleting: deleteTemplateMutation.isPending,
    updateTemplate: updateTemplateMutation.mutate,
    isUpdating: updateTemplateMutation.isPending,
    useHistory,
  };
}
