import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Milestone, CreateMilestoneData, UpdateMilestoneData, MilestoneStatus } from '@/types/milestones';
import { toast } from 'sonner';

export function useMilestones(taskId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: milestones = [], isLoading, error } = useQuery({
    queryKey: ['milestones', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('task_milestones')
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      return data as Milestone[];
    },
    enabled: !!taskId,
  });

  // Organize milestones into tree structure
  const milestonesTree = milestones.reduce((acc, milestone) => {
    if (!milestone.parent_milestone_id) {
      const children = milestones.filter(m => m.parent_milestone_id === milestone.id);
      acc.push({ ...milestone, children });
    }
    return acc;
  }, [] as Milestone[]);

  // Calculate progress
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m => m.status === 'done').length;
  const progressPercentage = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const createMilestone = useMutation({
    mutationFn: async (data: CreateMilestoneData) => {
      // Get the max sort_order for siblings
      const siblings = milestones.filter(m => m.parent_milestone_id === (data.parent_milestone_id || null));
      const maxSortOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order)) : -1;
      
      const { data: milestone, error } = await supabase
        .from('task_milestones')
        .insert({
          task_id: data.task_id,
          parent_milestone_id: data.parent_milestone_id || null,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date || null,
          status: 'pending',
          sort_order: maxSortOrder + 1,
          assignee_type: data.assignee_type || null,
          assignee_id: data.assignee_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return milestone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', taskId] });
      toast.success('Hito creado');
    },
    onError: (error) => {
      console.error('Error creating milestone:', error);
      toast.error('Error al crear el hito');
    },
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMilestoneData }) => {
      const { error } = await supabase
        .from('task_milestones')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', taskId] });
    },
    onError: (error) => {
      console.error('Error updating milestone:', error);
      toast.error('Error al actualizar el hito');
    },
  });

  const updateMilestoneStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MilestoneStatus }) => {
      const { error } = await supabase
        .from('task_milestones')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', taskId] });
    },
    onError: (error) => {
      console.error('Error updating milestone status:', error);
      toast.error('Error al cambiar el estado');
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_milestones')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', taskId] });
      toast.success('Hito eliminado');
    },
    onError: (error) => {
      console.error('Error deleting milestone:', error);
      toast.error('Error al eliminar el hito');
    },
  });

  const reorderMilestones = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number; parent_milestone_id: string | null }[]) => {
      // Update each milestone's sort_order
      for (const update of updates) {
        const { error } = await supabase
          .from('task_milestones')
          .update({ 
            sort_order: update.sort_order,
            parent_milestone_id: update.parent_milestone_id 
          })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', taskId] });
    },
    onError: (error) => {
      console.error('Error reordering milestones:', error);
      toast.error('Error al reordenar los hitos');
    },
  });

  return {
    milestones,
    milestonesTree,
    isLoading,
    error,
    totalMilestones,
    completedMilestones,
    progressPercentage,
    createMilestone,
    updateMilestone,
    updateMilestoneStatus,
    deleteMilestone,
    reorderMilestones,
  };
}
