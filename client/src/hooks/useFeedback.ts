import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { UserFeedback } from '@/types/analytics';
import { toast } from 'sonner';

export const useFeedback = () => {
  const { user, profile } = useAuth();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const { data: feedbackList, isLoading } = useQuery({
    queryKey: ['feedback', profile?.organization_id],
    queryFn: async (): Promise<UserFeedback[]> => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as UserFeedback[];
    },
    // Use permissions from RPC instead of profile.role
    enabled: !!profile?.organization_id && isAdmin,
  });

  const submitFeedback = useMutation({
    mutationFn: async ({
      feedbackType,
      message,
    }: {
      feedbackType: 'suggestion' | 'problem' | 'other';
      message: string;
    }) => {
      if (!user?.id || !profile?.organization_id) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.from('user_feedback').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        feedback_type: feedbackType,
        message,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('¡Gracias por tu feedback! 🙌');
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: () => {
      toast.error('Error al enviar el feedback');
    },
  });

  return {
    feedbackList: feedbackList || [],
    isLoading,
    submitFeedback,
  };
};
