import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Target,
} from 'lucide-react';
import {
  AUDIT_CHECKLIST,
  CHECKLIST_CATEGORIES,
  type ChecklistResult,
} from '@/types/audits';
import { format, subMonths, startOfMonth, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──

interface AuditData {
  id: string;
  status: 'in_progress' | 'approved' | 'rejected';
  overall_score: number;
  checklist_results: Record<string, ChecklistResult> | any;
  created_at: string;
  completed_at: string | null;
}

interface AuditDashboardProps {
  audits: AuditData[];
  isLoading?: boolean;
}

// ── Pure helpers (exported for testing) ──

export function computeMonthlyScores(
  audits: AuditData[],
  monthsBack: number = 6,
): { month: string; avgScore: number; count: number }[] {
  const now = new Date();
  const months: { month: string; avgScore: number; count: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = startOfMonth(subMonths(now, i - 1));
    const label = format(monthStart, 'MMM yy', { locale: es });

    const monthAudits = audits.filter((a) => {
      const d = new Date(a.created_at);
      return isAfter(d, monthStart) && !isAfter(d, monthEnd);
    });

    const completedAudits = monthAudits.filter(
      (a) => a.status === 'approved' || a.status === 'rejected',
    );

    const avgScore =
      completedAudits.length > 0
        ? Math.round(
            completedAudits.reduce((sum, a) => sum + (a.overall_score || 0), 0) /
              completedAudits.length,
          )
        : 0;

    months.push({ month: label, avgScore, count: completedAudits.length });
  }

  return months;
}

export function computeDefectsByItem(
  audits: AuditData[],
): { key: string; label: string; category: string; defects: number }[] {
  const defectCounts: Record<string, number> = {};

  for (const audit of audits) {
    if (!audit.checklist_results || typeof audit.checklist_results !== 'object') continue;
    const results = audit.checklist_results as Record<string, ChecklistResult>;
    for (const [key, val] of Object.entries(results)) {
      if (val?.result === 'defect') {
        defectCounts[key] = (defectCounts[key] || 0) + 1;
      }
    }
  }

  return AUDIT_CHECKLIST.map((item) => ({
    key: item.key,
    label: item.label,
    category: CHECKLIST_CATEGORIES.find((c) => c.key === item.category)?.label || item.category,
    defects: defectCounts[item.key] || 0,
  }))
    .filter((d) => d.defects > 0)
    .sort((a, b) => b.defects - a.defects);
}

export function computeDefectsByCategory(
  audits: AuditData[],
): { category: string; defects: number }[] {
  const catCounts: Record<string, number> = {};

  for (const audit of audits) {
    if (!audit.checklist_results || typeof audit.checklist_results !== 'object') continue;
    const results = audit.checklist_results as Record<string, ChecklistResult>;
    for (const [key, val] of Object.entries(results)) {
      if (val?.result === 'defect') {
        const item = AUDIT_CHECKLIST.find((c) => c.key === key);
        if (item) {
          const catLabel =
            CHECKLIST_CATEGORIES.find((c) => c.key === item.category)?.label || item.category;
          catCounts[catLabel] = (catCounts[catLabel] || 0) + 1;
        }
      }
    }
  }

  return Object.entries(catCounts)
    .map(([category, defects]) => ({ category, defects }))
    .sort((a, b) => b.defects - a.defects);
}

export function computeStatusDistribution(
  audits: AuditData[],
): { name: string; value: number; color: string }[] {
  const approved = audits.filter((a) => a.status === 'approved').length;
  const rejected = audits.filter((a) => a.status === 'rejected').length;
  const inProgress = audits.filter((a) => a.status === 'in_progress').length;

  return [
    { name: 'Aprobadas', value: approved, color: '#16a34a' },
    { name: 'Rechazadas', value: rejected, color: '#dc2626' },
    { name: 'En progreso', value: inProgress, color: '#d97706' },
  ].filter((d) => d.value > 0);
}

export function computeKPIs(audits: AuditData[]) {
  const completed = audits.filter(
    (a) => a.status === 'approved' || a.status === 'rejected',
  );
  const approved = audits.filter((a) => a.status === 'approved');

  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, a) => sum + (a.overall_score || 0), 0) / completed.length,
        )
      : 0;

  const approvalRate =
    completed.length > 0 ? Math.round((approved.length / completed.length) * 100) : 0;

  // Average defects per audit
  let totalDefects = 0;
  for (const audit of completed) {
    if (!audit.checklist_results || typeof audit.checklist_results !== 'object') continue;
    const results = audit.checklist_results as Record<string, ChecklistResult>;
    totalDefects += Object.values(results).filter((r) => r?.result === 'defect').length;
  }
  const avgDefects =
    completed.length > 0 ? Math.round((totalDefects / completed.length) * 10) / 10 : 0;

  // Trend: compare last 30 days vs previous 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recent = completed.filter((a) => new Date(a.created_at) >= thirtyDaysAgo);
  const previous = completed.filter(
    (a) => new Date(a.created_at) >= sixtyDaysAgo && new Date(a.created_at) < thirtyDaysAgo,
  );

  const recentAvg =
    recent.length > 0
      ? Math.round(recent.reduce((s, a) => s + (a.overall_score || 0), 0) / recent.length)
      : 0;
  const previousAvg =
    previous.length > 0
      ? Math.round(previous.reduce((s, a) => s + (a.overall_score || 0), 0) / previous.length)
      : 0;

  const scoreTrend = recent.length > 0 && previous.length > 0 ? recentAvg - previousAvg : 0;

  return { avgScore, approvalRate, avgDefects, scoreTrend, totalAudits: completed.length };
}

