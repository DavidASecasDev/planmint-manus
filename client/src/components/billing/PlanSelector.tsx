import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, X } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useTrials } from '@/hooks/useTrials';
import { PLAN_DISPLAY_NAMES, PLAN_PRICES } from '@/types/billing';
import { cn } from '@/lib/utils';
import { CouponInput } from './CouponInput';

const PLAN_FEATURES = {
  plan_free: {
    features: [
      { label: '1 usuario', included: true },
      { label: '20 tareas', included: true },
      { label: '2 áreas', included: true },
      { label: '5 etiquetas', included: true },
      { label: 'Recordatorios únicos', included: true },
      { label: 'Vista Kanban', included: true },
      { label: 'Vista Calendario', included: true },
      { label: 'Resúmenes con IA', included: false },
      { label: 'Automatizaciones', included: false },
      { label: 'SAML/SCIM', included: false },
    ],
  },
  plan_pro: {
    features: [
      { label: '5 usuarios incluidos', included: true },
      { label: 'Tareas ilimitadas', included: true },
      { label: 'Áreas ilimitadas', included: true },
      { label: 'Etiquetas ilimitadas', included: true },
      { label: 'Recordatorios recurrentes', included: true },
      { label: 'Vista Kanban', included: true },
      { label: 'Vista Calendario', included: true },
      { label: 'Resúmenes con IA', included: true },
      { label: 'Hasta 5 automatizaciones', included: true },
      { label: 'SAML/SCIM', included: false },
    ],
  },
  plan_team: {
    features: [
      { label: '10 usuarios incluidos', included: true },
      { label: 'Tareas ilimitadas', included: true },
      { label: 'Áreas ilimitadas', included: true },
      { label: 'Etiquetas ilimitadas', included: true },
      { label: 'Recordatorios recurrentes', included: true },
      { label: 'Vista Kanban', included: true },
      { label: 'Vista Calendario', included: true },
      { label: 'IA completa (insights, alertas)', included: true },
      { label: 'Automatizaciones ilimitadas', included: true },
      { label: 'SAML/SCIM Enterprise', included: true },
    ],
  },
};

export const PlanSelector = () => {
  const { entitlements } = useEntitlements();
  const { createCheckout, isCreatingCheckout } = useBillingActions();
  const { canStartStandardTrial, startTrial, isStartingTrial } = useTrials();
  const [isAnnual, setIsAnnual] = useState(entitlements.billing_interval === 'annual');

  const currentPlan = `plan_${entitlements.plan}`;

  const handleSelectPlan = (planCode: string) => {
    if (planCode === currentPlan) return;
    if (planCode === 'plan_free') return; // Can't downgrade to free via checkout
    
    createCheckout({
      productCode: planCode,
      billingInterval: isAnnual ? 'annual' : 'monthly',
    });
  };

  const handleStartTrial = () => {
    startTrial({
      planCode: 'plan_team',
      durationDays: 14,
      trialType: 'standard',
    });
  };

  const getPrice = (planCode: string) => {
    const prices = PLAN_PRICES[planCode];
    if (!prices) return null;
    return isAnnual ? prices.annual : prices.monthly;
  };

  const getSavings = (planCode: string) => {
    const prices = PLAN_PRICES[planCode];
    if (!prices) return 0;
    const monthlyTotal = prices.monthly * 12;
    const annualTotal = prices.annual;
    return monthlyTotal - annualTotal;
  };

  return (
    <div className="space-y-6">
      {/* Billing Interval Toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={cn(!isAnnual && 'font-semibold')}>
          Mensual
        </Label>
        <Switch
          id="billing-toggle"
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
        />
        <Label htmlFor="billing-toggle" className={cn(isAnnual && 'font-semibold')}>
          Anual
          <Badge variant="secondary" className="ml-2">2 meses gratis</Badge>
        </Label>
      </div>

      {/* Trial Banner */}
      {entitlements.plan === 'free' && canStartStandardTrial && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-semibold">Prueba Team gratis durante 14 días</p>
              <p className="text-sm text-muted-foreground">
                Accede a todas las funciones sin compromiso
              </p>
            </div>
            <Button onClick={handleStartTrial} disabled={isStartingTrial}>
              Iniciar prueba gratuita
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Coupon Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Tienes un cupón de descuento?</CardTitle>
          <CardDescription>Introduce tu código para aplicarlo a un plan</CardDescription>
        </CardHeader>
        <CardContent>
          <CouponInput />
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {(['plan_free', 'plan_pro', 'plan_team'] as const).map((planCode) => {
          const isCurrent = planCode === currentPlan;
          const price = getPrice(planCode);
          const savings = getSavings(planCode);
          const features = PLAN_FEATURES[planCode].features;

          return (
            <Card 
              key={planCode}
              className={cn(
                'relative',
                isCurrent && 'border-primary ring-2 ring-primary/20'
              )}
            >
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Tu plan actual
                </Badge>
              )}
              {planCode === 'plan_team' && !isCurrent && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle>{PLAN_DISPLAY_NAMES[planCode]}</CardTitle>
                <CardDescription>
                  {planCode === 'plan_free' && 'Para uso personal'}
                  {planCode === 'plan_pro' && 'Para profesionales'}
                  {planCode === 'plan_team' && 'Para equipos'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Price */}
                <div>
                  {price !== null ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{price}€</span>
                        <span className="text-muted-foreground">
                          /{isAnnual ? 'año' : 'mes'}
                        </span>
                      </div>
                      {isAnnual && savings > 0 && (
                        <p className="text-sm text-green-600">
                          Ahorras {savings}€/año
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-3xl font-bold">Gratis</div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={cn(!feature.included && 'text-muted-foreground')}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plan actual
                  </Button>
                ) : planCode === 'plan_free' ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plan gratuito
                  </Button>
                ) : (
                  <Button 
                    className="w-full"
                    onClick={() => handleSelectPlan(planCode)}
                    disabled={isCreatingCheckout}
                  >
                    {currentPlan === 'plan_free' ? 'Suscribirse' : 
                     planCode > currentPlan ? 'Upgrade' : 'Cambiar'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
