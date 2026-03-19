import { Hammer, Euro, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GaratechKPICardsProps {
  activeRepairs: number;
  totalCostThisMonth: number;
  averageRepairDays: number;
  accidentsThisMonth: number;
}

export function GaratechKPICards({
  activeRepairs,
  totalCostThisMonth,
  averageRepairDays,
  accidentsThisMonth,
}: GaratechKPICardsProps) {
  const kpis = [
    {
      label: 'Reparaciones Activas',
      value: activeRepairs.toString(),
      icon: Hammer,
      color: 'text-blue-500',
    },
    {
      label: 'Coste Este Mes',
      value: `${totalCostThisMonth.toLocaleString('es-ES')}€`,
      icon: Euro,
      color: 'text-green-500',
    },
    {
      label: 'Tiempo Medio Rep.',
      value: `${averageRepairDays} días`,
      icon: Clock,
      color: 'text-amber-500',
    },
    {
      label: 'Accidentes (30d)',
      value: accidentsThisMonth.toString(),
      icon: AlertTriangle,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi.label}
            </CardTitle>
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
