import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, TrendingUp, AlertTriangle, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, calculateMarginPercentage } from '@/utils/transferCalculations';
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

  // Calculate totals from items (unified source of truth)
  const itemsSubtotal = items.reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
  const itemsProviderCost = pricingMode === 'provider_quote'
    ? items.reduce((sum, it) => sum + (it.provider_cost || it.base_price || 0), 0)
    : items.reduce((sum, it) => sum + (it.base_price || 0), 0);

  // Use items-based totals as primary, fall back to request-level for provider_quote legacy
  const effectiveClientTotal = itemsSubtotal > 0 ? itemsSubtotal : (clientTotal ?? 0);
  const effectiveProviderCost = itemsProviderCost > 0 ? itemsProviderCost : (providerCost ?? 0);
  const effectiveMargin = effectiveClientTotal - effectiveProviderCost;

  const hasData = effectiveProviderCost > 0 || effectiveClientTotal > 0;
  const marginPercentage = hasData && effectiveProviderCost > 0
    ? calculateMarginPercentage(effectiveProviderCost, effectiveClientTotal)
    : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Resumen Financiero</CardTitle>
                <Badge variant="outline" className="text-xs">interno</Badge>
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
                <div className="flex items-center justify-between py-2 bg-primary/5 rounded-lg px-3 -mx-3">
                  <span className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Margen bruto
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-primary">{formatCurrency(effectiveMargin)}</span>
                    {effectiveProviderCost > 0 && (
                      <span className="text-sm text-muted-foreground ml-2">({marginPercentage}%)</span>
                    )}
                  </div>
                </div>

                {/* Warning if margin seems off */}
                {marginPercentage > 0 && marginPercentage < 40 && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>El margen es menor al esperado (50%)</span>
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
