import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingProductPublic } from '@/types/billing';

export const useBillingProducts = () => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['billing-products-public'],
    queryFn: async () => {
      // Use the public sanitized table (no Stripe IDs exposed)
      const { data, error } = await supabase
        .from('billing_products_public')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as BillingProductPublic[];
    },
  });

  const plans = products?.filter(p => p.type === 'plan') || [];
  const addons = products?.filter(p => p.type === 'addon') || [];

  return {
    products: products || [],
    plans,
    addons,
    isLoading,
    error,
  };
};
