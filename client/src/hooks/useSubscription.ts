import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Subscription, PlanType } from '@/types/subscription';
import { toast } from 'sonner';

export const useSubscription = () => {
  const { profile } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!profile?.organization_id,
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (newPlan: PlanType) => {
      if (!profile?.organization_id) throw new Error('No organization');
      // Use permission engine instead of profile.role
      if (!hasPermission('billing.manage')) throw new Error('No tienes permiso para cambiar planes');

      const { error } = await supabase
        .from('subscriptions')
        .update({ plan: newPlan, status: 'active' })
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return newPlan;
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success(`Plan actualizado a ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}`);
    },
    onError: (error) => {
      console.error('Error updating plan:', error);
      toast.error('No se pudo actualizar el plan');
    },
  });

  const currentPlan: PlanType = subscription?.plan as PlanType || 'free';
  const isProPlan = currentPlan === 'pro' || currentPlan === 'team';
  const isTeamPlan = currentPlan === 'team';

  return {
    subscription,
    currentPlan,
    isLoading,
    error,
    updatePlan: updatePlanMutation.mutate,
    isUpdating: updatePlanMutation.isPending,
    isAdmin,
    isProPlan,
    isTeamPlan,
  };
};
