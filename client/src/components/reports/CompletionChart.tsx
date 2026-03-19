import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { CompletionTrend } from '@/types/reports';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface CompletionChartProps {
  data: CompletionTrend[];
  isLoading?: boolean;
  chartType?: 'area' | 'bar';
}

const chartConfig = {
  completed: {
    label: 'Completadas',
    color: 'hsl(var(--primary))',
  },
  created: {
    label: 'Creadas',
    color: 'hsl(var(--muted-foreground))',
  },
};

export function CompletionChart({ data, isLoading = false, chartType = 'area' }: CompletionChartProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Actividad de tareas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Cargando...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Actividad de tareas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No hay datos para mostrar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(item => ({
    ...item,
    dateLabel: format(parseISO(item.date), 'dd MMM', { locale: es }),
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Actividad de tareas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          {chartType === 'area' ? (
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completadas"
                stroke="hsl(var(--primary))"
                fill="url(#completedGradient)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: 'hsl(var(--background))' }}
              />
              <Area
                type="monotone"
                dataKey="created"
                name="Creadas"
                stroke="hsl(var(--muted-foreground))"
                fill="url(#createdGradient)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }}
              />
            </AreaChart>
          ) : (
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="completed"
                name="Completadas"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="created"
                name="Creadas"
                fill="hsl(var(--muted-foreground))"
                radius={[4, 4, 0, 0]}
                opacity={0.5}
              />
            </BarChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
