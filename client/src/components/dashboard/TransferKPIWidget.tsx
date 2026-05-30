/**
 * TransferKPIWidget — Compact widget showing transfer KPIs for the main Dashboard.
 * Shows: active requests, pending revenue, monthly margin, and a mini bar chart of broker performance.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Repeat2, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

interface TransferKPIs {
  activeCount: number;
  pendingCount: number;
  completedThisMonth: number;
  monthlyRevenue: number;
  monthlyCost: number;
  monthlyMargin: number;
  marginPercent: number;
  topBrokers: { name: string; count: number; revenue: number }[];
}

export function TransferKPIWidget() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  const monthStart = useMemo(() => startOfMonth(new Date()).toISOString(), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()).toISOString(), []);

  const { data: kpis, isLoading } = useQuery<TransferKPIs | null>({
    queryKey: ['transfer-dashboard-kpis', organization?.id, monthStart],
    queryFn: async () => {
      if (!organization?.id) return null;

      // Fetch all requests for this month
      const { data: requests, error } = await supabaseQuery
        .from('transfer_requests')
        .select('id, status, broker_name, client_total, provider_cost, internal_margin, created_at')
        .eq('organization_id', organization.id)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      if (error || !requests) return null;

      const active = requests.filter((r: any) =>
        ['pendiente', 'en_gestion', 'presupuesto_enviado', 'aceptado', 'confirmado', 'en_curso'].includes(r.status)
      );
      const pending = requests.filter((r: any) =>
        ['pendiente', 'en_gestion'].includes(r.status)
      );
      const completed = requests.filter((r: any) =>
        ['completado', 'facturado'].includes(r.status)
      );

      const monthlyRevenue = completed.reduce((sum: number, r: any) => sum + (r.client_total || 0), 0);
      const monthlyCost = completed.reduce((sum: number, r: any) => sum + (r.provider_cost || 0), 0);
      const monthlyMargin = completed.reduce((sum: number, r: any) => sum + (r.internal_margin || 0), 0);
      const marginPercent = monthlyRevenue > 0 ? (monthlyMargin / monthlyRevenue) * 100 : 0;

      // Top brokers by count
      const brokerMap = new Map<string, { name: string; count: number; revenue: number }>();
      for (const r of requests) {
        const name = r.broker_name || 'Sin broker';
        const existing = brokerMap.get(name) || { name, count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += r.client_total || 0;
        brokerMap.set(name, existing);
      }
      const topBrokers = Array.from(brokerMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        activeCount: active.length,
        pendingCount: pending.length,
        completedThisMonth: completed.length,
        monthlyRevenue,
        monthlyCost,
        monthlyMargin,
        marginPercent,
        topBrokers,
      };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!kpis) return null;

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: undefined });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Repeat2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <CardTitle className="text-base font-semibold">Transfers del mes</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/reports/transfers')}
          >
            Ver reportes
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Active */}
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground">Activas</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{kpis.activeCount}</p>
            {kpis.pendingCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                {kpis.pendingCount} pendientes
              </Badge>
            )}
          </div>

          {/* Completed */}
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Completadas</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{kpis.completedThisMonth}</p>
          </div>

          {/* Revenue */}
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-muted-foreground">Facturado</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(kpis.monthlyRevenue)}</p>
          </div>

          {/* Margin */}
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Margen</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(kpis.monthlyMargin)}</p>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${
                kpis.marginPercent >= 20
                  ? 'border-emerald-300 text-emerald-600'
                  : kpis.marginPercent >= 10
                  ? 'border-amber-300 text-amber-600'
                  : 'border-red-300 text-red-600'
              }`}
            >
              {kpis.marginPercent.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Top Brokers mini-list */}
        {kpis.topBrokers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top brokers</p>
            <div className="space-y-1.5">
              {kpis.topBrokers.map((broker, idx) => (
                <div key={broker.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[140px]">{broker.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{broker.count} sol.</span>
                    <span className="font-medium text-foreground">{formatCurrency(broker.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
