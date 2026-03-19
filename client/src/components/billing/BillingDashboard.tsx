import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  Package, 
  Users, 
  AlertTriangle, 
  Clock,
  Sparkles,
  Zap,
  Link2,
  ChevronRight,
  Receipt,
  Calendar
} from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSubscriptionItems } from '@/hooks/useSubscriptionItems';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useTrials } from '@/hooks/useTrials';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { PLAN_DISPLAY_NAMES, PLAN_PRICES } from '@/types/billing';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlanSelector } from './PlanSelector';
import { AddonManager } from './AddonManager';
import { CouponInput } from './CouponInput';

export const BillingDashboard = () => {
  const { entitlements, isPastDue, isTrialing, isCanceled } = useEntitlements();
  const { planItem, addonItems } = useSubscriptionItems();
  const { openPortal, isOpeningPortal } = useBillingActions();
  const { activeTrial, daysRemaining } = useTrials();
  const { members } = useOrganizationMembers();
  const [activeTab, setActiveTab] = useState('overview');

  const seatsUsed = members?.length || 1;
  const seatsTotal = entitlements.limits.seats_total;
  const seatsPercentage = Math.min(100, (seatsUsed / seatsTotal) * 100);

  const statusBadge = () => {
    if (isPastDue) return <Badge variant="destructive">Pago pendiente</Badge>;
    if (isTrialing) return <Badge variant="secondary">Prueba</Badge>;
    if (isCanceled) return <Badge variant="outline">Cancelada</Badge>;
    return <Badge variant="default">Activa</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Past Due Alert */}
      {isPastDue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Pago pendiente</AlertTitle>
          <AlertDescription>
            Tu último pago no se procesó correctamente. Actualiza tu método de pago para evitar la suspensión del servicio.
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4"
              onClick={() => openPortal()}
              disabled={isOpeningPortal}
            >
              Actualizar pago
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Trial Alert */}
      {isTrialing && activeTrial && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Período de prueba activo</AlertTitle>
          <AlertDescription>
            Te quedan {daysRemaining} días de prueba del plan {PLAN_DISPLAY_NAMES[activeTrial.plan_code] || 'Team'}. 
            Suscríbete para no perder acceso a las funciones premium.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="billing">Facturación</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Current Plan Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xl">Plan actual</CardTitle>
                <CardDescription>
                  Tu suscripción y uso actual
                </CardDescription>
              </div>
              {statusBadge()}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{PLAN_DISPLAY_NAMES[`plan_${entitlements.plan}`]}</p>
                  {entitlements.billing_interval && (
                    <p className="text-sm text-muted-foreground">
                      Facturación {entitlements.billing_interval === 'annual' ? 'anual' : 'mensual'}
                    </p>
                  )}
                </div>
                {entitlements.current_period_end && !isTrialing && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Próxima renovación</p>
                    <p className="font-medium">
                      {format(new Date(entitlements.current_period_end), 'dd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                )}
              </div>

              {/* Seats Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Usuarios
                  </span>
                  <span>{seatsUsed} / {seatsTotal}</span>
                </div>
                <Progress value={seatsPercentage} className="h-2" />
                {seatsPercentage >= 90 && (
                  <p className="text-xs text-amber-600">Casi alcanzas el límite de usuarios</p>
                )}
              </div>

              {/* Active Addons */}
              {(entitlements?.addons?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Add-ons activos</p>
                  <div className="flex flex-wrap gap-2">
                    {(entitlements?.addons ?? []).map(addon => (
                      <Badge key={addon} variant="secondary">
                        {PLAN_DISPLAY_NAMES[addon] || addon}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setActiveTab('plan')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  <span>Cambiar plan</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setActiveTab('addons')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span>Gestionar add-ons</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => openPortal()}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span>Método de pago</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <PlanSelector />
        </TabsContent>

        <TabsContent value="addons">
          <AddonManager />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          {/* Coupon Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Código promocional</CardTitle>
              <CardDescription>Aplica un cupón de descuento</CardDescription>
            </CardHeader>
            <CardContent>
              <CouponInput />
            </CardContent>
          </Card>

          {/* Billing Portal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gestión de facturación</CardTitle>
              <CardDescription>
                Accede al portal de facturación para ver facturas, actualizar método de pago o cancelar tu suscripción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => openPortal()} 
                disabled={isOpeningPortal}
                className="w-full sm:w-auto"
              >
                <Receipt className="mr-2 h-4 w-4" />
                Abrir portal de facturación
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
