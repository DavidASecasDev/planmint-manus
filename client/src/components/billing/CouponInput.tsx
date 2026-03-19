import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Loader2, Tag } from 'lucide-react';
import { useCoupons } from '@/hooks/useCoupons';
import { useBillingActions } from '@/hooks/useBillingActions';
import { CouponValidation, PLAN_DISPLAY_NAMES } from '@/types/billing';

const AVAILABLE_PLANS = ['plan_pro', 'plan_team'] as const;

export const CouponInput = () => {
  const [code, setCode] = useState('');
  const [validation, setValidation] = useState<CouponValidation | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const { validateCoupon, isValidating, redeemForPlan, isRedeemingForPlan, redemptions } = useCoupons();
  const { createCheckout, isCreatingCheckout } = useBillingActions();

  const handleValidate = async () => {
    if (!code.trim()) return;
    const result = await validateCoupon(code.trim());
    setValidation(result);
    setSelectedPlan('');
  };

  const getApplicablePlans = () => {
    if (!validation?.coupon) return AVAILABLE_PLANS;
    const applicable = validation.coupon.applicable_products_json;
    if (!applicable || applicable.length === 0 || applicable.includes('all_plans')) {
      return AVAILABLE_PLANS;
    }
    return AVAILABLE_PLANS.filter(p => applicable.includes(p));
  };

  const handleApply = async () => {
    if (!validation?.valid || !validation.coupon || !selectedPlan) return;

    try {
      const result = await redeemForPlan({ couponCode: code.trim(), planCode: selectedPlan });

      if (result.action === 'checkout') {
        // Partial discount: redirect to Stripe checkout with coupon
        createCheckout({
          productCode: selectedPlan,
          billingInterval: 'monthly',
          couponCode: result.stripe_coupon_id || result.coupon_code,
        });
      }

      // If 'activated', the hook already shows success toast and refreshes
      setCode('');
      setValidation(null);
      setSelectedPlan('');
    } catch {
      // Error handled by mutation
    }
  };

  const formatDiscount = (coupon: CouponValidation['coupon']) => {
    if (!coupon) return '';
    if (coupon.discount_type === 'percent') {
      return `${coupon.discount_value}% de descuento`;
    }
    return `${coupon.discount_value}${coupon.currency?.toUpperCase() || '€'} de descuento`;
  };

  const formatDuration = (coupon: CouponValidation['coupon']) => {
    if (!coupon) return '';
    switch (coupon.duration) {
      case 'once':
        return 'primera factura';
      case 'repeating':
        return `${coupon.duration_months} meses`;
      case 'forever':
        return 'para siempre';
      default:
        return '';
    }
  };

  const isFullDiscount = validation?.coupon?.discount_type === 'percent' && validation?.coupon?.discount_value >= 100;
  const applicablePlans = getApplicablePlans();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Introduce tu código"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setValidation(null);
            setSelectedPlan('');
          }}
          className="flex-1"
        />
        <Button 
          onClick={handleValidate} 
          disabled={!code.trim() || isValidating}
          variant="outline"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Validar'
          )}
        </Button>
      </div>

      {/* Validation Result */}
      {validation && (
        <div className={`p-4 rounded-lg border ${
          validation.valid 
            ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
            : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
        }`}>
          {validation.valid && validation.coupon ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">{formatDiscount(validation.coupon)}</p>
                  <p className="text-sm text-muted-foreground">
                    Aplicable a {formatDuration(validation.coupon)}
                    {isFullDiscount && ' — Activación directa sin pago'}
                  </p>
                </div>
              </div>

              {/* Plan selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Selecciona el plan al que aplicar el cupón:</p>
                <div className="flex gap-2">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {applicablePlans.map(plan => (
                        <SelectItem key={plan} value={plan}>
                          {PLAN_DISPLAY_NAMES[plan]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleApply} 
                    disabled={!selectedPlan || isRedeemingForPlan || isCreatingCheckout} 
                    size="default"
                  >
                    {isRedeemingForPlan || isCreatingCheckout ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isFullDiscount ? (
                      'Activar plan'
                    ) : (
                      'Aplicar y pagar'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <X className="h-5 w-5 text-red-600" />
              <p className="text-sm">{validation.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Applied Coupons */}
      {redemptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Cupones aplicados</p>
          <div className="flex flex-wrap gap-2">
            {redemptions.map((redemption) => (
              <Badge key={redemption.id} variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {(redemption as { coupon?: { code?: string } }).coupon?.code || 'Cupón'}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
