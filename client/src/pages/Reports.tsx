import { useState } from 'react';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { KPICard } from '@/components/reports/KPICard';
import { InsightsPanel } from '@/components/reports/InsightsPanel';
import { CompletionChart } from '@/components/reports/CompletionChart';
import { AreasTable } from '@/components/reports/AreasTable';
import { useReportMetrics, useAreaReports, useReportInsights } from '@/hooks/useReportMetrics';
import { ReportFilters } from '@/types/reports';
import { BarChart3 } from 'lucide-react';

export default function Reports() {
  const [filters, setFilters] = usePersistedFilters<ReportFilters>({ dateRange: '30d' });

  const { kpis, completionTrend, isLoading } = useReportMetrics(filters, 'org');
  const { data: areaReports, isLoading: loadingAreas } = useAreaReports(filters);
  const insights = useReportInsights(kpis);

  return (
    <ReportsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reportes Generales</h1>
              <p className="text-sm text-muted-foreground">Métricas de productividad de la organización</p>
            </div>
          </div>
        </div>

        <ReportFiltersBar filters={filters} onFiltersChange={setFilters} />

        {/* KPIs — full width row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPICard title="Creadas" value={kpis.taskMetrics.tasksCreated} icon="tasks" isLoading={isLoading} />
          <KPICard title="Completadas" value={kpis.taskMetrics.tasksCompleted} icon="completed" variant="success" isLoading={isLoading} />
          <KPICard title="Abiertas" value={kpis.taskMetrics.tasksOpen} icon="tasks" isLoading={isLoading} />
          <KPICard title="Bloqueadas" value={kpis.taskMetrics.tasksBlocked} icon="blocked" variant={kpis.taskMetrics.tasksBlocked > 0 ? 'danger' : 'default'} isLoading={isLoading} />
          <KPICard title="Vencidas" value={kpis.taskMetrics.tasksOverdue} icon="overdue" variant={kpis.taskMetrics.tasksOverdue > 0 ? 'warning' : 'default'} isLoading={isLoading} />
          <KPICard title="Tiempo ciclo" value={kpis.flowMetrics.avgCycleTime !== null ? `${kpis.flowMetrics.avgCycleTime.toFixed(1)}d` : '-'} icon="timer" isLoading={isLoading} />
        </div>

        {/* Chart + Insights — more space for chart */}
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <CompletionChart data={completionTrend} isLoading={isLoading} />
          </div>
          <div className="lg:col-span-2">
            <InsightsPanel insights={insights} />
          </div>
        </div>

        <AreasTable areas={areaReports || []} isLoading={loadingAreas} />
      </div>
    </ReportsLayout>
  );
}
