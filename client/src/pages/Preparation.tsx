/*
 * Azul Cars Brand — Preparación
 * Headings: Montserrat 700 | Body: Barlow
 * Cards: border-border/50 shadow-sm | KPIs: p-3/p-4, compact
 * Gold accent: hsl(var(--primary)) for icons/badges
 * Uses PageHeader + standard Card patterns from OperationalPanel
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
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
  ChevronLeft, ChevronRight, ChevronDown,
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
    color: 'text-red-600',
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
    label: 'Vencido',
    pulse: true,
  };
  if (diffMinutes < 30) return {
    color: 'text-orange-600',
    bg: 'bg-orange-500/10',
    border: 'border-l-orange-500',
    label: 'Urgente',
    pulse: true,
  };
  if (diffMinutes < 60) return {
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
    label: 'Pronto',
    pulse: false,
  };
  return {
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
    label: 'Normal',
    pulse: false,
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
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const activePreps = (progressData || []).filter(p => p.started_at);
  const pendingPreps = (progressData || []).filter(p => !p.started_at);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Timer className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              Preparaciones en curso · {activePreps.length + pendingPreps.length} total
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span>{activePreps.length} activas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span>{pendingPreps.length} pendientes</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 px-4 sm:px-6">
        {/* Empty state */}
        {activePreps.length === 0 && pendingPreps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Todo al día</p>
            <p className="text-xs text-muted-foreground mt-0.5">No hay preparaciones pendientes</p>
          </div>
        )}

        {/* Active preparations */}
        <div className="space-y-3">
          {activePreps.map((prep) => {
            const progressPercent = prep.total_tasks > 0 ? (prep.completed_tasks / prep.total_tasks) * 100 : 0;
            const urgency = getUrgencyConfig(prep.deadline_at);

            return (
              <div
                key={prep.id}
                className={`border rounded-lg p-3 sm:p-4 border-l-[3px] ${urgency.border} hover:shadow-md transition-shadow`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg ${urgency.bg} flex items-center justify-center flex-shrink-0`}>
                      <SprayCan className={`h-4 w-4 ${urgency.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm sm:text-base text-foreground">{prep.matricula}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${urgency.color} border-current/30 ${urgency.pulse ? 'animate-pulse' : ''}`}
                        >
                          {urgency.label}
                        </Badge>
                      </div>
                      {prep.modelo && (
                        <span className="text-xs text-muted-foreground">{prep.modelo}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {prep.started_by && (
                      <span className="text-xs text-muted-foreground hidden sm:block">{prep.started_by}</span>
                    )}
                    <Badge variant="outline" className="font-mono text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      {formatElapsedTime(prep.started_at!)}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {prep.completed_tasks}/{prep.total_tasks} tareas
                    </span>
                    <span className="text-xs font-medium text-emerald-600">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Task chips */}
                <div className="flex flex-wrap gap-1.5">
                  {prep.tasks
                    .filter(t => t.task_key !== 'inicio_prep')
                    .map((task) => {
                      const Icon = TASK_ICONS[task.task_key] || CheckCircle2;
                      const label = TASK_LABELS[task.task_key] || task.task_key;
                      return (
                        <div
                          key={task.task_key}
                          className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] px-2 py-1 rounded-md border ${
                            task.completed
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                              : 'bg-muted/50 border-border/50 text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{label}</span>
                          {task.completed && <CheckCircle2 className="h-2.5 w-2.5 ml-0.5 flex-shrink-0" />}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Pending preparations */}
          {pendingPreps.length > 0 && activePreps.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Pendientes de iniciar ({pendingPreps.length})
              </p>
            </div>
          )}
          {pendingPreps.map((prep) => (
            <div key={prep.id} className="border rounded-lg p-3 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <SprayCan className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-bold font-mono text-sm">{prep.matricula}</span>
                  {prep.modelo && <span className="text-xs text-muted-foreground ml-2">{prep.modelo}</span>}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => startMutation.mutate(prep.matricula)}
                disabled={startMutation.isPending}
                className="gap-1.5 w-full sm:w-auto"
              >
                <PlayCircle className="h-4 w-4" />
                Iniciar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <div className="space-y-4 sm:space-y-5">
      {/* Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4 flex-shrink-0" />
          Historial de preparaciones
        </h3>
        <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mes</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="year">Último año</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          {/* KPI Grid — matches OperationalPanel pattern */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">{metrics?.total_completed || 0}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Completadas</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">{formatDuration(metrics?.avg_duration_minutes || null)}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Tiempo medio</p>
                {metrics?.min_duration_minutes && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDuration(metrics.min_duration_minutes)} – {formatDuration(metrics.max_duration_minutes)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <Target className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">
                  {metrics?.deadline_compliance_rate !== null ? `${metrics?.deadline_compliance_rate}%` : '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cumplimiento</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">
                  {metrics?.daily_trend && metrics.daily_trend.length > 0
                    ? (metrics.total_completed / metrics.daily_trend.length).toFixed(1)
                    : '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Media diaria</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend Chart */}
          {metrics?.daily_trend && metrics.daily_trend.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 flex-shrink-0" />
                  Preparaciones por día
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4">
                <div className="flex items-end gap-[2px] sm:gap-1 h-20 sm:h-24">
                  {metrics.daily_trend.map((day, i) => {
                    const height = maxTrendCount > 0 ? (day.count / maxTrendCount) * 100 : 0;
                    const isToday = i === metrics.daily_trend.length - 1;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 group relative"
                        title={`${day.date}: ${day.count} preparaciones`}
                      >
                        <div
                          className={`w-full rounded-t transition-all ${
                            isToday
                              ? 'bg-primary'
                              : day.count > 0
                                ? 'bg-primary/40'
                                : 'bg-muted'
                          }`}
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>{metrics.daily_trend[0]?.date?.slice(5)}</span>
                  <span>Hoy</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preparer Ranking */}
          {metrics?.preparer_ranking && metrics.preparer_ranking.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  Ranking de preparadores
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4">
                <div className="space-y-3">
                  {metrics.preparer_ranking.map((preparer, index) => {
                    const maxCount = metrics.preparer_ranking[0]?.completed_count || 1;
                    const barWidth = (preparer.completed_count / maxCount) * 100;
                    return (
                      <div key={preparer.name} className="flex items-center gap-2 sm:gap-3">
                        <span className={`text-xs font-bold w-5 sm:w-6 text-center flex-shrink-0 ${
                          index === 0 ? 'text-amber-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-700' : 'text-muted-foreground'
                        }`}>
                          #{index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs sm:text-sm font-medium truncate">{preparer.name}</span>
                            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
                              <span className="font-semibold text-foreground">{preparer.completed_count}</span>
                              {preparer.avg_duration_minutes && (
                                <span className="hidden sm:flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(preparer.avg_duration_minutes)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-amber-600' : 'bg-primary/50'
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
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <History className="h-4 w-4 flex-shrink-0" />
                Detalle de preparaciones completadas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Sin preparaciones en este período</p>
                  <p className="text-xs mt-0.5">Selecciona otro rango de fechas</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Card list */}
                  <div className="block sm:hidden space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm">{item.matricula}</span>
                          {item.met_deadline === null ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : item.met_deadline ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 text-[10px] px-1.5 py-0.5 border-0">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              A tiempo
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/10 text-[10px] px-1.5 py-0.5 border-0">
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
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Completado por</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Duración</TableHead>
                          <TableHead>Deadline</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold">{item.matricula}</TableCell>
                            <TableCell className="text-muted-foreground">{item.modelo || '—'}</TableCell>
                            <TableCell>{item.completed_by_name}</TableCell>
                            <TableCell className="text-sm">{formatDate(item.completed_at)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {formatDuration(item.duration_minutes)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.met_deadline === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : item.met_deadline ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 border-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  A tiempo
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/10 border-0">
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
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-muted-foreground">
                        Pág. {page}/{totalPages} ({historyData?.total})
                      </p>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
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
      <div className="space-y-6">
        <PageHeader
          title="Preparación"
          description="Gestiona la preparación de vehículos y monitoriza el progreso en tiempo real"
          icon={SprayCan}
        />

        <Tabs defaultValue="active">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="active" className="gap-1.5 text-xs sm:text-sm">
              <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">En curso</span>
              <span className="sm:hidden">Curso</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 text-xs sm:text-sm">
              <SprayCan className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Lista
            </TabsTrigger>
            {canViewProgress && (
              <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Historial</span>
                <span className="sm:hidden">Hist.</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-4">
            {canViewProgress && <ActivePreparationsPanel />}
            {!canViewProgress && (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                    <Timer className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Acceso restringido</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Contacta con tu administrador para obtener acceso</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <ManualPreparationList />
          </TabsContent>

          {canViewProgress && (
            <TabsContent value="history" className="mt-4">
              <HistoryPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
