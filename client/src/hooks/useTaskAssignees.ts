import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string | null;
  team_id: string | null;
  organization_id: string;
  created_at: string;
  user?: {
    id: string;
    name: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export function useTaskAssignees(taskId?: string) {
  const { profile, organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id || profile?.organization_id;

  const { data: assignees = [], isLoading, refetch } = useQuery({
    queryKey: ['task-assignees', taskId],
    queryFn: async (): Promise<TaskAssignee[]> => {
      if (!taskId || !organizationId) return [];

      const { data, error } = await supabase
        .from('task_assignees')
        .select(`
          *,
          user:profiles!task_assignees_user_id_fkey(id, name, avatar_url),
          team:teams!task_assignees_team_id_fkey(id, name, color)
        `)
        .eq('task_id', taskId);

      if (error) {
        console.error('Error fetching task assignees:', error);
        return [];
      }

      return (data || []).map(a => ({
        ...a,
        user: Array.isArray(a.user) ? a.user[0] : a.user,
        team: Array.isArray(a.team) ? a.team[0] : a.team,
      }));
    },
    enabled: !!taskId && !!organizationId,
  });

  const setAssignees = useMutation({
    mutationFn: async ({ taskId: targetTaskId, userIds, teamIds }: { taskId: string; userIds: string[]; teamIds: string[] }) => {
      if (!targetTaskId || !organizationId) throw new Error('Missing task or organization');

      // Delete existing assignees
      const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', targetTaskId);

      if (deleteError) throw deleteError;

      // Insert new assignees
      const inserts = [
        ...userIds.map(userId => ({
          task_id: targetTaskId,
          user_id: userId,
          team_id: null,
          organization_id: organizationId,
        })),
        ...teamIds.map(teamId => ({
          task_id: targetTaskId,
          user_id: null,
          team_id: teamId,
          organization_id: organizationId,
        })),
      ];

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('task_assignees')
          .insert(inserts);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addUserAssignee = useMutation({
    mutationFn: async (userId: string) => {
      if (!taskId || !organizationId) throw new Error('Missing task or organization');

      const { error } = await supabase
        .from('task_assignees')
        .insert({
          task_id: taskId,
          user_id: userId,
          organization_id: organizationId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addTeamAssignee = useMutation({
    mutationFn: async (teamId: string) => {
      if (!taskId || !organizationId) throw new Error('Missing task or organization');

      const { error } = await supabase
        .from('task_assignees')
        .insert({
          task_id: taskId,
          team_id: teamId,
          organization_id: organizationId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeAssignee = useMutation({
    mutationFn: async (assigneeId: string) => {
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('id', assigneeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    assignees,
    isLoading,
    refetch,
    setAssignees: setAssignees.mutateAsync,
    addUserAssignee: addUserAssignee.mutate,
    addTeamAssignee: addTeamAssignee.mutate,
    removeAssignee: removeAssignee.mutate,
    isUpdating: setAssignees.isPending,
  };
}
