import { TrendingUp, TrendingDown, Scale, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BalanceKPICardsProps {
  incomeThisMonth: number;
  expensesThisMonth: number;
  balanceThisMonth: number;
}

export function BalanceKPICards({
  incomeThisMonth,
  expensesThisMonth,
  balanceThisMonth,
}: BalanceKPICardsProps) {
  const isPositive = balanceThisMonth >= 0;

  const kpis = [
    {
      label: 'Ingresos (Cobros)',
      value: `${incomeThisMonth.toLocaleString('es-ES')}€`,
      icon: TrendingUp,
      color: 'text-green-500 dark:text-green-400',
      bgColor: 'bg-green-500/10 dark:bg-green-500/15',
    },
    {
      label: 'Gastos (Taller)',
      value: `${expensesThisMonth.toLocaleString('es-ES')}€`,
      icon: TrendingDown,
      color: 'text-red-500 dark:text-red-400',
      bgColor: 'bg-red-500/10 dark:bg-red-500/15',
    },
    {
      label: 'Balance Mensual',
      value: `${isPositive ? '+' : ''}${balanceThisMonth.toLocaleString('es-ES')}€`,
      icon: isPositive ? Wallet : Scale,
      color: isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bgColor: isPositive ? 'bg-green-500/10 dark:bg-green-500/15' : 'bg-red-500/10 dark:bg-red-500/15',
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <Card 
          key={kpi.label}
          className={cn(
            kpi.highlight && (isPositive ? 'border-green-500/30 dark:border-green-400/30' : 'border-red-500/30 dark:border-red-400/30')
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.label}
            </CardTitle>
            <div className={cn('p-2 rounded-full', kpi.bgColor)}>
              <kpi.icon className={cn('h-4 w-4', kpi.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-2xl font-bold',
              kpi.highlight && kpi.color
            )}>
              {kpi.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
