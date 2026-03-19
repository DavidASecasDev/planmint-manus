import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useBillingActions = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Create checkout session for plan or addon
  const createCheckoutMutation = useMutation({
    mutationFn: async ({ 
      productCode, 
      billingInterval, 
      quantity,
      couponCode 
    }: { 
      productCode: string; 
      billingInterval: 'monthly' | 'annual';
      quantity?: number;
      couponCode?: string;
    }) => {
      // Determine if productCode is a plan or an addon
      const isPlan = productCode.startsWith('plan_');
      const body: Record<string, unknown> = {
        billing_interval: billingInterval,
        coupon_code: couponCode,
      };

      if (isPlan) {
        body.plan = productCode;
      } else {
        // It's an addon — send it in the addons array
        body.addons = [{ code: productCode, quantity: quantity || 1 }];
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al crear checkout');
    },
  });

  // Open customer portal
  const openPortalMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al abrir portal de facturación');
    },
  });

  // Update subscription (change plan, add/remove addons)
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ 
      action,
      productCode,
      billingInterval,
      quantity
    }: { 
      action: 'upgrade' | 'downgrade' | 'add_addon' | 'remove_addon' | 'update_quantity' | 'change_interval';
      productCode?: string;
      billingInterval?: 'monthly' | 'annual';
      quantity?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('update-subscription', {
        body: { action, productCode, billingInterval, quantity },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-items'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success('Suscripción actualizada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar suscripción');
    },
  });

  // Cancel subscription
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ immediately }: { immediately?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { immediately: immediately || false },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-items'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success('Suscripción cancelada. Tendrás acceso hasta el final del período actual.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al cancelar suscripción');
    },
  });

  return {
    createCheckout: createCheckoutMutation.mutate,
    isCreatingCheckout: createCheckoutMutation.isPending,
    openPortal: openPortalMutation.mutate,
    isOpeningPortal: openPortalMutation.isPending,
    updateSubscription: updateSubscriptionMutation.mutate,
    isUpdating: updateSubscriptionMutation.isPending,
    cancelSubscription: cancelSubscriptionMutation.mutate,
    isCanceling: cancelSubscriptionMutation.isPending,
  };
};
