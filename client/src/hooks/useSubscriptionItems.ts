import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionItem } from '@/types/billing';
import { toast } from 'sonner';

export const useSubscriptionItems = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['subscription-items', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('subscription_items')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as SubscriptionItem[];
    },
    enabled: !!profile?.organization_id,
  });

  const planItem = items?.find(item => item.product_code.startsWith('plan_'));
  const addonItems = items?.filter(item => item.product_code.startsWith('addon_')) || [];

  return {
    items: items || [],
    planItem,
    addonItems,
    isLoading,
    error,
  };
};
