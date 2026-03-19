import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timer } from 'lucide-react';

interface TasksByTypeData {
  taskKey: string;
  taskLabel: string;
  count: number;
}

interface CleaningTrendData {
  date: string;
  count: number;
}

interface TimeDistributionData {
  range: string;
  count: number;
}

interface VehicleCleaningChartProps {
  data: TasksByTypeData[];
  isLoading?: boolean;
}

interface CleaningTrendChartProps {
  data: CleaningTrendData[];
  isLoading?: boolean;
}

interface CleaningTimeDistributionChartProps {
  data: TimeDistributionData[];
  isLoading?: boolean;
}

export function VehicleCleaningChart({ data, isLoading }: VehicleCleaningChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tareas por tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    name: item.taskLabel,
    value: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tareas por tipo</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || chartData.every((d) => d.value === 0) ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin datos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function CleaningTrendChart({ data, isLoading }: CleaningTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendencia de limpieza</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    date: format(new Date(item.date), 'dd MMM', { locale: es }),
    count: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendencia de limpieza</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin datos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function CleaningTimeDistributionChart({ data, isLoading }: CleaningTimeDistributionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Distribución de tiempos de limpieza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalVehicles = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Distribución de tiempos de limpieza
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalVehicles === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Sin datos de tiempo. Los tiempos se calcularán cuando se marque "Inicio preparación" y luego las demás tareas.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value} vehículos`, 'Cantidad']}
              />
              <Bar 
                dataKey="count" 
                fill="hsl(var(--chart-2))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
