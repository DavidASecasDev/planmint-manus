import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, TrendingUp, AlertTriangle, ShieldAlert, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/utils/transferCalculations';
import { evaluateMarginAlert, MARGIN_THRESHOLD_DANGER, MARGIN_THRESHOLD_WARNING } from '@/utils/marginAlerts';
import { cn } from '@/lib/utils';
import type { TransferItem, PricingMode } from '@/types/transfers';

interface TransferFinancialSummaryProps {
  providerCost: number | null;
  clientTotal: number | null;
  internalMargin: number | null;
  isExternalProvider: boolean;
  pricingMode: PricingMode;
  items?: TransferItem[];
}

export function TransferFinancialSummary({ 
  providerCost, 
  clientTotal, 
  internalMargin,
  isExternalProvider,
  pricingMode,
  items = [],
}: TransferFinancialSummaryProps) {
  const [open, setOpen] = useState(true);

  // Evaluate margin alert from items
  const alert = evaluateMarginAlert(items, pricingMode);

  // Use items-based totals as primary, fall back to request-level
  const effectiveClientTotal = alert.clientTotal > 0 ? alert.clientTotal : (clientTotal ?? 0);
  const effectiveProviderCost = alert.providerCost > 0 ? alert.providerCost : (providerCost ?? 0);
  const effectiveMargin = effectiveClientTotal - effectiveProviderCost;

  const hasData = effectiveProviderCost > 0 || effectiveClientTotal > 0;
  const marginPercent = alert.marginPercent;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn(
        alert.level === 'danger' && hasData && 'border-red-400/50',
        alert.level === 'warning' && hasData && 'border-amber-400/50',
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Resumen Financiero</CardTitle>
                <Badge variant="outline" className="text-xs">interno</Badge>
                {alert.level === 'danger' && hasData && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Margen bajo
                  </Badge>
                )}
                {alert.level === 'warning' && hasData && (
                  <Badge className="text-xs gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    Revisar margen
                  </Badge>
                )}
              </div>
              <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {!hasData ? (
              <div className="text-center py-6 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {pricingMode === 'provider_quote' ? (
                  <>
                    <p>Sube un presupuesto del proveedor</p>
                    <p className="text-sm">o introduce el coste por trayecto</p>
                  </>
                ) : (
                  <>
                    <p>Selecciona zona y vehículo en los trayectos</p>
                    <p className="text-sm">para ver el resumen financiero</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Provider Cost */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">
                    {pricingMode === 'provider_quote' ? 'Coste proveedor' : 'Coste base (tarifa zona)'}
                  </span>
                  <span className="font-medium">{formatCurrency(effectiveProviderCost)}</span>
                </div>

                {/* Client Total (sin IVA) */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Total cliente (sin IVA)</span>
                  <span className="font-semibold text-lg">{formatCurrency(effectiveClientTotal)}</span>
                </div>

                {/* IVA */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">IVA 21%</span>
                  <span className="font-medium">{formatCurrency(effectiveClientTotal * 0.21)}</span>
                </div>

                {/* Total con IVA */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="font-medium">Total cliente (con IVA)</span>
                  <span className="font-bold text-lg">{formatCurrency(effectiveClientTotal * 1.21)}</span>
                </div>

                {/* Margin */}
                <div className={cn(
                  'flex items-center justify-between py-2 rounded-lg px-3 -mx-3',
                  alert.level === 'danger' ? 'bg-red-500/10' :
                  alert.level === 'warning' ? 'bg-amber-500/10' :
                  'bg-primary/5'
                )}>
                  <span className={cn(
                    'font-medium flex items-center gap-2',
                    alert.level === 'danger' ? 'text-red-600 dark:text-red-400' :
                    alert.level === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                    ''
                  )}>
                    {alert.level === 'danger' ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : alert.level === 'warning' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-primary" />
                    )}
                    Margen bruto
                  </span>
                  <div className="text-right">
                    <span className={cn(
                      'font-semibold',
                      alert.level === 'danger' ? 'text-red-600 dark:text-red-400' :
                      alert.level === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                      'text-primary'
                    )}>
                      {formatCurrency(effectiveMargin)}
                    </span>
                    {effectiveProviderCost > 0 && (
                      <span className={cn(
                        'text-sm ml-2',
                        alert.level === 'danger' ? 'text-red-500' :
                        alert.level === 'warning' ? 'text-amber-500' :
                        'text-muted-foreground'
                      )}>
                        ({marginPercent}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Alert messages */}
                {alert.level === 'danger' && (
                  <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-500/10 border border-red-300/30 rounded-lg p-3">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Margen inferior al {MARGIN_THRESHOLD_DANGER}%</p>
                      <p className="text-red-600/80 dark:text-red-400/80 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                )}

                {alert.level === 'warning' && (
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-300/30 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Margen por debajo del {MARGIN_THRESHOLD_WARNING}%</p>
                      <p className="text-amber-600/80 dark:text-amber-400/80 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
