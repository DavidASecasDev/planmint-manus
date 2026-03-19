import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Referral } from '@/types/growth';
import { toast } from 'sonner';

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: referral, isLoading } = useQuery({
    queryKey: ['referral', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Referral | null;
    },
    enabled: !!user?.id,
  });

  const createReferralCode = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Generate code using database function
      const { data: codeData, error: codeError } = await supabase.rpc('generate_referral_code');
      if (codeError) throw codeError;

      const { data, error } = await supabase
        .from('referrals')
        .insert({
          referrer_user_id: user.id,
          code: codeData,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Referral;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral', user?.id] });
      toast.success('Código de referido creado');
    },
    onError: (error) => {
      console.error('Error creating referral code:', error);
      toast.error('Error al crear código de referido');
    },
  });

  const trackClick = async (code: string) => {
    try {
      await supabase.rpc('track_referral_click', { ref_code: code });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  const getReferralUrl = (code: string) => {
    return `${window.location.origin}/ref/${code}`;
  };

  return {
    referral,
    isLoading,
    createReferralCode: createReferralCode.mutate,
    isCreating: createReferralCode.isPending,
    trackClick,
    getReferralUrl,
  };
};
