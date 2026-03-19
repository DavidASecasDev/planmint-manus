import { SuperAdminLayout } from './SuperAdminLayout';
import { usePlatformStats, usePlatformFeedback, usePlatformOrganizations } from '@/hooks/useSuperAdmin';
import { useSuperAdminAlerts, usePaymentStats } from '@/hooks/useSuperAdminAlerts';
import { useMRRMetrics } from '@/hooks/useMRRMetrics';
import { useTrialMetrics } from '@/hooks/useTrialMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, MessageSquare, TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight, AlertTriangle, DollarSign, Bell, ChevronRight, Clock, Percent, RefreshCw } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatEUR } from '@/lib/billing';

const PLAN_COLORS: Record<string, string> = {
  free: 'hsl(var(--muted-foreground))',
  pro: 'hsl(var(--primary))',
  team: 'hsl(142, 76%, 36%)',
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: feedback, isLoading: feedbackLoading } = usePlatformFeedback();
  const { data: organizations, isLoading: orgsLoading } = usePlatformOrganizations();
  const { unreadAlerts, activePaymentCount, isLoading: alertsLoading } = useSuperAdminAlerts();
  const { data: paymentStats, isLoading: paymentStatsLoading } = usePaymentStats();
  const { data: mrrMetrics, isLoading: mrrLoading } = useMRRMetrics();
  const { data: trialMetrics, isLoading: trialsLoading } = useTrialMetrics();

  const recentOrgs = organizations?.slice(0, 5) || [];
  const recentFeedback = feedback?.slice(0, 5) || [];
  const recentAlerts = unreadAlerts.slice(0, 5);

  // Calculate growth chart data (last 6 months)
  const growthData = useMemo(() => {
    if (!organizations) return [];
    
    const months: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMM', { locale: es });
      
      const count = organizations.filter(org => {
        const orgMonth = format(new Date(org.created_at), 'yyyy-MM');
        return orgMonth <= monthKey;
      }).length;
      
      months.push({ month: monthLabel, total: count });
    }
    return months;
  }, [organizations]);

  // Calculate plan distribution for pie chart
  const planData = useMemo(() => {
    if (!stats?.planBreakdown) return [];
    return Object.entries(stats.planBreakdown).map(([plan, count]) => ({
      name: plan.toUpperCase(),
      value: count as number,
      color: PLAN_COLORS[plan] || 'hsl(var(--muted))',
    }));
  }, [stats?.planBreakdown]);

  // Calculate trends
  const lastMonthOrgs = organizations?.filter(org => {
    const created = new Date(org.created_at);
    const oneMonthAgo = subMonths(new Date(), 1);
    return created >= oneMonthAgo;
  }).length || 0;

  const previousMonthOrgs = organizations?.filter(org => {
    const created = new Date(org.created_at);
    const oneMonthAgo = subMonths(new Date(), 1);
    const twoMonthsAgo = subMonths(new Date(), 2);
    return created >= twoMonthsAgo && created < oneMonthAgo;
  }).length || 0;

  const growthPercent = previousMonthOrgs > 0 
    ? Math.round(((lastMonthOrgs - previousMonthOrgs) / previousMonthOrgs) * 100)
    : lastMonthOrgs > 0 ? 100 : 0;

  return (
    <SuperAdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Payment Alerts Banner - Only show if there are active payment issues */}
        {(activePaymentCount > 0 || (paymentStats?.pastDueCount || 0) > 0) && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Alertas de Impago</h3>
                    <p className="text-sm text-muted-foreground">
                      {paymentStats?.pastDueCount || 0} suscripciones con pago pendiente · 
                      {formatEUR(paymentStats?.mrrAtRisk || 0)} MRR en riesgo
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => navigate('/super-admin/alerts')}
                >
                  Ver Alertas
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MRR & Financial Metrics Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">MRR Total</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {mrrLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
              <div>
                  <span className="text-3xl font-bold">{formatEUR(mrrMetrics?.totalMRR || 0)}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    ARR: {formatEUR(mrrMetrics?.totalARR || 0)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Churn Rate</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              {mrrLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${(mrrMetrics?.churnRate || 0) > 5 ? 'text-destructive' : ''}`}>
                    {mrrMetrics?.churnRate || 0}%
                  </span>
                  <span className="text-xs text-muted-foreground">mensual</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conversión Trial</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Percent className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              {mrrLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-600">
                    {mrrMetrics?.conversionRate || 0}%
                  </span>
                  <span className="text-xs text-muted-foreground">trial → paid</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suscripciones Activas</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              {mrrLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{mrrMetrics?.activeSubscriptions || 0}</span>
                  {(mrrMetrics?.newSubscriptionsLastMonth || 0) > 0 && (
                    <span className="text-sm text-green-600 flex items-center">
                      <ArrowUpRight className="h-4 w-4" />
                      +{mrrMetrics?.newSubscriptionsLastMonth}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trials at Risk Section */}
        {((trialMetrics?.trialsExpiringIn7Days?.length || 0) > 0 || (trialMetrics?.expiredNotConverted?.length || 0) > 0) && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Trials en Riesgo</CardTitle>
                    <CardDescription>
                      {trialMetrics?.activeTrials || 0} trials activos · {trialMetrics?.conversionRate || 0}% tasa de conversión
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Expiring Soon */}
                {(trialMetrics?.trialsExpiringIn7Days?.length || 0) > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-orange-600 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Expiran en 7 días ({trialMetrics?.trialsExpiringIn7Days?.length})
                    </h4>
                    <div className="space-y-2">
                      {trialMetrics?.trialsExpiringIn7Days?.slice(0, 3).map((trial) => (
                        <div 
                          key={trial.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-background/50 cursor-pointer hover:bg-background"
                          onClick={() => navigate(`/super-admin/organizations/${trial.id}`)}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{trial.name}</span>
                          </div>
                          <Badge variant="outline" className="text-orange-600 border-orange-500/30">
                            {trial.daysRemaining} días
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expired Not Converted */}
                {(trialMetrics?.expiredNotConverted?.length || 0) > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-600 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Expirados sin convertir ({trialMetrics?.expiredNotConverted?.length})
                    </h4>
                    <div className="space-y-2">
                      {trialMetrics?.expiredNotConverted?.slice(0, 3).map((trial) => (
                        <div 
                          key={trial.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-background/50 cursor-pointer hover:bg-background"
                          onClick={() => navigate(`/super-admin/organizations/${trial.id}`)}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{trial.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {trial.memberCount} miembros
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Organizaciones
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stats?.totalOrganizations}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Usuarios
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stats?.totalUsers}</div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nuevos (30 días)
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stats?.recentOrganizations}</span>
                  {growthPercent !== 0 && (
                    <span className={`text-sm flex items-center ${growthPercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {growthPercent > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(growthPercent)}%
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Feedback Total
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stats?.totalFeedback}</div>
              )}
            </CardContent>
          </Card>

          {/* Payment Alerts KPI */}
          <Card 
            className="relative overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate('/super-admin/alerts')}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Impagos
              </CardTitle>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                (paymentStats?.pastDueCount || 0) > 0 ? 'bg-red-500/10' : 'bg-green-500/10'
              }`}>
                {(paymentStats?.pastDueCount || 0) > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : (
                  <DollarSign className="h-5 w-5 text-green-600" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {paymentStatsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${
                    (paymentStats?.pastDueCount || 0) > 0 ? 'text-destructive' : ''
                  }`}>
                    {paymentStats?.pastDueCount || 0}
                  </span>
                  {(paymentStats?.mrrAtRisk || 0) > 0 && (
                    <span className="text-sm text-destructive">{formatEUR(paymentStats?.mrrAtRisk || 0)}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* MRR Evolution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Evolución MRR
              </CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              {mrrLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mrrMetrics?.mrrHistory || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `€${v}`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`€${value.toLocaleString()}`, 'MRR']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="mrr" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Crecimiento de Organizaciones
              </CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorTotal)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Distribución de Planes
              </CardTitle>
              <CardDescription>Por tipo de suscripción</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : planData.length > 0 ? (
                <div className="h-[200px] flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={planData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {planData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {planData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm font-medium">{entry.name}</span>
                        <span className="text-sm text-muted-foreground ml-auto">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No hay datos de planes
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Organizations */}
          <Card>
            <CardHeader>
              <CardTitle>Organizaciones Recientes</CardTitle>
              <CardDescription>Últimas 5 organizaciones registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentOrgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay organizaciones aún</p>
              ) : (
                <div className="space-y-3">
                  {recentOrgs.map((org) => (
                    <div key={org.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(org.created_at), "d 'de' MMM, yyyy", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{org.memberCount} miembros</Badge>
                        <Badge variant={org.subscription?.plan === 'free' ? 'secondary' : 'default'}>
                          {org.subscription?.plan || 'free'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback Reciente</CardTitle>
              <CardDescription>Últimos 5 mensajes de feedback</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentFeedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay feedback aún</p>
              ) : (
                <div className="space-y-3">
                  {recentFeedback.map((fb: any) => (
                    <div key={fb.id} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={
                          fb.feedback_type === 'bug' ? 'destructive' :
                          fb.feedback_type === 'suggestion' ? 'default' : 'secondary'
                        }>
                          {fb.feedback_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(fb.created_at), "d MMM", { locale: es })}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">{fb.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fb.organizations?.name || 'Org desconocida'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
