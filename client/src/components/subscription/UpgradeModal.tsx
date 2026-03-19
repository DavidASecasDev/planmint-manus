import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Users, Zap, Loader2 } from 'lucide-react';
import { PlanType, PLAN_NAMES, PLAN_DESCRIPTIONS } from '@/types/subscription';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitMessage?: string;
  suggestedPlan?: PlanType;
}

export const UpgradeModal = ({
  open,
  onOpenChange,
  limitMessage,
  suggestedPlan = 'pro',
}: UpgradeModalProps) => {
  const { currentPlan, isAdmin } = useSubscription();
  const { trackUpgradeClicked } = useUsageTracking();
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);

  const handleUpgrade = async (plan: PlanType) => {
    trackUpgradeClicked();
    
    if (!isAdmin) {
      toast.error('Solo el administrador puede cambiar el plan');
      return;
    }

    setLoadingPlan(plan);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: `plan_${plan}` },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Error al iniciar el proceso de pago');
      setLoadingPlan(null);
    }
  };

  const planIcons: Record<PlanType, React.ReactNode> = {
    free: <Zap className="h-5 w-5" />,
    pro: <Crown className="h-5 w-5" />,
    team: <Users className="h-5 w-5" />,
  };

  const planPrices: Record<PlanType, string> = {
    free: '0€',
    pro: '9€',
    team: '29€',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>Actualiza tu plan</DialogTitle>
          </div>
          <DialogDescription>
            {limitMessage || 'Desbloquea más funciones actualizando tu plan.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {(['pro', 'team'] as PlanType[])
            .filter((plan) => plan !== currentPlan)
            .map((plan) => (
              <div
                key={plan}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  plan === suggestedPlan
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {plan === suggestedPlan && (
                  <Badge className="absolute -top-2 right-4 bg-primary">
                    Recomendado
                  </Badge>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {planIcons[plan]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Plan {PLAN_NAMES[plan]}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {PLAN_DESCRIPTIONS[plan]}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-foreground">{planPrices[plan]}</span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {plan === 'pro' && (
                    <>
                      <li>✓ Hasta 5 usuarios</li>
                      <li>✓ Tareas, áreas y etiquetas ilimitadas</li>
                      <li>✓ Recordatorios recurrentes</li>
                      <li>✓ Resúmenes con IA</li>
                    </>
                  )}
                  {plan === 'team' && (
                    <>
                      <li>✓ Usuarios ilimitados</li>
                      <li>✓ Todo lo de Pro</li>
                      <li>✓ Insights y alertas con IA</li>
                      <li>✓ Soporte prioritario</li>
                    </>
                  )}
                </ul>

                <Button
                  className="w-full mt-4"
                  variant={plan === suggestedPlan ? 'default' : 'outline'}
                  onClick={() => handleUpgrade(plan)}
                  disabled={loadingPlan !== null || !isAdmin}
                >
                  {loadingPlan === plan ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : isAdmin ? (
                    `Actualizar a ${PLAN_NAMES[plan]} - ${planPrices[plan]}/mes`
                  ) : (
                    'Solo el admin puede cambiar el plan'
                  )}
                </Button>
              </div>
            ))}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Pago seguro con Stripe. Puedes cancelar en cualquier momento.
        </p>
      </DialogContent>
    </Dialog>
  );
};
