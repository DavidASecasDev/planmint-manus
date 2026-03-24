import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, TrendingUp, BarChart3, Target } from 'lucide-react';
import { TransferBrokerStats } from '@/hooks/useTransferReports';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

type SortField = 'marginPercent' | 'revenue' | 'totalRequests' | 'conversionRate';
type SortDir = 'asc' | 'desc';

interface BrokerRankingTableProps {
  brokers: TransferBrokerStats[];
  isLoading?: boolean;
}

interface BrokerRanked extends TransferBrokerStats {
  marginPercent: number;
  conversionRate: number;
  completedCount: number;
}

export function BrokerRankingTable({ brokers, isLoading }: BrokerRankingTableProps) {
  const [sortField, setSortField] = useState<SortField>('marginPercent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rankedBrokers = useMemo<BrokerRanked[]>(() => {
    return brokers.map((b) => {
      const marginPercent = b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0;
      const completedCount = (b.byStatus['completado'] || 0) + (b.byStatus['facturado'] || 0);
      const conversionRate = b.totalRequests > 0 ? (completedCount / b.totalRequests) * 100 : 0;
      return { ...b, marginPercent, conversionRate, completedCount };
    });
  }, [brokers]);

  const sorted = useMemo(() => {
    return [...rankedBrokers].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [rankedBrokers, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === 'desc' 
      ? <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" /> 
      : <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const getMedalColor = (index: number) => {
    if (index === 0) return 'text-amber-500';
    if (index === 1) return 'text-slate-400';
    if (index === 2) return 'text-amber-700';
    return 'text-muted-foreground';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking de Brokers
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking de Brokers
          </CardTitle>
          <div className="flex gap-1.5">
            <Badge
              variant={sortField === 'marginPercent' ? 'default' : 'outline'}
              className="cursor-pointer text-xs gap-1"
              onClick={() => toggleSort('marginPercent')}
            >
              <TrendingUp className="h-3 w-3" />
              Margen %
            </Badge>
            <Badge
              variant={sortField === 'revenue' ? 'default' : 'outline'}
              className="cursor-pointer text-xs gap-1"
              onClick={() => toggleSort('revenue')}
            >
              <BarChart3 className="h-3 w-3" />
              Volumen
            </Badge>
            <Badge
              variant={sortField === 'conversionRate' ? 'default' : 'outline'}
              className="cursor-pointer text-xs gap-1"
              onClick={() => toggleSort('conversionRate')}
            >
              <Target className="h-3 w-3" />
              Conversión
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos de brokers</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort('totalRequests')}
                  >
                    <span className="inline-flex items-center">
                      Solicitudes
                      <SortIcon field="totalRequests" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort('revenue')}
                  >
                    <span className="inline-flex items-center">
                      Volumen
                      <SortIcon field="revenue" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort('marginPercent')}
                  >
                    <span className="inline-flex items-center">
                      Margen %
                      <SortIcon field="marginPercent" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort('conversionRate')}
                  >
                    <span className="inline-flex items-center">
                      Conversión
                      <SortIcon field="conversionRate" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Margen bruto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((b, i) => (
                  <TableRow key={b.brokerName} className={i < 3 ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <span className={cn('font-bold text-lg', getMedalColor(i))}>
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{b.brokerName}</TableCell>
                    <TableCell className="text-right">{b.totalRequests}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.revenue)}</TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'font-mono text-xs',
                          b.marginPercent >= 30 ? 'border-green-300 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30' :
                          b.marginPercent >= 15 ? 'border-amber-300 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' :
                          'border-red-300 text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30'
                        )}
                      >
                        {b.marginPercent.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-muted-foreground">
                        {b.completedCount}/{b.totalRequests}
                      </span>
                      <span className="ml-1.5 text-sm font-medium">
                        ({b.conversionRate.toFixed(0)}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={b.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(b.margin)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
