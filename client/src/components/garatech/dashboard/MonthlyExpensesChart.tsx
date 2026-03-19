import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro } from 'lucide-react';

interface MonthlyExpensesChartProps {
  data: { month: string; total: number }[];
}

export function MonthlyExpensesChart({ data }: MonthlyExpensesChartProps) {
  const hasData = data.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Euro className="h-4 w-4 text-green-500" />
          Gastos por Mes (últimos 6 meses)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Sin datos de gastos</p>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}€`}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString('es-ES')}€`, 'Total']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
