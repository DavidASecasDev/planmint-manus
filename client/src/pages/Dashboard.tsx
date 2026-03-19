import { AppLayout } from '@/components/layout/AppLayout';
import { getRoleLabel } from '@/lib/roleHierarchy';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Target, CheckCircle2, Clock, ArrowRight, Layers, ClipboardList, Plus, Calendar, Columns3, Lightbulb, Download, Smartphone, LayoutTemplate, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklyDigestCard } from '@/components/ai/WeeklyDigestCard';
import { InsightsCard } from '@/components/ai/InsightsCard';
import { usePWA } from '@/hooks/usePWA';
import { ActivationChecklist } from '@/components/growth/ActivationChecklist';

import { useTemplates } from '@/hooks/useTemplates';

export default function Dashboard() {
  const { profile, organization } = useAuth();
  const { role } = usePermissions();
  const { stats, loading: statsLoading } = useDashboardStats();
  const { shouldShowInstallPrompt, installApp, isInstalled } = usePWA();
  const { appliedTemplates, loadingApplied } = useTemplates();
  const navigate = useNavigate();

  // Check if org has applied any template
  const hasAppliedTemplate = appliedTemplates && appliedTemplates.length > 0;

  // Use role from organization_members (via usePermissions) with fallback
  const displayRole = role;

  const displayRoleLabel = (roleStr: string | null | undefined) => {
    if (!roleStr) return 'Miembro';
    return getRoleLabel(roleStr);
  };

  const quickActions = [
    { title: 'Tareas', description: 'Gestiona tus tareas', icon: ClipboardList, href: '/tasks', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { title: 'Áreas', description: 'Organiza por áreas', icon: Layers, href: '/areas', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
    { title: 'Equipo', description: 'Gestiona miembros', icon: Users, href: '/team', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  ];

  const statCards = [
    { title: 'Equipo', value: stats.teamCount, description: 'Miembros del equipo', icon: Users, color: 'text-blue-500' },
    { title: 'Áreas', value: stats.areasCount, description: 'Áreas activas', icon: Target, color: 'text-purple-500' },
    { title: 'Completadas', value: stats.completedCount, description: 'Tareas completadas', icon: CheckCircle2, color: 'text-green-500' },
    { title: 'Pendientes', value: stats.pendingCount, description: 'Tareas pendientes', icon: Clock, color: 'text-orange-500' },
  ];

  // Check if this is a "new" user (no tasks yet)
  const isNewUser = stats.completedCount === 0 && stats.pendingCount === 0;

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-8">
        {/* Activation Checklist */}
        <ActivationChecklist />
        
        {/* Welcome Section */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-8 border border-border/50">
          <h2 className="text-2xl font-bold text-foreground">
            ¡Bienvenido, {profile?.name || 'Usuario'}!
          </h2>
          <p className="mt-2 text-muted-foreground">
            Estás en <span className="font-semibold text-foreground">{organization?.name}</span> como <span className="font-semibold text-foreground">{displayRoleLabel(displayRole)}</span>
          </p>
        </div>

        {/* PWA Install Banner */}
        {shouldShowInstallPrompt() && !isInstalled && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary flex-shrink-0">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground">Instala la app</h4>
                  <p className="text-sm text-muted-foreground">
                    Accede más rápido y usa PlanMint incluso sin conexión
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button onClick={installApp} size="sm" className="flex-1 sm:flex-none gap-2">
                    <Download className="h-4 w-4" />
                    Instalar
                  </Button>
                  <Button onClick={() => navigate('/install')} variant="ghost" size="sm">
                    Más info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Template Suggestion for New Users */}
        {isNewUser && !statsLoading && !loadingApplied && !hasAppliedTemplate && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-purple-500/5 shadow-md overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-white flex-shrink-0 shadow-lg">
                  <LayoutTemplate className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">¿Quieres empezar más rápido?</h4>
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aplica una plantilla predefinida y tendrás áreas, tareas y objetivos listos en segundos
                  </p>
                </div>
                <Button onClick={() => navigate('/templates')} className="gap-2 w-full sm:w-auto">
                  <LayoutTemplate className="h-4 w-4" />
                  Ver plantillas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="border-border/50 shadow-sm hover-lift transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                {statsLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Accesos rápidos</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {quickActions.map((action) => (
              <Card 
                key={action.title} 
                className="border-border/50 shadow-sm hover-lift cursor-pointer group"
                onClick={() => navigate(action.href)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color}`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{action.title}</h4>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Onboarding Guide for New Users */}
        {isNewUser && !statsLoading && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Primeros pasos
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border/50 shadow-sm hover-lift cursor-pointer group border-dashed" onClick={() => navigate('/tasks')}>
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Plus className="h-7 w-7" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Crea tu primera tarea</h4>
                  <p className="text-sm text-muted-foreground">Organiza tu trabajo creando tareas simples o con objetivos</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm hover-lift cursor-pointer group border-dashed" onClick={() => navigate('/tasks/kanban')}>
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                    <Columns3 className="h-7 w-7" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Usa el tablero Kanban</h4>
                  <p className="text-sm text-muted-foreground">Arrastra y suelta tareas para cambiar su estado visual</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm hover-lift cursor-pointer group border-dashed" onClick={() => navigate('/tasks/calendar')}>
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                    <Calendar className="h-7 w-7" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Planifica en el calendario</h4>
                  <p className="text-sm text-muted-foreground">Visualiza tus tareas por día, semana o mes</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* AI Section for admin/manager */}
        {(role === 'owner' || role === 'admin' || role === 'manager') && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-purple-500" />
              Inteligencia artificial
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <WeeklyDigestCard />
              <InsightsCard />
            </div>
          </div>
        )}

        {/* Info Card for Established Users */}
        {!isNewUser && !statsLoading && (
          <Card className="border-border/50 shadow-sm bg-muted/30">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Tu progreso</h4>
                  <p className="text-sm text-muted-foreground">
                    Has completado {stats.completedCount} de {stats.completedCount + stats.pendingCount} tareas
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/tasks')} variant="outline" className="gap-2 shrink-0">
                Ver todas las tareas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
