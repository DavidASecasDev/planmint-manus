import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Trial } from '@/types/billing';
import { toast } from 'sonner';

export const useTrials = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: trials, isLoading, error } = useQuery({
    queryKey: ['trials', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('trials')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Trial[];
    },
    enabled: !!profile?.organization_id,
  });

  const activeTrial = trials?.find(t => t.status === 'active' && new Date(t.ends_at) > new Date());

  const startTrialMutation = useMutation({
    mutationFn: async ({ planCode, durationDays, trialType }: { 
      planCode: string; 
      durationDays: number; 
      trialType: Trial['trial_type'];
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Check if org already had a trial
      const existingTrials = trials?.filter(t => t.trial_type === 'standard');
      if (trialType === 'standard' && existingTrials && existingTrials.length > 0) {
        throw new Error('Esta organización ya ha utilizado el período de prueba');
      }

      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + durationDays);

      const { data, error } = await supabase
        .from('trials')
        .insert({
          organization_id: profile.organization_id,
          trial_type: trialType,
          plan_code: planCode,
          ends_at: endsAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trials'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      toast.success('Período de prueba activado');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al activar prueba');
    },
  });

  const daysRemaining = activeTrial 
    ? Math.max(0, Math.ceil((new Date(activeTrial.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    trials: trials || [],
    activeTrial,
    daysRemaining,
    isLoading,
    error,
    startTrial: startTrialMutation.mutate,
    isStartingTrial: startTrialMutation.isPending,
    canStartStandardTrial: !trials?.some(t => t.trial_type === 'standard'),
  };
};
