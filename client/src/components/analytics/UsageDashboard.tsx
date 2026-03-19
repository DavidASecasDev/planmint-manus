import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useFeedback } from '@/hooks/useFeedback';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  CheckSquare,
  Users,
  Kanban,
  Calendar,
  Search,
  Bell,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function UsageDashboard() {
  const { stats, dailyStats, isLoading } = useAnalytics();
  const { feedbackList, isLoading: feedbackLoading } = useFeedback();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total de tareas',
      value: stats.totalTasks,
      icon: CheckSquare,
      description: `${stats.tasksCreatedThisWeek} creadas esta semana`,
    },
    {
      title: 'Usuarios activos',
      value: stats.activeUsers,
      icon: Users,
      description: 'En tu organización',
    },
    {
      title: 'Completadas esta semana',
      value: stats.tasksCompletedThisWeek,
      icon: TrendingUp,
      description: `${stats.tasksCreatedThisWeek} creadas`,
    },
    {
      title: 'Recordatorios activos',
      value: stats.remindersCreated,
      icon: Bell,
      description: 'En total',
    },
  ];

  const featureUsage = [
    { name: 'Lista', value: stats.listViews, icon: CheckSquare },
    { name: 'Kanban', value: stats.kanbanViews, icon: Kanban },
    { name: 'Calendario', value: stats.calendarViews, icon: Calendar },
    { name: 'Búsqueda', value: stats.searchUsage, icon: Search },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Uso y actividad</h3>
        <p className="text-sm text-muted-foreground">
          Estadísticas de uso de tu organización en los últimos 7 días
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily Tasks Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas por día</CardTitle>
            <CardDescription>Creadas vs completadas esta semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="tasks_created"
                    name="Creadas"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="tasks_completed"
                    name="Completadas"
                    fill="hsl(var(--chart-2))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Feature Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uso de vistas</CardTitle>
            <CardDescription>Visitas esta semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {featureUsage.map((feature) => (
                <div key={feature.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <feature.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{feature.name}</span>
                  </div>
                  <span className="text-2xl font-bold">{feature.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monetization Metrics */}
      {(stats.limitReachedEvents > 0 || stats.upgradeClicks > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Métricas de conversión
            </CardTitle>
            <CardDescription>Eventos relacionados con límites de plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div>
                <p className="text-sm text-muted-foreground">Límites alcanzados</p>
                <p className="text-2xl font-bold">{stats.limitReachedEvents}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicks en upgrade</p>
                <p className="text-2xl font-bold">{stats.upgradeClicks}</p>
              </div>
              {stats.limitReachedEvents > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Conversión</p>
                  <p className="text-2xl font-bold">
                    {Math.round((stats.upgradeClicks / stats.limitReachedEvents) * 100)}%
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Feedback */}
      {feedbackList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Feedback reciente
            </CardTitle>
            <CardDescription>Últimos comentarios de tu equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {feedbackList.slice(0, 5).map((feedback) => (
                <div
                  key={feedback.id}
                  className="flex items-start gap-3 border-b border-border pb-3 last:border-0"
                >
                  <span className="text-lg">
                    {feedback.feedback_type === 'suggestion'
                      ? '💡'
                      : feedback.feedback_type === 'problem'
                      ? '🐛'
                      : '💬'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{feedback.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(feedback.created_at), "d 'de' MMMM, HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
