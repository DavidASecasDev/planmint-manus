import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  Pendiente: 'hsl(38, 92%, 50%)',
  Presupuestado: 'hsl(217, 91%, 60%)',
  Aprobado: 'hsl(271, 91%, 65%)',
  'En taller': 'hsl(38, 92%, 50%)',
  Completado: 'hsl(142, 71%, 45%)',
  Cancelado: 'hsl(0, 84%, 60%)',
};

export function RepairsByStatusChart({ data, isLoading }: { data: { status: string; count: number }[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Reparaciones por estado</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({ name: d.status, value: d.count, fill: STATUS_COLORS[d.status] || 'hsl(var(--primary))' }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Reparaciones por estado</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
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

export function MonthlyCostsChart({ data, isLoading }: { data: { month: string; estimated: number; final: number }[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Costes mensuales</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    month: format(new Date(d.month + '-01'), 'MMM yyyy', { locale: es }),
    Estimado: d.estimated,
    Final: d.final,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Evolución de costes mensuales</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => `${value.toLocaleString('es-ES')} €`}
              />
              <Legend />
              <Line type="monotone" dataKey="Estimado" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Final" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
