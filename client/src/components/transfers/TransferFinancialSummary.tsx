import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, TrendingUp, AlertTriangle, ShieldAlert, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/utils/transferCalculations';
import { evaluateMarginAlert } from '@/utils/marginAlerts';
import { useMarginThresholds } from '@/hooks/useMarginThresholds';
import { cn } from '@/lib/utils';
import type { TransferItem } from '@/types/transfers';
import { VAT_PROVIDER, VAT_CLIENT, COMMISSION_RATE } from '@/lib/pricingEngine';

interface TransferFinancialSummaryProps {
  providerCost: number | null;
  clientTotal: number | null;
  internalMargin: number | null;
  isExternalProvider: boolean;
  clientType?: 'external_client' | 'broker_client';
  externalProviderName?: string;
  items?: TransferItem[];
}

export function TransferFinancialSummary({ 
  providerCost, 
  clientTotal, 
  internalMargin,
  isExternalProvider,
  clientType = 'external_client',
  externalProviderName,
  items = [],
}: TransferFinancialSummaryProps) {
  const [open, setOpen] = useState(true);
  const thresholds = useMarginThresholds();

  // Evaluate margin alert from items with configurable thresholds
  const alert = evaluateMarginAlert(items, {
    danger: thresholds.danger,
    warning: thresholds.warning,
  });

  // Use items-based totals as primary, fall back to request-level
  const effectiveClientTotal = alert.clientTotal > 0 ? alert.clientTotal : (clientTotal ?? 0);
  const effectiveProviderCost = alert.providerCost > 0 ? alert.providerCost : (providerCost ?? 0);
  const effectiveMargin = effectiveClientTotal - effectiveProviderCost;

  const hasData = effectiveProviderCost > 0 || effectiveClientTotal > 0;
  const marginPercent = alert.marginPercent;

  // Dual-IVA breakdown calculations
  // Provider: base_price (neto) + 10% IVA = total proveedor
  const providerNet = effectiveProviderCost; // base_price is the net provider cost
  const providerVat = Math.round(providerNet * VAT_PROVIDER * 100) / 100;
  const providerTotal = Math.round((providerNet + providerVat) * 100) / 100;

  // Commission: 50% on provider total (incl. IVA)
  const commissionAmount = Math.round(providerTotal * COMMISSION_RATE * 100) / 100;

  // Client: net = providerNet + commission, + 21% IVA
  const clientNet = effectiveClientTotal > 0 ? effectiveClientTotal : (providerNet + commissionAmount);
  const clientVat = Math.round(clientNet * VAT_CLIENT * 100) / 100;
  const clientTotalWithVat = Math.round((clientNet + clientVat) * 100) / 100;

  // Profit = commission (what Azul Cars keeps)
  const profit = commissionAmount;

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
                <p>Selecciona zona y vehículo en los trayectos</p>
                <p className="text-sm">para ver el resumen financiero</p>
              </div>
            ) : (
              <div className="space-y-1">
                {clientType === 'broker_client' && !isExternalProvider ? (
                  /* ── BROKER + AZUL CARS OPERA: tarifa directa, sin comisión ── */
                  <>
                    <div className="pb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Ingreso directo (Azul Cars opera)
                      </p>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">Tarifa por trayecto</span>
                        <span className="text-sm font-medium">{formatCurrency(providerNet)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-t border-dashed border-border/60">
                        <span className="font-medium">Total cobrado a Isle of Mallorca</span>
                        <span className="font-bold text-lg">{formatCurrency(effectiveClientTotal || providerNet)}</span>
                      </div>
                    </div>

                    {/* ── BENEFICIO = tarifa completa ── */}
                    <div className={cn(
                      'flex items-center justify-between py-3 rounded-lg px-3 -mx-3 mt-2 border-t border-border',
                      'bg-primary/5'
                    )}>
                      <span className="font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Beneficio neto (100%)
                      </span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(effectiveClientTotal || providerNet)}
                      </span>
                    </div>
                  </>
                ) : clientType === 'broker_client' && isExternalProvider ? (
                  /* ── BROKER + LIMOMALLORCA OPERA: coste proveedor + comisión ── */
                  <>
                    <div className="pb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Coste {externalProviderName || 'proveedor externo'}
                      </p>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">Tarifa zona (neto)</span>
                        <span className="text-sm font-medium">{formatCurrency(providerNet)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">IVA 10% (transporte)</span>
                        <span className="text-sm">{formatCurrency(providerVat)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-t border-dashed border-border/60">
                        <span className="text-sm font-medium">Total a pagar a {externalProviderName || 'proveedor'}</span>
                        <span className="font-semibold">{formatCurrency(providerTotal)}</span>
                      </div>
                    </div>

                    {/* ── COMISIÓN ── */}
                    <div className="py-3 border-t border-border">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">Comisión Azul Cars (50%)</span>
                        <span className="text-sm font-medium text-primary">{formatCurrency(commissionAmount)}</span>
                      </div>
                    </div>

                    {/* ── TOTAL A COBRAR A ISLE OF MALLORCA ── */}
                    <div className="py-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Cobro a Isle of Mallorca
                      </p>
                      <div className="flex items-center justify-between py-1.5 border-t border-dashed border-border/60">
                        <span className="font-medium">Total a cobrar</span>
                        <span className="font-bold text-lg">{formatCurrency(clientNet)}</span>
                      </div>
                    </div>

                    {/* ── MARGEN ── */}
                    <div className={cn(
                      'flex items-center justify-between py-3 rounded-lg px-3 -mx-3 mt-2 border-t border-border',
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
                        Beneficio neto
                      </span>
                      <div className="text-right">
                        <span className={cn(
                          'font-semibold',
                          alert.level === 'danger' ? 'text-red-600 dark:text-red-400' :
                          alert.level === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                          'text-primary'
                        )}>
                          {formatCurrency(profit)}
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
                  </>
                ) : (
                  /* ── EXTERNAL_CLIENT: full breakdown with IVA 21% ── */
                  <>
                    {/* ── PROVEEDOR (lo que pagamos a LimoMallorca) ── */}
                    <div className="pb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Coste proveedor
                      </p>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">
                          Tarifa zona (neto)
                        </span>
                        <span className="text-sm font-medium">{formatCurrency(providerNet)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">IVA 10% (transporte)</span>
                        <span className="text-sm">{formatCurrency(providerVat)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-t border-dashed border-border/60">
                        <span className="text-sm font-medium">Total proveedor</span>
                        <span className="font-semibold">{formatCurrency(providerTotal)}</span>
                      </div>
                    </div>

                    {/* ── COMISIÓN ── */}
                    <div className="py-3 border-t border-border">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">Comisión Azul Cars (50%)</span>
                        <span className="text-sm font-medium text-primary">{formatCurrency(commissionAmount)}</span>
                      </div>
                    </div>

                    {/* ── CLIENTE (lo que facturamos) ── */}
                    <div className="py-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Factura cliente
                      </p>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">Servicio (sin IVA)</span>
                        <span className="text-sm font-medium">{formatCurrency(clientNet)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-muted-foreground">IVA 21% (intermediación)</span>
                        <span className="text-sm">{formatCurrency(clientVat)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-t border-dashed border-border/60">
                        <span className="font-medium">Total cliente</span>
                        <span className="font-bold text-lg">{formatCurrency(clientTotalWithVat)}</span>
                      </div>
                    </div>

                    {/* ── MARGEN ── */}
                    <div className={cn(
                      'flex items-center justify-between py-3 rounded-lg px-3 -mx-3 mt-2 border-t border-border',
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
                        Beneficio neto
                      </span>
                      <div className="text-right">
                        <span className={cn(
                          'font-semibold',
                          alert.level === 'danger' ? 'text-red-600 dark:text-red-400' :
                          alert.level === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                          'text-primary'
                        )}>
                          {formatCurrency(profit)}
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
                  </>
                )}

                {/* Alert messages */}
                {alert.level === 'danger' && (
                  <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-500/10 border border-red-300/30 rounded-lg p-3 mt-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Margen inferior al {thresholds.danger}%</p>
                      <p className="text-red-600/80 dark:text-red-400/80 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                )}

                {alert.level === 'warning' && (
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-300/30 rounded-lg p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Margen por debajo del {thresholds.warning}%</p>
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
