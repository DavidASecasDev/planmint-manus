import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TypeData {
  type: string;
  label: string;
  count: number;
}

interface TrendData {
  date: string;
  count: number;
}

const TYPE_COLORS: Record<string, string> = {
  entrega: 'hsl(217, 91%, 60%)',   // blue
  recogida: 'hsl(38, 92%, 50%)',   // amber
  escoba: 'hsl(142, 71%, 45%)',    // green
  limpieza: 'hsl(271, 91%, 65%)',  // violet
};

export function MovementsByTypeChart({ data, isLoading }: { data: TypeData[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Movimientos por tipo</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({ name: d.label, value: d.count, fill: TYPE_COLORS[d.type] || 'hsl(var(--primary))' }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Movimientos por tipo</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function MovementsTrendChart({ data, isLoading }: { data: TrendData[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Tendencia diaria</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: format(new Date(d.date), 'dd MMM', { locale: es }),
    completados: d.count,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tendencia diaria (completados)</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line type="monotone" dataKey="completados" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
