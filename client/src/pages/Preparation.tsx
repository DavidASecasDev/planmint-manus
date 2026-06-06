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
  SprayCan, Clock, PlayCircle, CheckCircle2, AlertTriangle,
  Fuel, Gauge, Smartphone, Sparkles, Droplets, Timer,
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

function getUrgencyColor(deadlineAt: string): string {
  const now = Date.now();
  const deadline = new Date(deadlineAt).getTime();
  const diffMinutes = (deadline - now) / 60000;
  if (diffMinutes < 0) return 'text-red-600 bg-red-50 border-red-200';
  if (diffMinutes < 30) return 'text-orange-600 bg-orange-50 border-orange-200';
  if (diffMinutes < 60) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-emerald-600 bg-emerald-50 border-emerald-200';
}

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
    refetchInterval: 15000, // Refresh every 15 seconds
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

  if (!canViewProgress) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5" />
            Preparaciones en curso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-5 w-5 text-blue-600" />
          Preparaciones en curso
          {activePreps.length > 0 && (
            <Badge variant="secondary" className="ml-2">{activePreps.length} activas</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activePreps.length === 0 && pendingPreps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
            <p className="font-medium">No hay preparaciones en curso</p>
            <p className="text-sm">Los vehículos pendientes aparecerán aquí cuando se inicie su preparación</p>
          </div>
        )}

        {/* Active preparations (started) */}
        {activePreps.map((prep) => {
          const progressPercent = prep.total_tasks > 0 ? (prep.completed_tasks / prep.total_tasks) * 100 : 0;
          const urgencyClass = getUrgencyColor(prep.deadline_at);

          return (
            <div key={prep.id} className={`border rounded-lg p-4 ${urgencyClass}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg font-mono">{prep.matricula}</span>
                  {prep.modelo && <span className="text-sm opacity-80">{prep.modelo}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-mono font-semibold">{formatElapsedTime(prep.started_at!)}</span>
                </div>
              </div>

              {prep.started_by && (
                <p className="text-xs mb-2 opacity-70">Iniciado por: {prep.started_by}</p>
              )}

              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>{prep.completed_tasks}/{prep.total_tasks} tareas</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* Task list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-3">
                {prep.tasks
                  .filter(t => t.task_key !== 'inicio_prep')
                  .map((task) => {
                    const Icon = TASK_ICONS[task.task_key] || CheckCircle2;
                    const label = TASK_LABELS[task.task_key] || task.task_key;
                    return (
                      <div
                        key={task.task_key}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                          task.completed
                            ? 'bg-emerald-100 text-emerald-700 line-through'
                            : 'bg-white/50 text-current'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
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
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Pendientes de iniciar ({pendingPreps.length})
                </p>
              </div>
            )}
            {pendingPreps.map((prep) => (
              <div key={prep.id} className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between">
                <div>
                  <span className="font-bold font-mono">{prep.matricula}</span>
                  {prep.modelo && <span className="text-sm text-muted-foreground ml-2">{prep.modelo}</span>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startMutation.mutate(prep.matricula)}
                  disabled={startMutation.isPending}
                  className="gap-1"
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

      <div className="space-y-6 mt-6">
        {/* Active preparations panel (admin/owner) */}
        {canViewProgress && <ActivePreparationsPanel />}

        {/* Preparation list (same as dashboard) */}
        <ManualPreparationList />
      </div>
    </AppLayout>
  );
}
