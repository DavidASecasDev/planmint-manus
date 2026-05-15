import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
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

      const { data, error } = await supabaseQuery
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

      // Generate code client-side instead of broken RPC
      const code = `REF-${user.id.substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data, error } = await supabaseQuery
        .from('referrals')
        .insert({
          referrer_user_id: user.id,
          code,
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
      // Increment click count directly instead of broken RPC
      // The referrals table has a clicks column we can increment
      const { data: ref } = await supabaseQuery
        .from('referrals')
        .select('clicks')
        .eq('code', code)
        .maybeSingle();
      if (ref) {
        await supabaseQuery
          .from('referrals')
          .update({ clicks: (ref.clicks || 0) + 1 })
          .eq('code', code);
      }
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
