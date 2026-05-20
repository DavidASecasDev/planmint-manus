import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Wrench, Hammer, Euro, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Car, Building2, LayoutGrid, FileText, ArrowUpRight, ArrowDownRight,
  PieChart, BarChart3, Activity, Plus, ChevronRight, GitCompareArrows,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend, Area, AreaChart, Line, LineChart,
} from 'recharts';
import { useGaratechStats, getDateRangeForPreset, type PeriodPreset, type DateRange } from '@/hooks/useGaratechStats';
import { PeriodSelector } from '@/components/garatech/dashboard/PeriodSelector';
import { RepairFormDialog } from '@/components/garatech/RepairFormDialog';
import { REPAIR_STATUS_LABELS, REPAIR_TYPE_LABELS } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { differenceInDays } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pendiente_aprobacion: '#f59e0b',
  listo_entregar_taller: '#8b5cf6',
  en_taller: '#3b82f6',
  esperando_piezas: '#ef4444',
  listo_recoger: '#10b981',
  finalizado: '#6b7280',
};

const TYPE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function GaratechDashboard() {
  const [preset, setPreset] = useState<PeriodPreset>('year');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const dateRange = useMemo(() => {
    if (preset === 'custom' && customRange) return customRange;
    return getDateRangeForPreset(preset);
  }, [preset, customRange]);

  const { stats, recentActivity, isLoading } = useGaratechStats(dateRange);
  const [newRepairOpen, setNewRepairOpen] = useState(false);
  const [showYoY, setShowYoY] = useState(false);
  const navigate = useNavigate();

  // Merge current and previous year data for YoY charts
  const yoyChartData = useMemo(() => {
    if (!showYoY) return null;
    return stats.monthlyData.map((current, idx) => {
      const prev = stats.previousYearMonthlyData[idx];
      return {
        month: current.month,
        expenses: current.expenses,
        prevExpenses: prev?.expenses || 0,
        income: current.income,
        prevIncome: prev?.income || 0,
        repairCount: current.repairCount,
        prevRepairCount: prev?.repairCount || 0,
      };
    });
  }, [showYoY, stats.monthlyData, stats.previousYearMonthlyData]);

  const hasPrevYearData = stats.previousYearMonthlyData.some(d => d.expenses > 0 || d.repairCount > 0);

  const handlePresetChange = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      setCustomRange(null);
    }
  };

  const handleDateRangeChange = (range: DateRange) => {
    setCustomRange(range);
    setPreset('custom');
  };

  if (isLoading) {
    return (
      <AppLayout title="Garatech">
        <div className="space-y-6">
          <PageHeader title="Garatech" description="Panel de control de taller y mantenimiento" icon={Wrench} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const isPositiveBalance = stats.balanceInPeriod >= 0;

  // Prepare pie chart data for repair types
  const typeChartData = Object.entries(stats.repairsByType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: REPAIR_TYPE_LABELS[type as keyof typeof REPAIR_TYPE_LABELS] || type,
      value: count,
    }));

  // Prepare status pipeline data
  const statusPipeline = Object.entries(stats.repairsByStatus)
    .filter(([status]) => status !== 'finalizado')
    .map(([status, count]) => ({
      status,
      label: REPAIR_STATUS_LABELS[status as keyof typeof REPAIR_STATUS_LABELS] || status,
      count,
      color: STATUS_COLORS[status] || '#6b7280',
    }));

  const totalInPipeline = statusPipeline.reduce((sum, s) => sum + s.count, 0);

  return (
    <AppLayout title="Garatech">
      <div className="space-y-6">
        {/* Header with period selector and quick actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <PageHeader
              title="Garatech"
              description="Panel de control de taller y mantenimiento de flota"
              icon={Wrench}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/garatech/repairs')}>
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Kanban
              </Button>
              <Button size="sm" onClick={() => setNewRepairOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva Reparación
              </Button>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex items-center justify-between">
            <PeriodSelector
              preset={preset}
              dateRange={dateRange}
              onPresetChange={handlePresetChange}
              onDateRangeChange={handleDateRangeChange}
            />
            <div className="flex items-center gap-3">
              {hasPrevYearData && (
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">vs Año Anterior</span>
                  <Switch
                    checked={showYoY}
                    onCheckedChange={setShowYoY}
                    className="scale-75"
                  />
                </div>
              )}
              <span className="text-xs text-muted-foreground hidden sm:block">
                {format(dateRange.from, "dd MMM yyyy", { locale: es })} — {format(dateRange.to, "dd MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>

        {/* KPI Row - Hero metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Active Repairs */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Hammer className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Activas</span>
              </div>
              <p className="text-3xl font-bold">{stats.activeRepairs}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalRepairs} en periodo
              </p>
            </CardContent>
          </Card>

          {/* Period Cost */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Euro className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground">Gasto</span>
              </div>
              <p className="text-3xl font-bold">{stats.totalCostInPeriod.toLocaleString('es-ES')}€</p>
              <div className="flex items-center gap-1 mt-1">
                {stats.costTrend !== 0 && (
                  <>
                    {stats.costTrend > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-red-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-green-500" />
                    )}
                    <span className={cn('text-xs font-medium', stats.costTrend > 0 ? 'text-red-500' : 'text-green-500')}>
                      {Math.abs(stats.costTrend)}%
                    </span>
                    <span className="text-xs text-muted-foreground">vs anterior</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Average Cost per Repair */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">Coste Medio</span>
              </div>
              <p className="text-3xl font-bold">{stats.averageCostPerRepair.toLocaleString('es-ES')}€</p>
              <p className="text-xs text-muted-foreground mt-1">por reparación</p>
            </CardContent>
          </Card>

          {/* Average Duration */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-muted-foreground">Duración Media</span>
              </div>
              <p className="text-3xl font-bold">{stats.averageRepairDays}</p>
              <p className="text-xs text-muted-foreground mt-1">días</p>
            </CardContent>
          </Card>

          {/* Balance */}
          <Card className={cn(
            'relative overflow-hidden border',
            isPositiveBalance ? 'border-green-500/30' : 'border-red-500/30'
          )}>
            <div className={cn(
              'absolute top-0 right-0 w-16 h-16 rounded-bl-full',
              isPositiveBalance ? 'bg-green-500/10' : 'bg-red-500/10'
            )} />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                {isPositiveBalance ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs font-medium text-muted-foreground">Balance</span>
              </div>
              <p className={cn('text-3xl font-bold', isPositiveBalance ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {isPositiveBalance ? '+' : ''}{stats.balanceInPeriod.toLocaleString('es-ES')}€
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.incomeInPeriod.toLocaleString('es-ES')}€ cobrado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Status Bar */}
        {totalInPipeline > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Pipeline de Reparaciones</h3>
                <span className="text-xs text-muted-foreground">{totalInPipeline} en curso</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {statusPipeline.map((s) => (
                  s.count > 0 && (
                    <div
                      key={s.status}
                      className="h-full transition-all"
                      style={{
                        width: `${(s.count / totalInPipeline) * 100}%`,
                        backgroundColor: s.color,
                      }}
                      title={`${s.label}: ${s.count}`}
                    />
                  )
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {statusPipeline.map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-xs font-semibold">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Expenses Area Chart - spans 2 cols */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Evolución de Gastos
                  {showYoY && (
                    <Badge variant="outline" className="text-[10px] ml-1 font-normal">
                      vs Año Anterior
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stats.monthlyData.some(d => d.expenses > 0) ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {showYoY && yoyChartData ? (
                      <LineChart data={yoyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} className="fill-muted-foreground" />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = {
                              expenses: 'Gastos (actual)',
                              prevExpenses: 'Gastos (año ant.)',
                              income: 'Ingresos (actual)',
                              prevIncome: 'Ingresos (año ant.)',
                            };
                            return [`${value.toLocaleString('es-ES')}€`, labels[name] || name];
                          }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend
                          formatter={(value) => {
                            const labels: Record<string, string> = {
                              expenses: 'Gastos (actual)',
                              prevExpenses: 'Gastos (año ant.)',
                              income: 'Ingresos (actual)',
                              prevIncome: 'Ingresos (año ant.)',
                            };
                            return <span className="text-xs">{labels[value] || value}</span>;
                          }}
                        />
                        <Line type="monotone" dataKey="expenses" stroke="hsl(0, 84%, 60%)" strokeWidth={2.5} dot={{ r: 3 }} name="expenses" />
                        <Line type="monotone" dataKey="prevExpenses" stroke="hsl(0, 84%, 60%)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} opacity={0.5} name="prevExpenses" />
                        <Line type="monotone" dataKey="income" stroke="hsl(142, 76%, 36%)" strokeWidth={2.5} dot={{ r: 3 }} name="income" />
                        <Line type="monotone" dataKey="prevIncome" stroke="hsl(142, 76%, 36%)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} opacity={0.5} name="prevIncome" />
                      </LineChart>
                    ) : (
                      <AreaChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} className="fill-muted-foreground" />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `${value.toLocaleString('es-ES')}€`,
                            name === 'expenses' ? 'Gastos' : 'Ingresos'
                          ]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="expenses"
                          stroke="hsl(0, 84%, 60%)"
                          fill="url(#expensesGradient)"
                          strokeWidth={2}
                          name="expenses"
                        />
                        <Area
                          type="monotone"
                          dataKey="income"
                          stroke="hsl(142, 76%, 36%)"
                          fill="url(#incomeGradient)"
                          strokeWidth={2}
                          name="income"
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">Sin datos suficientes para este periodo</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair Type Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                Tipo de Reparación
              </CardTitle>
            </CardHeader>
            <CardContent>
              {typeChartData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {typeChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        height={50}
                        formatter={(value) => <span className="text-xs">{value}</span>}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} reparaciones`]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">Sin datos en este periodo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Row: Top Workshops + Top Vehicles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Workshops */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Talleres por Gasto
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/garatech/workshops')}>
                  Ver todos <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats.topWorkshops.length > 0 ? (
                <div className="space-y-3">
                  {stats.topWorkshops.map((ws, i) => {
                    const maxCost = stats.topWorkshops[0]?.totalCost || 1;
                    const pct = (ws.totalCost / maxCost) * 100;
                    return (
                      <div key={ws.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                            <span className="text-sm font-medium truncate">{ws.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{ws.repairCount} rep.</Badge>
                            <span className="text-sm font-semibold tabular-nums">{ws.totalCost.toLocaleString('es-ES')}€</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Sin datos de talleres en este periodo
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Vehicles by Cost */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  Vehículos con Mayor Gasto
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stats.topVehiclesByCost.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.topVehiclesByCost.map((v, i) => {
                    const maxCost = stats.topVehiclesByCost[0]?.totalCost || 1;
                    const pct = (v.totalCost / maxCost) * 100;
                    return (
                      <div key={v.vehicleId} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                            <span className="text-sm font-mono font-medium">{v.matricula}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{v.repairCount} rep.</Badge>
                            <span className="text-sm font-semibold tabular-nums">{v.totalCost.toLocaleString('es-ES')}€</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Sin datos de vehículos en este periodo
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Third Row: Repairs per Month + Urgent + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Repairs per month bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Reparaciones por Mes
                {showYoY && (
                  <Badge variant="outline" className="text-[10px] ml-1 font-normal">
                    vs Año Ant.
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.monthlyData.some(d => d.repairCount > 0) ? (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={showYoY && yoyChartData ? yoyChartData : stats.monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (showYoY) {
                            const label = name === 'repairCount' ? 'Actual' : 'Año ant.';
                            return [`${value} reparaciones`, label];
                          }
                          return [`${value} reparaciones`];
                        }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="repairCount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="repairCount" />
                      {showYoY && (
                        <Bar dataKey="prevRepairCount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.3} name="prevRepairCount" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Sin datos en este periodo
                </div>
              )}
            </CardContent>
          </Card>

          {/* Urgent Repairs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Reparaciones Urgentes
                {stats.urgentRepairs.length > 0 && (
                  <Badge variant="destructive" className="text-xs ml-auto">
                    {stats.urgentRepairs.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.urgentRepairs.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                    <Wrench className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">Todo bajo control</p>
                  <p className="text-xs text-muted-foreground mt-1">No hay reparaciones urgentes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.urgentRepairs.map((repair) => {
                    const daysWaiting = differenceInDays(new Date(), new Date(repair.created_at));
                    return (
                      <div
                        key={repair.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/20 cursor-pointer transition-colors"
                        onClick={() => navigate('/garatech/repairs')}
                      >
                        <Car className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {repair.vehicle?.matricula || 'Sin vehículo'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {REPAIR_STATUS_LABELS[repair.status]}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                          {daysWaiting}d
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividad reciente</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {recentActivity.slice(0, 8).map((activity) => {
                    const iconMap = {
                      repair: Hammer,
                      accident: AlertTriangle,
                      report: FileText,
                    };
                    const colorMap = {
                      repair: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
                      accident: 'text-red-500 bg-red-100 dark:bg-red-900/30',
                      report: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
                    };
                    const Icon = iconMap[activity.type] || Wrench;
                    const colors = colorMap[activity.type] || 'text-muted-foreground bg-muted';

                    return (
                      <div key={activity.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={cn('p-1.5 rounded-full shrink-0', colors.split(' ').slice(1).join(' '))}>
                          <Icon className={cn('h-3 w-3', colors.split(' ')[0])} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{activity.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(activity.date), 'dd MMM', { locale: es })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Accidents indicator */}
        {stats.accidentsInPeriod > 0 && (
          <Card className="border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {stats.accidentsInPeriod} accidente{stats.accidentsInPeriod > 1 ? 's' : ''} en este periodo
                  </p>
                  <p className="text-xs text-muted-foreground">Revisa el módulo de accidentes para más detalles</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/garatech/accidents')}>
                  Ver detalles
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <RepairFormDialog open={newRepairOpen} onOpenChange={setNewRepairOpen} />
    </AppLayout>
  );
}
