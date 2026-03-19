import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, TrendingUp, AlertTriangle, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, calculateMarginPercentage } from '@/utils/transferCalculations';
import { cn } from '@/lib/utils';

interface TransferFinancialSummaryProps {
  providerCost: number | null;
  clientTotal: number | null;
  internalMargin: number | null;
  isExternalProvider: boolean;
}

export function TransferFinancialSummary({ 
  providerCost, 
  clientTotal, 
  internalMargin,
  isExternalProvider 
}: TransferFinancialSummaryProps) {
  const [open, setOpen] = useState(true);

  // Only show for external providers with cost data
  if (!isExternalProvider) {
    return null;
  }

  const hasData = providerCost !== null && providerCost > 0;
  const marginPercentage = hasData && clientTotal 
    ? calculateMarginPercentage(providerCost, clientTotal) 
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
                <p>Sube un presupuesto o factura del proveedor</p>
                <p className="text-sm">y aplica el coste para ver el resumen</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Provider Cost */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Coste proveedor</span>
                  <span className="font-medium">{formatCurrency(providerCost)}</span>
                </div>

                {/* Client Total */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Total cliente</span>
                  <span className="font-semibold text-lg">{formatCurrency(clientTotal)}</span>
                </div>

                {/* Margin */}
                <div className="flex items-center justify-between py-2 bg-primary/5 rounded-lg px-3 -mx-3">
                  <span className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Margen bruto
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-primary">{formatCurrency(internalMargin)}</span>
                    <span className="text-sm text-muted-foreground ml-2">({marginPercentage}%)</span>
                  </div>
                </div>

                {/* Warning if margin seems off */}
                {marginPercentage < 40 && (
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
