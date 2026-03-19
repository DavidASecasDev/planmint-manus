import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Coupon, CouponRedemption, CouponValidation } from '@/types/billing';
import { toast } from 'sonner';

interface RedeemForPlanResult {
  action?: 'activated' | 'checkout';
  plan_code?: string;
  coupon_code?: string;
  stripe_coupon_id?: string;
  discount_type?: string;
  discount_value?: number;
  message?: string;
  error?: string;
}

export const useCoupons = () => {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: redemptions, isLoading: redemptionsLoading } = useQuery({
    queryKey: ['coupon-redemptions', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select(`
          *,
          coupon:coupons(*)
        `)
        .eq('organization_id', profile.organization_id)
        .order('redeemed_at', { ascending: false });

      if (error) throw error;
      return data as (CouponRedemption & { coupon: Coupon })[];
    },
    enabled: !!profile?.organization_id,
  });

  // Client-side quick validation (UX only, backend is authority)
  const validateCouponMutation = useMutation({
    mutationFn: async (code: string): Promise<CouponValidation> => {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!coupon) {
        return { valid: false, error: 'Código no válido' };
      }

      if (coupon.redeem_by && new Date(coupon.redeem_by) < new Date()) {
        return { valid: false, error: 'Este código ha expirado' };
      }

      if (coupon.max_redemptions) {
        const { count } = await supabase
          .from('coupon_redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('status', 'applied');

        if ((count || 0) >= coupon.max_redemptions) {
          return { valid: false, error: 'Este código ha alcanzado el límite de usos' };
        }
      }

      if (profile?.organization_id) {
        const { data: existingRedemption } = await supabase
          .from('coupon_redemptions')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('coupon_id', coupon.id)
          .eq('status', 'applied')
          .maybeSingle();

        if (existingRedemption) {
          return { valid: false, error: 'Ya has utilizado este código' };
        }
      }

      return { valid: true, coupon: coupon as Coupon };
    },
  });

  // Server-side secure redemption with plan activation
  const redeemForPlanMutation = useMutation({
    mutationFn: async ({ couponCode, planCode }: { couponCode: string; planCode: string }): Promise<RedeemForPlanResult> => {
      const { data, error } = await supabase.rpc('redeem_coupon_for_plan', {
        p_coupon_code: couponCode,
        p_plan_code: planCode,
      });

      if (error) throw error;
      
      const result = data as unknown as RedeemForPlanResult;
      if (result.error) {
        throw new Error(result.message || 'Error al canjear cupón');
      }
      
      return result;
    },
    onSuccess: (data) => {
      if (data.action === 'activated') {
        queryClient.invalidateQueries({ queryKey: ['coupon-redemptions'] });
        queryClient.invalidateQueries({ queryKey: ['entitlements'] });
        queryClient.invalidateQueries({ queryKey: ['subscription-items'] });
        toast.success(data.message || 'Plan activado correctamente');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al canjear cupón');
    },
  });

  // Legacy redeem (kept for backward compat but prefer redeemForPlan)
  const redeemCouponMutation = useMutation({
    mutationFn: async (couponId: string) => {
      if (!profile?.organization_id || !user?.id) {
        throw new Error('No organization or user');
      }

      const { data, error } = await supabase
        .from('coupon_redemptions')
        .insert({
          organization_id: profile.organization_id,
          user_id: user.id,
          coupon_id: couponId,
          status: 'applied',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupon-redemptions'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      toast.success('Cupón aplicado correctamente');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al aplicar cupón');
    },
  });

  return {
    redemptions: redemptions || [],
    isLoading: redemptionsLoading,
    validateCoupon: validateCouponMutation.mutateAsync,
    isValidating: validateCouponMutation.isPending,
    redeemCoupon: redeemCouponMutation.mutate,
    isRedeeming: redeemCouponMutation.isPending,
    redeemForPlan: redeemForPlanMutation.mutateAsync,
    isRedeemingForPlan: redeemForPlanMutation.isPending,
  };
};
