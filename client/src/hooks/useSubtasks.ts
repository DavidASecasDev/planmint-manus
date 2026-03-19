import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Subtask, CreateSubtaskData, UpdateSubtaskData, SubtaskStatus } from '@/types/subtasks';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'Subtasks' });

export function useSubtasks(taskId: string | null) {
  const queryClient = useQueryClient();

  // Fetch subtasks with React Query
  const { data: subtasks = [], isLoading: loading, refetch: fetchSubtasks } = useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async (): Promise<Subtask[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true });

      if (error) {
        log.error('Error fetching subtasks:', error);
        throw error;
      }

      return (data || []).map(s => ({
        ...s,
        status: s.status as SubtaskStatus
      }));
    },
    enabled: !!taskId,
  });

  // Create subtask mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateSubtaskData): Promise<Subtask> => {
      const maxOrder = subtasks.length > 0 
        ? Math.max(...subtasks.map(s => s.sort_order)) + 1 
        : 0;

      const { data: newSubtask, error } = await supabase
        .from('task_subtasks')
        .insert({
          task_id: data.task_id,
          title: data.title,
          status: 'pending',
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...newSubtask,
        status: newSubtask.status as SubtaskStatus
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
    onError: (error) => {
      log.error('Error creating subtask:', error);
      toast.error('Error al crear la subtarea');
    },
  });

  // Update subtask mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSubtaskData }): Promise<void> => {
      const { error } = await supabase
        .from('task_subtasks')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
    onError: (error) => {
      log.error('Error updating subtask:', error);
      toast.error('Error al actualizar la subtarea');
    },
  });

  // Delete subtask mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('task_subtasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
    onError: (error) => {
      log.error('Error deleting subtask:', error);
      toast.error('Error al eliminar la subtarea');
    },
  });

  // Reorder subtasks mutation
  const reorderMutation = useMutation({
    mutationFn: async ({ activeId, overId }: { activeId: string; overId: string }): Promise<void> => {
      const oldIndex = subtasks.findIndex(s => s.id === activeId);
      const newIndex = subtasks.findIndex(s => s.id === overId);

      if (oldIndex === -1 || newIndex === -1) {
        throw new Error('Invalid subtask IDs');
      }

      const newSubtasks = [...subtasks];
      const [removed] = newSubtasks.splice(oldIndex, 1);
      newSubtasks.splice(newIndex, 0, removed);

      // Update sort_order for all affected subtasks
      const updates = newSubtasks.map((s, index) =>
        supabase
          .from('task_subtasks')
          .update({ sort_order: index })
          .eq('id', s.id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
    },
    onError: (error) => {
      log.error('Error reordering subtasks:', error);
      toast.error('Error al reordenar las subtareas');
    },
  });

  // Helper functions that maintain the original API
  const createSubtask = async (data: CreateSubtaskData): Promise<Subtask | null> => {
    try {
      return await createMutation.mutateAsync(data);
    } catch {
      return null;
    }
  };

  const updateSubtask = async (id: string, data: UpdateSubtaskData): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({ id, data });
      return true;
    } catch {
      return false;
    }
  };

  const toggleSubtask = async (id: string): Promise<boolean> => {
    const subtask = subtasks.find(s => s.id === id);
    if (!subtask) return false;

    const newStatus: SubtaskStatus = subtask.status === 'pending' ? 'done' : 'pending';
    return updateSubtask(id, { status: newStatus });
  };

  const deleteSubtask = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const reorderSubtasks = async (activeId: string, overId: string): Promise<boolean> => {
    try {
      await reorderMutation.mutateAsync({ activeId, overId });
      return true;
    } catch {
      return false;
    }
  };

  // Computed values
  const completedCount = subtasks.filter(s => s.status === 'done').length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return {
    subtasks,
    loading,
    fetchSubtasks,
    createSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
    completedCount,
    totalCount,
    progress,
  };
}
