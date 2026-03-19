import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Zap, Link2, Users, Plus, Minus, Lock } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSubscriptionItems } from '@/hooks/useSubscriptionItems';
import { useBillingActions } from '@/hooks/useBillingActions';
import { PLAN_DISPLAY_NAMES, PLAN_PRICES, ADDON_ALLOWED_PLANS } from '@/types/billing';
import { useState } from 'react';
import { toast } from 'sonner';

const ADDON_INFO = {
  addon_ai: {
    icon: Sparkles,
    description: 'Resúmenes inteligentes, insights automáticos y alertas con IA',
    color: 'text-purple-500',
  },
  addon_workflows: {
    icon: Zap,
    description: 'Automatizaciones ilimitadas y workflows avanzados',
    color: 'text-amber-500',
  },
  addon_integrations: {
    icon: Link2,
    description: 'API keys, webhooks y integraciones con servicios externos',
    color: 'text-blue-500',
  },
  addon_seats: {
    icon: Users,
    description: 'Usuarios adicionales para tu equipo',
    color: 'text-green-500',
  },
};

export const AddonManager = () => {
  const { entitlements, canAddAddon, isLoading } = useEntitlements();
  const { addonItems, isLoading: itemsLoading } = useSubscriptionItems();
  const { createCheckout, updateSubscription, isCreatingCheckout, isUpdating } = useBillingActions();
  const [extraSeats, setExtraSeats] = useState(() => {
    const seatsAddon = addonItems?.find(item => item.product_code === 'addon_seats');
    return seatsAddon?.quantity || 0;
  });

  // Helper seguro para obtener el intervalo de facturación
  const getBillingKey = (): 'annual' | 'monthly' => {
    return entitlements?.billing_interval === 'annual' ? 'annual' : 'monthly';
  };

  const isAddonActive = (addonCode: string) => {
    return entitlements?.addons?.includes(addonCode) ?? false;
  };

  // Estado de carga
  if (isLoading || itemsLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggleAddon = (addonCode: string) => {
    if (!canAddAddon(addonCode)) {
      const allowedPlans = ADDON_ALLOWED_PLANS[addonCode] || [];
      toast.error(`Este add-on solo está disponible en plan ${allowedPlans.join(' o ')}`);
      return;
    }

    if (isAddonActive(addonCode)) {
      updateSubscription({
        action: 'remove_addon',
        productCode: addonCode,
      });
    } else {
      createCheckout({
        productCode: addonCode,
        billingInterval: entitlements.billing_interval || 'monthly',
      });
    }
  };

  const handleUpdateSeats = () => {
    if (extraSeats === 0 && isAddonActive('addon_seats')) {
      updateSubscription({
        action: 'remove_addon',
        productCode: 'addon_seats',
      });
    } else if (extraSeats > 0) {
      if (isAddonActive('addon_seats')) {
        updateSubscription({
          action: 'update_quantity',
          productCode: 'addon_seats',
          quantity: extraSeats,
        });
      } else {
        createCheckout({
          productCode: 'addon_seats',
          billingInterval: entitlements.billing_interval || 'monthly',
          quantity: extraSeats,
        });
      }
    }
  };

  if (entitlements.plan === 'free') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Add-ons no disponibles</h3>
          <p className="text-muted-foreground mb-4">
            Los add-ons están disponibles a partir del plan Pro
          </p>
          <Button variant="default">Upgrade a Pro</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* AI Pack */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-purple-500/10 ${ADDON_INFO.addon_ai.color}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{PLAN_DISPLAY_NAMES.addon_ai}</CardTitle>
                <CardDescription className="mt-1">
                  {ADDON_INFO.addon_ai.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <span className="font-semibold">
                {PLAN_PRICES.addon_ai[getBillingKey()]}€
              </span>
              <span className="text-muted-foreground text-sm">
                /{getBillingKey() === 'annual' ? 'año' : 'mes'}
              </span>
            </div>
            {canAddAddon('addon_ai') ? (
              <Switch
                checked={isAddonActive('addon_ai')}
                onCheckedChange={() => handleToggleAddon('addon_ai')}
                disabled={isCreatingCheckout || isUpdating}
              />
            ) : (
              <Badge variant="outline">Solo Team</Badge>
            )}
          </CardContent>
        </Card>

        {/* Workflows Pro */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-amber-500/10 ${ADDON_INFO.addon_workflows.color}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{PLAN_DISPLAY_NAMES.addon_workflows}</CardTitle>
                <CardDescription className="mt-1">
                  {ADDON_INFO.addon_workflows.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <span className="font-semibold">
                {PLAN_PRICES.addon_workflows[getBillingKey()]}€
              </span>
              <span className="text-muted-foreground text-sm">
                /{getBillingKey() === 'annual' ? 'año' : 'mes'}
              </span>
            </div>
            {canAddAddon('addon_workflows') ? (
              <Switch
                checked={isAddonActive('addon_workflows')}
                onCheckedChange={() => handleToggleAddon('addon_workflows')}
                disabled={isCreatingCheckout || isUpdating}
              />
            ) : (
              <Badge variant="outline">Solo Team</Badge>
            )}
          </CardContent>
        </Card>

        {/* Integrations Pack */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-blue-500/10 ${ADDON_INFO.addon_integrations.color}`}>
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{PLAN_DISPLAY_NAMES.addon_integrations}</CardTitle>
                <CardDescription className="mt-1">
                  {ADDON_INFO.addon_integrations.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <span className="font-semibold">
                {PLAN_PRICES.addon_integrations[getBillingKey()]}€
              </span>
              <span className="text-muted-foreground text-sm">
                /{getBillingKey() === 'annual' ? 'año' : 'mes'}
              </span>
            </div>
            {canAddAddon('addon_integrations') ? (
              <Switch
                checked={isAddonActive('addon_integrations')}
                onCheckedChange={() => handleToggleAddon('addon_integrations')}
                disabled={isCreatingCheckout || isUpdating}
              />
            ) : (
              <Badge variant="outline">Solo Team</Badge>
            )}
          </CardContent>
        </Card>

        {/* Extra Seats */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-green-500/10 ${ADDON_INFO.addon_seats.color}`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{PLAN_DISPLAY_NAMES.addon_seats}</CardTitle>
                <CardDescription className="mt-1">
                  {ADDON_INFO.addon_seats.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">
                  {PLAN_PRICES.addon_seats[getBillingKey()]}€
                </span>
                <span className="text-muted-foreground text-sm">
                  /usuario/{getBillingKey() === 'annual' ? 'año' : 'mes'}
                </span>
              </div>
            </div>
            {canAddAddon('addon_seats') ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setExtraSeats(Math.max(0, extraSeats - 1))}
                    disabled={extraSeats <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={extraSeats}
                    onChange={(e) => setExtraSeats(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center"
                    min={0}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setExtraSeats(extraSeats + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleUpdateSeats}
                  disabled={isCreatingCheckout || isUpdating}
                  size="sm"
                >
                  Actualizar
                </Button>
              </div>
            ) : (
              <Badge variant="outline">Solo Pro/Team</Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
