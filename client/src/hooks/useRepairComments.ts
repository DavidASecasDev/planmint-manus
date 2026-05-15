import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { RepairComment } from '@/types/garatech';

export function useRepairComments(repairId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const commentsQuery = useQuery({
    queryKey: ['repair-comments', repairId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('repair_comments')
        .select(`
          *,
          user:profiles!repair_comments_user_id_fkey(name)
        `)
        .eq('repair_id', repairId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RepairComment[];
    },
    enabled: !!repairId,
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      if (!orgId || !profile?.id) throw new Error('No organization');
      
      const { data, error } = await supabaseQuery
        .from('repair_comments')
        .insert({
          repair_id: repairId,
          organization_id: orgId,
          user_id: profile.id,
          text,
        })
        .select()
        .single();

      if (error) throw error;

      // Add history entry
      await supabaseQuery.from('repair_history').insert({
        repair_id: repairId,
        organization_id: orgId,
        user_id: profile.id,
        action: 'comment_added',
        metadata: { comment_id: data.id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-comments', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repair-history', repairId] });
      toast.success('Comentario añadido');
    },
    onError: (error) => {
      console.error('Error adding comment:', error);
      toast.error('Error al añadir el comentario');
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabaseQuery
        .from('repair_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-comments', repairId] });
      toast.success('Comentario eliminado');
    },
    onError: (error) => {
      console.error('Error deleting comment:', error);
      toast.error('Error al eliminar el comentario');
    },
  });

  return {
    comments: commentsQuery.data ?? [],
    isLoading: commentsQuery.isLoading,
    addComment,
    deleteComment,
  };
}