// ── Custom Tooltip ──

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ──

function KPICard({
  title,
  value,
  suffix,
  trend,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  trend?: number;
  icon: React.ElementType;
  color: string;
}) {
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend && trend > 0 ? 'text-green-600' : trend && trend < 0 ? 'text-red-600' : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight">
              {value}
              {suffix && <span className="text-lg font-medium text-muted-foreground">{suffix}</span>}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>
              {trend > 0 ? '+' : ''}
              {trend} pts vs. mes anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export function AuditDashboard({ audits, isLoading }: AuditDashboardProps) {
  const kpis = useMemo(() => computeKPIs(audits), [audits]);
  const monthlyScores = useMemo(() => computeMonthlyScores(audits, 6), [audits]);
  const defectsByItem = useMemo(() => computeDefectsByItem(audits), [audits]);
  const defectsByCategory = useMemo(() => computeDefectsByCategory(audits), [audits]);
  const statusDistribution = useMemo(() => computeStatusDistribution(audits), [audits]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-64 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-semibold text-lg mb-1">Sin datos de auditorías</h3>
          <p className="text-sm text-muted-foreground">
            Realiza auditorías para ver las métricas y tendencias aquí.
          </p>
        </CardContent>
      </Card>
    );
  }

  const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Puntuación Media"
          value={kpis.avgScore}
          suffix="%"
          trend={kpis.scoreTrend}
          icon={Target}
          color="bg-blue-100 text-blue-600"
        />
        <KPICard
          title="Tasa de Aprobación"
          value={kpis.approvalRate}
          suffix="%"
          icon={ShieldCheck}
          color="bg-green-100 text-green-600"
        />
        <KPICard
          title="Defectos / Auditoría"
          value={kpis.avgDefects}
          icon={AlertTriangle}
          color="bg-amber-100 text-amber-600"
        />
        <KPICard
          title="Auditorías Completadas"
          value={kpis.totalAudits}
          icon={BarChart3}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Score Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Puntuación Media por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyScores.some((m) => m.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyScores}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    name="Puntuación"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No hay datos suficientes para mostrar la tendencia.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No hay datos suficientes.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Defects by Item */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Defectos Más Comunes</CardTitle>
          </CardHeader>
          <CardContent>
            {defectsByItem.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(280, defectsByItem.length * 40)}>
                <BarChart
                  data={defectsByItem.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={180}
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="defects"
                    name="Defectos"
                    fill="#ef4444"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No se han registrado defectos.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Defects by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Defectos por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {defectsByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={defectsByCategory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="defects" name="Defectos" radius={[4, 4, 0, 0]} barSize={48}>
                    {defectsByCategory.map((_, index) => (
                      <Cell
                        key={`cat-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No se han registrado defectos.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
