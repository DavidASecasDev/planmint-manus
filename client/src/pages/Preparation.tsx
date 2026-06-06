import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiInvoke } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { ManualPreparationList } from '@/components/dashboard/ManualPreparationList';

// Task icons mapping
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

function getUrgencyColor(deadlineAt: string): string {
  const now = Date.now();
  const deadline = new Date(deadlineAt).getTime();
  const diffMinutes = (deadline - now) / 60000;
  if (diffMinutes < 0) return 'text-red-600 bg-red-50 border-red-200';
  if (diffMinutes < 30) return 'text-orange-600 bg-orange-50 border-orange-200';
  if (diffMinutes < 60) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-emerald-600 bg-emerald-50 border-emerald-200';
}

// ============================================================================
// Active Preparations Panel
// ============================================================================
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
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Timer className="h-5 w-5" />
            Preparaciones en curso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activePreps = (progressData || []).filter(p => p.started_at);
  const pendingPreps = (progressData || []).filter(p => !p.started_at);

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Timer className="h-5 w-5 text-blue-600" />
          Preparaciones en curso
          {activePreps.length > 0 && (
            <Badge variant="secondary" className="ml-2">{activePreps.length} activas</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {activePreps.length === 0 && pendingPreps.length === 0 && (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 text-emerald-500" />
            <p className="font-medium text-sm sm:text-base">No hay preparaciones en curso</p>
            <p className="text-xs sm:text-sm">Los vehículos pendientes aparecerán aquí cuando se inicie su preparación</p>
          </div>
        )}

        {/* Active preparations (started) */}
        {activePreps.map((prep) => {
          const progressPercent = prep.total_tasks > 0 ? (prep.completed_tasks / prep.total_tasks) * 100 : 0;
          const urgencyClass = getUrgencyColor(prep.deadline_at);

          return (
            <div key={prep.id} className={`border rounded-lg p-3 sm:p-4 ${urgencyClass}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="font-bold text-base sm:text-lg font-mono">{prep.matricula}</span>
                  {prep.modelo && <span className="text-xs sm:text-sm opacity-80 truncate">{prep.modelo}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="font-mono font-semibold text-sm sm:text-base">{formatElapsedTime(prep.started_at!)}</span>
                </div>
              </div>

              {prep.started_by && (
                <p className="text-xs mb-2 opacity-70">Iniciado por: {prep.started_by}</p>
              )}

              <div className="mb-2">
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span>{prep.completed_tasks}/{prep.total_tasks} tareas</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* Task list - responsive grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 mt-3">
                {prep.tasks
                  .filter(t => t.task_key !== 'inicio_prep')
                  .map((task) => {
                    const Icon = TASK_ICONS[task.task_key] || CheckCircle2;
                    const label = TASK_LABELS[task.task_key] || task.task_key;
                    return (
                      <div
                        key={task.task_key}
                        className={`flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-1.5 sm:px-2 py-1 rounded ${
                          task.completed
                            ? 'bg-emerald-100 text-emerald-700 line-through'
                            : 'bg-white/50 text-current'
                        }`}
                      >
                        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}

        {/* Pending preparations (not started yet) */}
        {pendingPreps.length > 0 && (
          <>
            {activePreps.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                  Pendientes de iniciar ({pendingPreps.length})
                </p>
              </div>
            )}
            {pendingPreps.map((prep) => (
              <div key={prep.id} className="border rounded-lg p-3 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-sm sm:text-base">{prep.matricula}</span>
                  {prep.modelo && <span className="text-xs sm:text-sm text-muted-foreground truncate">{prep.modelo}</span>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startMutation.mutate(prep.matricula)}
                  disabled={startMutation.isPending}
                  className="gap-1 w-full sm:w-auto"
                >
                  <PlayCircle className="h-4 w-4" />
                  Iniciar
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// History Panel with Performance Analytics (Mobile-Friendly)
// ============================================================================
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

  // Simple bar chart using divs
  const maxTrendCount = Math.max(...(metrics?.daily_trend?.map(d => d.count) || [1]), 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period selector - stacked on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 sm:h-24" />)}
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          {/* KPI Cards - 2 cols on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-6">
                <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-[11px] sm:text-sm mb-1">
                  <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Total completadas</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{metrics?.total_completed || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-6">
                <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-[11px] sm:text-sm mb-1">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Tiempo medio</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{formatDuration(metrics?.avg_duration_minutes || null)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  Min: {formatDuration(metrics?.min_duration_minutes || null)} / Max: {formatDuration(metrics?.max_duration_minutes || null)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-6">
                <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-[11px] sm:text-sm mb-1">
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Cumplimiento</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">
                  {metrics?.deadline_compliance_rate !== null ? `${metrics?.deadline_compliance_rate}%` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-6">
                <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-[11px] sm:text-sm mb-1">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Media diaria</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold">
                  {metrics?.daily_trend && metrics.daily_trend.length > 0
                    ? (metrics.total_completed / metrics.daily_trend.length).toFixed(1)
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Trend Chart */}
          {metrics?.daily_trend && metrics.daily_trend.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Preparaciones completadas por día
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="flex items-end gap-[2px] h-20 sm:h-24">
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
                            isToday ? 'bg-blue-500' : day.count > 0 ? 'bg-blue-300' : 'bg-muted'
                          }`}
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>{metrics.daily_trend[0]?.date?.slice(5)}</span>
                  <span>Hoy</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preparer Ranking */}
          {metrics?.preparer_ranking && metrics.preparer_ranking.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Ranking de preparadores
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-3">
                  {metrics.preparer_ranking.map((preparer, index) => {
                    const maxCount = metrics.preparer_ranking[0]?.completed_count || 1;
                    const barWidth = (preparer.completed_count / maxCount) * 100;
                    return (
                      <div key={preparer.name} className="flex items-center gap-2 sm:gap-3">
                        <span className={`text-xs sm:text-sm font-bold w-5 sm:w-6 text-center ${
                          index === 0 ? 'text-amber-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-700' : 'text-muted-foreground'
                        }`}>
                          #{index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs sm:text-sm font-medium truncate">{preparer.name}</span>
                            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground shrink-0">
                              <span>{preparer.completed_count}</span>
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
                                index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-gray-300' : index === 2 ? 'bg-amber-600' : 'bg-blue-300'
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

          {/* History Table - Cards on mobile, table on desktop */}
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Detalle de preparaciones completadas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {items.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <History className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay preparaciones completadas en este período</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Card list */}
                  <div className="block sm:hidden space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm">{item.matricula}</span>
                          {item.met_deadline === null ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : item.met_deadline ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] px-1.5 py-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              A tiempo
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0.5">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              Retrasado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.modelo || '—'}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {formatDuration(item.duration_minutes)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.completed_by_name}</span>
                          <span>{formatDateShort(item.completed_at)}</span>
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
                          <TableRow key={item.id}>
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
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  A tiempo
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
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
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Pág. {page}/{totalPages} ({historyData?.total})
                      </p>
                      <div className="flex gap-2">
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

// ============================================================================
// Main Preparation Page
// ============================================================================
export default function Preparation() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('preparation.manage');
  const canViewProgress = hasPermission('preparation.view_progress');

  return (
    <AppLayout title="Preparación">
      <PageHeader
        title="Preparación"
        description="Gestiona la preparación de vehículos y monitoriza el progreso en tiempo real"
        icon={SprayCan}
      />

      <Tabs defaultValue="active" className="mt-4 sm:mt-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="active" className="gap-1 sm:gap-1.5 text-xs sm:text-sm">
            <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">En curso</span>
            <span className="xs:hidden">Curso</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1 sm:gap-1.5 text-xs sm:text-sm">
            <SprayCan className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Lista
          </TabsTrigger>
          {canViewProgress && (
            <TabsTrigger value="history" className="gap-1 sm:gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Historial</span>
              <span className="xs:hidden">Hist.</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="mt-3 sm:mt-4 space-y-4 sm:space-y-6">
          {canViewProgress && <ActivePreparationsPanel />}
          {!canViewProgress && (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Timer className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-sm sm:text-base">No tienes permiso para ver las preparaciones en curso</p>
              <p className="text-xs sm:text-sm">Contacta con tu administrador para obtener acceso</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-3 sm:mt-4">
          <ManualPreparationList />
        </TabsContent>

        {canViewProgress && (
          <TabsContent value="history" className="mt-3 sm:mt-4">
            <HistoryPanel />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
