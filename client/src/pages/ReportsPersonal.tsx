import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { KPICard } from '@/components/reports/KPICard';
import { InsightsPanel } from '@/components/reports/InsightsPanel';
import { CompletionChart } from '@/components/reports/CompletionChart';
import { AccessDeniedPage } from '@/components/permissions';
import { useReportMetrics, useReportInsights } from '@/hooks/useReportMetrics';
import { usePermissions } from '@/hooks/usePermissions';
import { ReportFilters } from '@/types/reports';
import { User, Loader2 } from 'lucide-react';

export default function ReportsPersonal() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '7d' });
  const { kpis, completionTrend, isLoading } = useReportMetrics(filters, 'personal');
  const insights = useReportInsights(kpis);

  if (permissionsLoading) {
    return (
      <AppLayout title="Mi productividad">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPermission('reports.view')) {
    return (
      <AppLayout title="Mi productividad">
        <AccessDeniedPage 
          title="Sin acceso a reportes"
          description="No tienes permiso para ver los reportes. Contacta a tu administrador."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mi productividad">
      <div className="space-y-6">
        <div className="flex items-center gap-3"><User className="h-6 w-6" /><div><h1 className="text-2xl font-bold">Mi productividad</h1></div></div>
        <ReportFiltersBar filters={filters} onFiltersChange={setFilters} showAssigneeFilter={false} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Mis abiertas" value={kpis.taskMetrics.tasksOpen} icon="tasks" isLoading={isLoading} />
          <KPICard title="Completadas" value={kpis.taskMetrics.tasksCompleted} icon="completed" variant="success" isLoading={isLoading} />
          <KPICard title="Vencidas" value={kpis.taskMetrics.tasksOverdue} icon="overdue" variant={kpis.taskMetrics.tasksOverdue > 0 ? 'warning' : 'default'} isLoading={isLoading} />
          <KPICard title="Tiempo ciclo" value={kpis.flowMetrics.avgCycleTime !== null ? `${kpis.flowMetrics.avgCycleTime.toFixed(1)}d` : '-'} icon="timer" isLoading={isLoading} />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><CompletionChart data={completionTrend} isLoading={isLoading} /></div>
          <InsightsPanel insights={insights} />
        </div>
      </div>
    </AppLayout>
  );
}
