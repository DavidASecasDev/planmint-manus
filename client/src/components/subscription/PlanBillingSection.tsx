import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Crown, Users, Zap, Check, X, Sparkles, CreditCard, ExternalLink, AlertTriangle, Loader2, CalendarDays } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PlanType, PLAN_NAMES, PLAN_DESCRIPTIONS } from '@/types/subscription';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UpgradeModal } from './UpgradeModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const PlanBillingSection = () => {
  const queryClient = useQueryClient();
  const { currentPlan, subscription, isAdmin, isLoading: subLoading } = useSubscription();
  const { usage, limits, isLoading } = usePlanLimits();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle billing callback from Stripe
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (billing === 'success') {
      toast.success('¡Pago completado! Tu plan se actualizará en unos momentos.');
      searchParams.delete('billing');
      setSearchParams(searchParams);
      // Refresh subscription data without reloading the page
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['entitlements'] });
        queryClient.invalidateQueries({ queryKey: ['plan-limits'] });
      }, 2000);
    } else if (billing === 'canceled') {
      toast.info('Proceso de pago cancelado');
      searchParams.delete('billing');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const planIcons: Record<PlanType, React.ReactNode> = {
    free: <Zap className="h-5 w-5" />,
    pro: <Crown className="h-5 w-5" />,
    team: <Users className="h-5 w-5" />,
  };

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Activo', variant: 'default' },
    trial: { label: 'Prueba', variant: 'secondary' },
    past_due: { label: 'Pago pendiente', variant: 'destructive' },
    cancelled: { label: 'Cancelado', variant: 'outline' },
  };

  const usageItems = [
    { key: 'users', label: 'Usuarios', value: usage.users, limit: limits.maxUsers },
    { key: 'tasks', label: 'Tareas', value: usage.tasks, limit: limits.maxTasks },
    { key: 'areas', label: 'Áreas', value: usage.areas, limit: limits.maxAreas },
    { key: 'tags', label: 'Etiquetas', value: usage.tags, limit: limits.maxTags },
  ];

  const features = [
    { name: 'Usuarios', free: '1', pro: '5', team: '∞' },
    { name: 'Tareas', free: '20', pro: '∞', team: '∞' },
    { name: 'Áreas', free: '2', pro: '∞', team: '∞' },
    { name: 'Etiquetas', free: '5', pro: '∞', team: '∞' },
    { name: 'Recordatorios recurrentes', free: false, pro: true, team: true },
    { name: 'Equipos', free: false, pro: true, team: true },
    { name: 'Resúmenes con IA', free: false, pro: true, team: true },
    { name: 'Insights con IA', free: false, pro: false, team: true },
    { name: 'Kanban', free: true, pro: true, team: true },
    { name: 'Calendario', free: true, pro: true, team: true },
    { name: 'Notificaciones', free: true, pro: true, team: true },
    { name: 'Soporte prioritario', free: false, pro: false, team: true },
  ];

  const handleOpenCustomerPortal = async () => {
    if (!subscription?.stripe_customer_id) {
      toast.error('No tienes una suscripción activa');
      return;
    }

    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Customer portal error:', err);
      toast.error('Error al abrir el portal de facturación');
    } finally {
      setLoadingPortal(false);
    }
  };

  if (isLoading || subLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPaidPlan = currentPlan !== 'free';
  const isPastDue = subscription?.status === 'past_due';
  const isCancelled = subscription?.status === 'cancelled';
  const renewalDate = subscription?.current_period_end 
    ? format(new Date(subscription.current_period_end), "d 'de' MMMM 'de' yyyy", { locale: es })
    : null;

  return (
    <div className="space-y-6">
      {/* Payment Failed Alert */}
      {isPastDue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Problema con tu pago</AlertTitle>
          <AlertDescription>
            No pudimos procesar tu último pago. Por favor, actualiza tu método de pago para mantener tu suscripción activa.
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4"
              onClick={handleOpenCustomerPortal}
              disabled={loadingPortal}
            >
              {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar pago'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cancellation Notice */}
      {isCancelled && renewalDate && (
        <Alert>
          <CalendarDays className="h-4 w-4" />
          <AlertTitle>Suscripción cancelada</AlertTitle>
          <AlertDescription>
            Tu acceso continuará hasta el {renewalDate}. Después de esa fecha, tu plan pasará a Free.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {planIcons[currentPlan]}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plan {PLAN_NAMES[currentPlan]}
                  {subscription?.status && (
                    <Badge variant={statusLabels[subscription.status]?.variant || 'default'}>
                      {statusLabels[subscription.status]?.label || subscription.status}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{PLAN_DESCRIPTIONS[currentPlan]}</CardDescription>
              </div>
            </div>
            {currentPlan !== 'team' && isAdmin && (
              <Button onClick={() => setUpgradeModalOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Actualizar plan
              </Button>
            )}
          </div>
          {isPaidPlan && renewalDate && !isCancelled && (
            <p className="text-sm text-muted-foreground mt-2">
              Próxima renovación: {renewalDate}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uso actual</CardTitle>
          <CardDescription>Tu consumo respecto a los límites del plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {usageItems.map((item) => {
              const isUnlimited = item.limit === null;
              const percentage = isUnlimited ? 0 : Math.min((item.value / item.limit!) * 100, 100);
              const isNearLimit = !isUnlimited && percentage >= 80;
              const isAtLimit = !isUnlimited && percentage >= 100;

              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-medium ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-foreground'}`}>
                      {item.value} / {isUnlimited ? '∞' : item.limit}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <Progress 
                      value={percentage} 
                      className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`}
                    />
                  )}
                  {isUnlimited && (
                    <div className="h-2 bg-primary/20 rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparativa de planes</CardTitle>
          <CardDescription>Elige el plan que mejor se adapte a tus necesidades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Característica</th>
                  <th className="text-center py-3 px-2 font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>Free</span>
                      <span className="text-xs text-muted-foreground">0€/mes</span>
                      {currentPlan === 'free' && <Badge variant="outline" className="text-xs">Actual</Badge>}
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <Crown className="h-4 w-4 text-primary" />
                      <span>Pro</span>
                      <span className="text-xs text-muted-foreground">9€/mes</span>
                      {currentPlan === 'pro' && <Badge variant="outline" className="text-xs">Actual</Badge>}
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <Users className="h-4 w-4 text-primary" />
                      <span>Team</span>
                      <span className="text-xs text-muted-foreground">29€/mes</span>
                      {currentPlan === 'team' && <Badge variant="outline" className="text-xs">Actual</Badge>}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr key={feature.name} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                    <td className="py-3 px-2 text-muted-foreground">{feature.name}</td>
                    <td className="text-center py-3 px-2">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                        )
                      ) : (
                        <span className="text-foreground">{feature.free}</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-2">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                        )
                      ) : (
                        <span className="text-foreground">{feature.pro}</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-2">
                      {typeof feature.team === 'boolean' ? (
                        feature.team ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                        )
                      ) : (
                        <span className="text-foreground">{feature.team}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currentPlan !== 'team' && isAdmin && (
            <>
              <Separator className="my-6" />
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {currentPlan === 'free' && (
                  <>
                    <Button onClick={() => setUpgradeModalOpen(true)} className="gap-2">
                      <Crown className="h-4 w-4" />
                      Actualizar a Pro - 9€/mes
                    </Button>
                    <Button variant="outline" onClick={() => setUpgradeModalOpen(true)} className="gap-2">
                      <Users className="h-4 w-4" />
                      Actualizar a Team - 29€/mes
                    </Button>
                  </>
                )}
                {currentPlan === 'pro' && (
                  <Button onClick={() => setUpgradeModalOpen(true)} className="gap-2">
                    <Users className="h-4 w-4" />
                    Actualizar a Team - 29€/mes
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing Management */}
      {isPaidPlan && subscription?.stripe_customer_id && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Facturación</CardTitle>
            </div>
            <CardDescription>
              Gestiona tu método de pago, facturas y suscripción
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={handleOpenCustomerPortal}
              disabled={loadingPortal}
              className="gap-2"
            >
              {loadingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Gestionar facturación
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Abrirá el portal de Stripe donde podrás cambiar tu tarjeta, ver facturas o cancelar tu suscripción.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Free Plan Billing Placeholder */}
      {!isPaidPlan && (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg text-muted-foreground">Facturación</CardTitle>
            </div>
            <CardDescription>
              Actualiza a Pro o Team para acceder a la gestión de facturación.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
    </div>
  );
};
