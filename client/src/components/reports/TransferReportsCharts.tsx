import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PricingModeStats } from '@/hooks/useTransferReports';

const STATUS_COLORS: Record<string, string> = {
  Borrador: 'hsl(var(--muted-foreground))',
  Pendiente: 'hsl(45, 93%, 47%)',
  'En gestión': 'hsl(217, 91%, 60%)',
  'Ppto. enviado': 'hsl(38, 92%, 50%)',
  'Presupuesto enviado': 'hsl(38, 92%, 50%)',
  Aceptado: 'hsl(142, 71%, 45%)',
  Confirmado: 'hsl(142, 71%, 45%)',
  Rechazado: 'hsl(0, 84%, 60%)',
  'En curso': 'hsl(217, 91%, 60%)',
  Completado: 'hsl(142, 71%, 45%)',
  Cancelado: 'hsl(0, 84%, 60%)',
  Facturado: 'hsl(271, 91%, 65%)',
};

const PRICING_MODE_COLORS: Record<string, string> = {
  zone_tariff: 'hsl(217, 91%, 60%)',
  provider_quote: 'hsl(38, 92%, 50%)',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

const tooltipLabelStyle = {
  color: 'hsl(var(--foreground))',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export function TransfersByStatusChart({ data, isLoading }: { data: { status: string; count: number }[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Solicitudes por estado</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({ name: d.status, value: d.count, fill: STATUS_COLORS[d.status] || 'hsl(var(--primary))' }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Solicitudes por estado</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function TransfersTrendChart({ data, isLoading }: { data: { date: string; count: number }[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Tendencia de solicitudes</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    date: format(new Date(d.date), 'dd MMM', { locale: es }),
    solicitudes: d.count,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tendencia de solicitudes</CardTitle></CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Line type="monotone" dataKey="solicitudes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function PricingModeDistributionChart({ data, isLoading }: { data: PricingModeStats[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Distribución por modo de precio</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[260px] w-full" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Distribución por modo de precio</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        </CardContent>
      </Card>
    );
  }

  const pieData = data.map(d => ({
    name: d.label,
    value: d.count,
    fill: PRICING_MODE_COLORS[d.mode] || 'hsl(var(--primary))',
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Distribución por modo de precio</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie chart */}
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            </PieChart>
          </ResponsiveContainer>

          {/* Financial breakdown */}
          <div className="flex flex-col justify-center space-y-3">
            {data.map(d => (
              <div key={d.mode} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: PRICING_MODE_COLORS[d.mode] || 'hsl(var(--primary))' }}
                  />
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className="text-xs text-muted-foreground">({d.count} solicitudes)</span>
                </div>
                <div className="pl-5 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Ingresos:</span>
                    <span className="ml-1 font-medium">{formatCurrency(d.revenue)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costes:</span>
                    <span className="ml-1 font-medium">{formatCurrency(d.cost)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Margen:</span>
                    <span className={`ml-1 font-medium ${d.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(d.margin)} ({d.marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
