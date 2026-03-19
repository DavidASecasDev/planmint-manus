import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, DollarSign, Calendar } from 'lucide-react';

interface TimeSummaryCardsProps {
  totalMinutes: number;
  billableMinutes: number;
  totalEntries: number;
}

export function TimeSummaryCards({ totalMinutes, billableMinutes, totalEntries }: TimeSummaryCardsProps) {
  const formatHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const stats = [
    {
      title: 'Tiempo total',
      value: formatHours(totalMinutes),
      icon: Clock,
      description: 'Tiempo registrado',
    },
    {
      title: 'Facturable',
      value: formatHours(billableMinutes),
      icon: DollarSign,
      description: `${totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0}% del total`,
    },
    {
      title: 'Entradas',
      value: totalEntries.toString(),
      icon: Calendar,
      description: 'Registros de tiempo',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
