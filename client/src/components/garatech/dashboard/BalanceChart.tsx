import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

interface BalanceChartProps {
  data: { month: string; income: number; expenses: number; balance: number }[];
}

export function BalanceChart({ data }: BalanceChartProps) {
  const hasData = data.some(d => d.income > 0 || d.expenses > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance Financiero</CardTitle>
        <CardDescription>Ingresos vs Gastos (últimos 6 meses)</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}€`}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString('es-ES')}€`,
                  name === 'income' ? 'Ingresos' : name === 'expenses' ? 'Gastos' : 'Balance'
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend 
                formatter={(value) => value === 'income' ? 'Ingresos' : value === 'expenses' ? 'Gastos' : 'Balance'}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="income" name="income" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            <p>Sin datos de balance disponibles</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
