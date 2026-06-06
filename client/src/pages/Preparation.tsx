import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiInvoke } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SprayCan, Clock, PlayCircle, CheckCircle2, AlertTriangle,
  Fuel, Gauge, Smartphone, Sparkles, Droplets, Timer,
  History, TrendingUp, Trophy, Target, BarChart3,
  ChevronLeft, ChevronRight, Activity, Zap,
} from 'lucide-react';
import { ManualPreparationList } from '@/components/dashboard/ManualPreparationList';

// ─── Task icons & labels ────────────────────────────────────────────────────
const TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inicio_prep: PlayCircle,
  repostaje: Fuel,
  presion: Gauge,
  avisos: AlertTriangle,
  borrado: Smartphone,
  limpieza_int: Sparkles,
  limpieza_ext: Droplets,
};

const TASK_LABELS: Record<string, string> = {
  inicio_prep: 'Inicio preparación',
  repostaje: 'Repostaje',
  presion: 'Presión neumáticos',
  avisos: 'Avisos mantenimiento',
  borrado: 'Borrado dispositivos',
  limpieza_int: 'Limpieza interior',
  limpieza_ext: 'Limpieza exterior',
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface PreparationProgress {
  id: string;
  matricula: string;
  modelo: string | null;
  deadline_at: string;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  started_by: string | null;
  vehicle_id: string | null;
  vehicle_status: string | null;
  total_tasks: number;
  completed_tasks: number;
  tasks: Array<{
    task_key: string;
    completed: boolean;
    completed_at: string | null;
    completed_by: string | null;
  }>;
}

interface HistoryItem {
  id: string;
  matricula: string;
  modelo: string | null;
  deadline_at: string;
  notes: string | null;
  created_at: string;
  completed_at: string;
  completed_by_name: string;
  duration_minutes: number | null;
  met_deadline: boolean | null;
}

interface PreparerRanking {
  name: string;
  completed_count: number;
  avg_duration_minutes: number | null;
}

interface DailyTrend {
  date: string;
  count: number;
}

interface HistoryMetrics {
  total_completed: number;
  avg_duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  deadline_compliance_rate: number | null;
  preparer_ranking: PreparerRanking[];
  daily_trend: DailyTrend[];
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  limit: number;
  metrics: HistoryMetrics;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getUrgencyConfig(deadlineAt: string) {
  const now = Date.now();
  const deadline = new Date(deadlineAt).getTime();
  const diffMinutes = (deadline - now) / 60000;

  if (diffMinutes < 0) return {
    border: 'border-l-red-500',
    bg: 'bg-gradient-to-r from-red-50/80 to-transparent dark:from-red-950/20 dark:to-transparent',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Vencido',
    pulse: true,
    timerBg: 'bg-red-50 dark:bg-red-950/30',
  };
  if (diffMinutes < 30) return {
    border: 'border-l-orange-500',
    bg: 'bg-gradient-to-r from-orange-50/80 to-transparent dark:from-orange-950/20 dark:to-transparent',
    text: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    label: 'Urgente',
    pulse: true,
    timerBg: 'bg-orange-50 dark:bg-orange-950/30',
  };
  if (diffMinutes < 60) return {
    border: 'border-l-amber-500',
    bg: 'bg-gradient-to-r from-amber-50/60 to-transparent dark:from-amber-950/15 dark:to-transparent',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Pronto',
    pulse: false,
    timerBg: 'bg-amber-50 dark:bg-amber-950/30',
  };
  return {
    border: 'border-l-emerald-500',
    bg: 'bg-gradient-to-r from-emerald-50/40 to-transparent dark:from-emerald-950/10 dark:to-transparent',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Normal',
    pulse: false,
    timerBg: 'bg-emerald-50 dark:bg-emerald-950/30',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Active Preparations Panel
// ═══════════════════════════════════════════════════════════════════════════════
function ActivePreparationsPanel() {
  const { organization } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const canViewProgress = hasPermission('preparation.view_progress');

  const { data: progressData, isLoading } = useQuery({
    queryKey: ['preparation-progress', organization?.id],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: PreparationProgress[] }>('get-preparation-progress', {
        body: {},
      });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
      return result.data.data;
    },
    enabled: !!organization?.id && canViewProgress,
    refetchInterval: 15000,
  });

  const startMutation = useMutation({
    mutationFn: async (matricula: string) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('start-preparation', {
        body: { matricula },
      });
      if (result.error || !result.data?.ok) {
        throw new Error(result.data?.error || result.error?.message || 'Error');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preparation-progress'] });
      queryClient.invalidateQueries({ queryKey: ['preparation-count'] });
      toast({ title: 'Preparación iniciada', description: 'Se ha registrado el inicio de la preparación' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (!canViewProgress) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  const activePreps = (progressData || []).filter(p => p.started_at);
  const pendingPreps = (progressData || []).filter(p => !p.started_at);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Status summary strip */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            {activePreps.length > 0 && (
              <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-blue-500 animate-ping opacity-75" />
            )}
          </div>
          <span className="text-sm font-medium text-foreground">{activePreps.length} en curso</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="text-sm text-muted-foreground">{pendingPreps.length} pendientes</span>
        </div>
      </div>

      {/* Empty state */}
      {activePreps.length === 0 && pendingPreps.length === 0 && (
        <Card className="border-dashed border-2 border-border/60 rounded-2xl bg-gradient-to-br from-card to-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-14 sm:py-20">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/20 flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-heading font-bold text-foreground text-base sm:text-lg">Todo al día</p>
            <p className="text-sm text-muted-foreground mt-1.5 text-center max-w-xs">
              No hay preparaciones pendientes. Los vehículos que necesiten preparación aparecerán aquí automáticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active preparations */}
      {activePreps.map((prep) => {
        const progressPercent = prep.total_tasks > 0 ? (prep.completed_tasks / prep.total_tasks) * 100 : 0;
        const urgency = getUrgencyConfig(prep.deadline_at);

        return (
          <Card
            key={prep.id}
            className={`rounded-2xl overflow-hidden border-l-4 ${urgency.border} shadow-sm hover:shadow-md transition-all duration-200`}
          >
            <div className={`${urgency.bg}`}>
              <CardContent className="p-4 sm:p-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-card border border-border/50 flex items-center justify-center shadow-sm shrink-0">
                      <SprayCan className={`h-5 w-5 ${urgency.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-heading font-bold text-base sm:text-lg tracking-tight">{prep.matricula}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 font-semibold border-0 ${urgency.badge} ${urgency.pulse ? 'animate-pulse' : ''}`}>
                          {urgency.label}
                        </Badge>
                      </div>
                      {prep.modelo && (
                        <span className="text-xs sm:text-sm text-muted-foreground">{prep.modelo}</span>
                      )}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${urgency.timerBg} border border-border/30`}>
                    <Timer className={`h-4 w-4 ${urgency.text}`} />
                    <span className={`font-mono font-bold text-sm sm:text-base ${urgency.text}`}>
                      {formatElapsedTime(prep.started_at!)}
                    </span>
                  </div>
                </div>

                {prep.started_by && (
                  <p className="text-xs text-muted-foreground mb-3 ml-[52px] sm:ml-[56px]">
                    Preparador: <span className="font-medium text-foreground">{prep.started_by}</span>
                  </p>
                )}

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-medium">{prep.completed_tasks} de {prep.total_tasks} tareas</span>
                    <span className="font-mono font-bold text-foreground text-sm">{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-3 bg-muted/60 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 transition-all duration-700 ease-out relative"
                      style={{ width: `${progressPercent}%` }}
                    >
                      {progressPercent > 10 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] rounded-full" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Task chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {prep.tasks
                    .filter(t => t.task_key !== 'inicio_prep')
                    .map((task) => {
                      const Icon = TASK_ICONS[task.task_key] || CheckCircle2;
                      const label = TASK_LABELS[task.task_key] || task.task_key;
                      return (
                        <div
                          key={task.task_key}
                          className={`flex items-center gap-2 text-[11px] sm:text-xs px-3 py-2 rounded-lg border transition-all duration-200 ${
                            task.completed
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                              : 'bg-card border-border/60 text-muted-foreground hover:border-border'
                          }`}
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${task.completed ? 'text-emerald-500' : 'opacity-60'}`} />
                          <span className="truncate font-medium">{label}</span>
                          {task.completed && <CheckCircle2 className="h-3 w-3 ml-auto shrink-0 text-emerald-500" />}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </div>
          </Card>
        );
      })}

      {/* Pending preparations */}
      {pendingPreps.length > 0 && (
        <div className="space-y-3">
          {activePreps.length > 0 && (
            <div className="flex items-center gap-3 pt-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <span className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-widest px-2">
                Pendientes
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
          )}
          {pendingPreps.map((prep) => (
            <Card key={prep.id} className="rounded-xl border-border/50 hover:border-primary/40 hover:shadow-sm transition-all duration-200 group">
              <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                    <SprayCan className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <span className="font-heading font-bold text-sm sm:text-base">{prep.matricula}</span>
                    {prep.modelo && <span className="text-xs text-muted-foreground ml-2">{prep.modelo}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => startMutation.mutate(prep.matricula)}
                  disabled={startMutation.isPending}
                  className="gap-2 rounded-xl w-full sm:w-auto bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary shadow-sm font-semibold"
                >
                  <PlayCircle className="h-4 w-4" />
                  Iniciar preparación
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// History Panel with Performance Analytics
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryPanel() {
  const { organization } = useAuth();
  const [period, setPeriod] = useState<string>('month');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['preparation-history', organization?.id, period, page],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: HistoryResponse }>('get-preparation-history', {
        body: { period, page, limit },
      });
      if (result.error || !result.data?.ok) throw new Error(result.error?.message || 'Error');
      return result.data.data;
    },
    enabled: !!organization?.id,
  });

  const metrics = historyData?.metrics;
  const items = historyData?.items || [];
  const totalPages = Math.ceil((historyData?.total || 0) / limit);
  const maxTrendCount = Math.max(...(metrics?.daily_trend?.map(d => d.count) || [1]), 1);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header with period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/10 flex items-center justify-center shadow-sm">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-foreground">Rendimiento</h3>
            <p className="text-xs text-muted-foreground">Métricas y análisis del equipo</p>
          </div>
        </div>
        <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mes</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="year">Último año</SelectItem>
            <SelectItem value="all">Todo el historial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                label: 'Completadas',
                value: metrics?.total_completed || 0,
                icon: CheckCircle2,
                gradient: 'from-emerald-500 to-emerald-400',
                bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
                color: 'text-emerald-700 dark:text-emerald-400',
              },
              {
                label: 'Tiempo medio',
                value: formatDuration(metrics?.avg_duration_minutes || null),
                icon: Timer,
                gradient: 'from-blue-500 to-blue-400',
                bg: 'bg-blue-50/80 dark:bg-blue-950/20',
                color: 'text-blue-700 dark:text-blue-400',
                subtitle: metrics?.min_duration_minutes ? `${formatDuration(metrics.min_duration_minutes)} – ${formatDuration(metrics.max_duration_minutes)}` : undefined,
              },
              {
                label: 'Cumplimiento',
                value: metrics?.deadline_compliance_rate !== null ? `${metrics?.deadline_compliance_rate}%` : '—',
                icon: Target,
                gradient: 'from-purple-500 to-purple-400',
                bg: 'bg-purple-50/80 dark:bg-purple-950/20',
                color: 'text-purple-700 dark:text-purple-400',
              },
              {
                label: 'Media diaria',
                value: metrics?.daily_trend && metrics.daily_trend.length > 0
                  ? (metrics.total_completed / metrics.daily_trend.length).toFixed(1)
                  : '—',
                icon: TrendingUp,
                gradient: 'from-amber-500 to-amber-400',
                bg: 'bg-amber-50/80 dark:bg-amber-950/20',
                color: 'text-amber-700 dark:text-amber-400',
              },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-2xl border border-border/40 p-4 sm:p-5 ${kpi.bg} relative overflow-hidden group hover:shadow-sm transition-shadow`}>
                {/* Decorative blur */}
                <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-[0.08] blur-2xl group-hover:opacity-[0.12] transition-opacity`} />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-sm`}>
                      <kpi.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <p className={`text-xl sm:text-2xl font-heading font-bold ${kpi.color}`}>{kpi.value}</p>
                  {kpi.subtitle && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Daily Trend Chart */}
          {metrics?.daily_trend && metrics.daily_trend.length > 0 && (
            <Card className="rounded-2xl overflow-hidden border-border/50">
              <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Actividad diaria
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {metrics.daily_trend.length} días
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-5">
                <div className="flex items-end gap-[3px] sm:gap-1 h-20 sm:h-28">
                  {metrics.daily_trend.map((day, i) => {
                    const height = maxTrendCount > 0 ? (day.count / maxTrendCount) * 100 : 0;
                    const isToday = i === metrics.daily_trend.length - 1;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 group/bar relative cursor-default"
                        title={`${day.date}: ${day.count} preparaciones`}
                      >
                        <div
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            isToday
                              ? 'bg-gradient-to-t from-primary to-primary/60 shadow-sm'
                              : day.count > 0
                                ? 'bg-gradient-to-t from-blue-400/70 to-blue-300/50 dark:from-blue-500/50 dark:to-blue-400/30'
                                : 'bg-muted/40'
                          } group-hover/bar:brightness-110`}
                          style={{ height: `${Math.max(height, 3)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-muted-foreground">
                  <span>{metrics.daily_trend[0]?.date?.slice(5)}</span>
                  <span className="font-medium text-foreground">Hoy</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preparer Ranking */}
          {metrics?.preparer_ranking && metrics.preparer_ranking.length > 0 && (
            <Card className="rounded-2xl overflow-hidden border-border/50">
              <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm">
                    <Trophy className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-heading font-bold">Ranking de preparadores</CardTitle>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Por vehículos completados</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-5">
                <div className="space-y-4">
                  {metrics.preparer_ranking.map((preparer, index) => {
                    const maxCount = metrics.preparer_ranking[0]?.completed_count || 1;
                    const barWidth = (preparer.completed_count / maxCount) * 100;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={preparer.name} className="flex items-center gap-3">
                        <div className="w-7 sm:w-8 text-center shrink-0">
                          {index < 3 ? (
                            <span className="text-lg sm:text-xl">{medals[index]}</span>
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-xs sm:text-sm font-medium truncate">{preparer.name}</span>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <span className="text-xs font-heading font-bold text-foreground">{preparer.completed_count}</span>
                              {preparer.avg_duration_minutes && (
                                <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatDuration(preparer.avg_duration_minutes)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${
                                index === 0 ? 'bg-gradient-to-r from-amber-400 to-amber-300' :
                                index === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-300' :
                                index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-500' :
                                'bg-gradient-to-r from-blue-400 to-blue-300 dark:from-blue-500 dark:to-blue-400'
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* History Table */}
          <Card className="rounded-2xl overflow-hidden border-border/50">
            <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5 border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Historial detallado
                  </CardTitle>
                </div>
                {historyData?.total !== undefined && (
                  <Badge variant="outline" className="text-[10px] font-mono">{historyData.total} registros</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-12 sm:py-16 text-muted-foreground">
                  <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                    <History className="h-7 w-7 opacity-40" />
                  </div>
                  <p className="font-heading font-semibold text-sm">Sin datos en este período</p>
                  <p className="text-xs mt-1">Selecciona otro rango de fechas</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Card list */}
                  <div className="block sm:hidden divide-y divide-border/40">
                    {items.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm">{item.matricula}</span>
                            <span className="text-xs text-muted-foreground">{item.modelo || ''}</span>
                          </div>
                          {item.met_deadline === null ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : item.met_deadline ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-[10px] px-1.5 py-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              A tiempo
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-[10px] px-1.5 py-0.5">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              Retrasado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.completed_by_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                              {formatDuration(item.duration_minutes)}
                            </Badge>
                            <span>{formatDateShort(item.completed_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border/40 bg-muted/10">
                          <TableHead className="font-heading text-[11px] uppercase tracking-wider font-semibold">Matrícula</TableHead>
                          <TableHead className="font-heading text-[11px] uppercase tracking-wider font-semibold">Modelo</TableHead>
                          <TableHead className="font-heading text-[11px] uppercase tracking-wider font-semibold">Preparador</TableHead>
                          <TableHead className="font-heading text-[11px] uppercase tracking-wider font-semibold">Fecha</TableHead>
                          <TableHead className="font-heading text-[11px] uppercase tracking-wider font-semibold">Duración</TableHead>
                          <TableHead className="font-heading text-[11px] uppercase tracking-wider font-semibold">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-mono font-bold text-sm">{item.matricula}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.modelo || '—'}</TableCell>
                            <TableCell className="text-sm font-medium">{item.completed_by_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.completed_at)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {formatDuration(item.duration_minutes)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.met_deadline === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : item.met_deadline ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  A tiempo
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Retrasado
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border/40 bg-muted/10">
                      <p className="text-xs text-muted-foreground">
                        Pág. {page} de {totalPages}
                      </p>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Preparation Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function Preparation() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('preparation.manage');
  const canViewProgress = hasPermission('preparation.view_progress');

  return (
    <AppLayout title="Preparación">
      <div className="space-y-6 sm:space-y-8 pb-8">
        {/* Hero Header — Navy gradient with gold accent */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#001321] via-[#0a2540] to-[#162d44] p-5 sm:p-7 shadow-lg">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 h-40 w-40 sm:h-56 sm:w-56 rounded-full bg-[#c9a96e]/8 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 left-1/4 h-28 w-28 rounded-full bg-blue-500/8 blur-2xl pointer-events-none" />
          <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-[#c9a96e]/5 blur-xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-[#c9a96e] to-[#a88a52] flex items-center justify-center shadow-lg shadow-[#c9a96e]/20">
                <SprayCan className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">
                  Preparación
                </h1>
                <p className="text-sm text-white/50 mt-0.5">
                  Gestión y seguimiento en tiempo real
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.08]">
                <Zap className="h-3.5 w-3.5 text-[#c9a96e]" />
                <span className="text-xs text-white/70 font-medium">Auto-refresh 15s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-11 sm:h-10 rounded-xl bg-muted/70 p-1 border border-border/30">
            <TabsTrigger
              value="active"
              className="gap-1.5 text-xs sm:text-sm rounded-lg font-medium data-[state=active]:shadow-sm data-[state=active]:font-semibold"
            >
              <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">En curso</span>
              <span className="sm:hidden">Curso</span>
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="gap-1.5 text-xs sm:text-sm rounded-lg font-medium data-[state=active]:shadow-sm data-[state=active]:font-semibold"
            >
              <SprayCan className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Lista
            </TabsTrigger>
            {canViewProgress && (
              <TabsTrigger
                value="history"
                className="gap-1.5 text-xs sm:text-sm rounded-lg font-medium data-[state=active]:shadow-sm data-[state=active]:font-semibold"
              >
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Historial</span>
                <span className="sm:hidden">Hist.</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active" className="mt-5 sm:mt-6">
            {canViewProgress && <ActivePreparationsPanel />}
            {!canViewProgress && (
              <Card className="rounded-2xl border-dashed border-2 border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-14 sm:py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
                    <Timer className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-heading font-bold text-foreground">Acceso restringido</p>
                  <p className="text-sm text-muted-foreground mt-1.5 text-center max-w-xs">
                    No tienes permiso para ver las preparaciones en curso. Contacta con tu administrador.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-5 sm:mt-6">
            <ManualPreparationList />
          </TabsContent>

          {canViewProgress && (
            <TabsContent value="history" className="mt-5 sm:mt-6">
              <HistoryPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
