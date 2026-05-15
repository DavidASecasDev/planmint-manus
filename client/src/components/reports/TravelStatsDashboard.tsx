/**
 * TravelStatsDashboard — Punctuality analytics over a configurable date range.
 * Shows KPI cards, daily trend chart, and per-user comparison bar chart.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Navigation, Clock, CheckCircle2, AlertTriangle, TrendingUp, Calendar,
  RefreshCw, Users, Target, Timer, Truck, RotateCcw, Loader2, BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip, Legend, Cell,
  ComposedChart, Line,
} from 'recharts';

// ── Types ──
interface StatsKPIs {
  total_trips: number;
  completed: number;
  with_estimate: number;
  on_time: number;
  late: number;
  very_late: number;
  on_time_percent: number;
  avg_real_minutes: number;
  avg_estimated_minutes: number;
  avg_diff_minutes: number;
  entregas: number;
  devoluciones: number;
}

interface UserStat {
  name: string;
  trips: number;
  completed: number;
  on_time: number;
  late: number;
  very_late: number;
  on_time_percent: number;
  avg_real_minutes: number;
  avg_estimated_minutes: number;
  avg_diff_minutes: number;
  best_diff: number;
  worst_diff: number;
}

interface DailyTrend {
  date: string;
  total: number;
  completed: number;
  on_time: number;
  late: number;
  on_time_percent: number;
  avg_real: number;
  avg_estimated: number;
}

interface StatsData {
  ok: boolean;
  range: { from: string; to: string };
  kpis: StatsKPIs;
  user_summary: UserStat[];
  daily_trend: DailyTrend[];
}

// ── Date range presets ──
type RangePreset = 'week' | 'month' | 'quarter' | 'custom';

function getPresetRange(preset: RangePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (preset) {
    case 'week':
      return { from: fmt(subDays(today, 6)), to: fmt(today) };
    case 'month':
      return { from: fmt(subDays(today, 29)), to: fmt(today) };
    case 'quarter':
      return { from: fmt(subDays(today, 89)), to: fmt(today) };
    default:
      return { from: fmt(subDays(today, 6)), to: fmt(today) };
  }
}

// ── Custom Tooltip ──
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}{entry.unit || ''}</span>
        </p>
      ))}
    </div>
  );
}

export function TravelStatsDashboard() {
  const [preset, setPreset] = useState<RangePreset>('week');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getPresetRange(preset), [preset]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiInvoke<StatsData>(
        'en-camino-tracking/stats',
        { body: { from: range.from, to: range.to } }
      );
      if (resp.data?.ok) {
        setData(resp.data);
      }
    } catch (err) {
      console.error('[travel-stats] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const kpis = data?.kpis;
  const users = data?.user_summary || [];
  const trend = data?.daily_trend || [];

  // Format daily trend for chart
  const trendData = useMemo(() => {
    return trend.map(d => ({
      ...d,
      dateLabel: format(new Date(d.date + 'T12:00:00'), 'd MMM', { locale: es }),
    }));
  }, [trend]);

  // Per-user chart data
  const userData = useMemo(() => {
    return users.map(u => ({
      name: u.name.split(' ')[0], // First name only for chart
      fullName: u.name,
      'A tiempo': u.on_time,
      'Tarde': u.late,
      'Muy tarde': u.very_late,
      on_time_percent: u.on_time_percent,
      avg_real: u.avg_real_minutes,
      avg_estimated: u.avg_estimated_minutes,
      avg_diff: u.avg_diff_minutes,
    }));
  }, [users]);

  const presetButtons: { key: RangePreset; label: string }[] = [
    { key: 'week', label: '7 días' },
    { key: 'month', label: '30 días' },
    { key: 'quarter', label: '90 días' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header with range selector ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-[Montserrat] tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Estadísticas de Puntualidad
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data ? `${format(new Date(data.range.from + 'T12:00:00'), "d MMM yyyy", { locale: es })} — ${format(new Date(data.range.to + 'T12:00:00'), "d MMM yyyy", { locale: es })}` : 'Cargando...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {presetButtons.map(btn => (
              <button
                key={btn.key}
                onClick={() => setPreset(btn.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  preset === btn.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
            className="h-8 px-2.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPISmall
            title="Total trayectos"
            value={kpis.total_trips}
            icon={<Navigation className="h-4 w-4" />}
            color="text-foreground"
            bgColor="bg-muted"
          />
          <KPISmall
            title="Completados"
            value={kpis.completed}
            subtitle={kpis.total_trips > 0 ? `${Math.round((kpis.completed / kpis.total_trips) * 100)}%` : undefined}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="text-emerald-600 dark:text-emerald-400"
            bgColor="bg-emerald-100 dark:bg-emerald-900/40"
          />
          <KPISmall
            title="A tiempo"
            value={`${kpis.on_time_percent}%`}
            subtitle={`${kpis.on_time} de ${kpis.with_estimate}`}
            icon={<Target className="h-4 w-4" />}
            color={kpis.on_time_percent >= 70 ? "text-emerald-600 dark:text-emerald-400" : kpis.on_time_percent >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}
            bgColor={kpis.on_time_percent >= 70 ? "bg-emerald-100 dark:bg-emerald-900/40" : kpis.on_time_percent >= 50 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-red-100 dark:bg-red-900/40"}
          />
          <KPISmall
            title="Tiempo medio"
            value={`${kpis.avg_real_minutes}'`}
            subtitle={`Est. ${kpis.avg_estimated_minutes}'`}
            icon={<Timer className="h-4 w-4" />}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-100 dark:bg-blue-900/40"
          />
          <KPISmall
            title="Desviación media"
            value={`${kpis.avg_diff_minutes > 0 ? '+' : ''}${kpis.avg_diff_minutes}'`}
            icon={<Clock className="h-4 w-4" />}
            color={kpis.avg_diff_minutes <= 5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
            bgColor={kpis.avg_diff_minutes <= 5 ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-amber-100 dark:bg-amber-900/40"}
          />
          <KPISmall
            title="Entregas / Dev."
            value={`${kpis.entregas} / ${kpis.devoluciones}`}
            icon={<Truck className="h-4 w-4" />}
            color="text-violet-600 dark:text-violet-400"
            bgColor="bg-violet-100 dark:bg-violet-900/40"
          />
        </div>
      )}

      {/* ── Charts row ── */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Trend Chart */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tendencia diaria
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="fill-muted-foreground" domain={[0, 100]} unit="%" />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar yAxisId="left" dataKey="total" name="Total" fill="#94a3b8" radius={[3, 3, 0, 0]} barSize={16} />
                    <Bar yAxisId="left" dataKey="on_time" name="A tiempo" fill="#10b981" radius={[3, 3, 0, 0]} barSize={16} />
                    <Line yAxisId="right" type="monotone" dataKey="on_time_percent" name="% Puntualidad" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} unit="%" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                  Sin datos para este período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estimated vs Real Chart */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-500" />
                Estimado vs Real (media diaria)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" unit="'" />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="avg_estimated" name="Estimado" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} unit="'" />
                    <Area type="monotone" dataKey="avg_real" name="Real" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} unit="'" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                  Sin datos para este período
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Per-user comparison ── */}
      {users.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Rendimiento por conductor
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {/* Bar chart */}
            {userData.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(200, userData.length * 50)}>
                <BarChart data={userData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="A tiempo" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} />
                  <Bar dataKey="Tarde" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={20} />
                  <Bar dataKey="Muy tarde" stackId="a" fill="#ef4444" radius={[0, 3, 3, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* User table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Conductor</th>
                    <th className="text-center py-2 px-2 font-medium">Trayectos</th>
                    <th className="text-center py-2 px-2 font-medium">% Puntual</th>
                    <th className="text-center py-2 px-2 font-medium">Media real</th>
                    <th className="text-center py-2 px-2 font-medium">Media est.</th>
                    <th className="text-center py-2 px-2 font-medium">Desviación</th>
                    <th className="text-center py-2 px-2 font-medium">Mejor</th>
                    <th className="text-center py-2 px-2 font-medium">Peor</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.name} className={cn("border-b border-border/50", i % 2 === 0 && "bg-muted/20")}>
                      <td className="py-2 px-2 font-medium">{u.name}</td>
                      <td className="py-2 px-2 text-center tabular-nums">{u.trips}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={cn(
                          "font-semibold tabular-nums",
                          u.on_time_percent >= 70 ? "text-emerald-600" : u.on_time_percent >= 50 ? "text-amber-600" : "text-red-600"
                        )}>
                          {u.on_time_percent}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center tabular-nums">{u.avg_real_minutes}'</td>
                      <td className="py-2 px-2 text-center tabular-nums text-muted-foreground">{u.avg_estimated_minutes}'</td>
                      <td className="py-2 px-2 text-center">
                        <span className={cn(
                          "font-medium tabular-nums",
                          u.avg_diff_minutes <= 5 ? "text-emerald-600" : u.avg_diff_minutes <= 15 ? "text-amber-600" : "text-red-600"
                        )}>
                          {u.avg_diff_minutes > 0 ? '+' : ''}{u.avg_diff_minutes}'
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center tabular-nums text-emerald-600">
                        {u.best_diff > 0 ? '+' : ''}{u.best_diff}'
                      </td>
                      <td className="py-2 px-2 text-center tabular-nums text-red-600">
                        +{u.worst_diff}'
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {data && kpis && kpis.total_trips === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Navigation className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Sin trayectos en este período</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Selecciona un rango de fechas diferente o espera a que se registren nuevos trayectos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Small KPI Card ──
function KPISmall({
  title,
  value,
  subtitle,
  icon,
  color,
  bgColor,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight truncate">{title}</p>
            <p className={cn("text-xl font-bold tracking-tight mt-0.5", color)}>{value}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={cn("p-1.5 rounded-lg shrink-0", bgColor, color)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
