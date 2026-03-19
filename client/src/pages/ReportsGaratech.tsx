import { useState } from 'react';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { KPICard } from '@/components/reports/KPICard';
import { RepairsByStatusChart, MonthlyCostsChart } from '@/components/reports/GaratechReportsCharts';
import { GaratechReportsTable } from '@/components/reports/GaratechReportsTable';
import { useGaratechReports } from '@/hooks/useGaratechReports';
import { ReportFilters } from '@/types/reports';
import { Wrench } from 'lucide-react';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export default function ReportsGaratech() {
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });
  const { data: report, isLoading } = useGaratechReports(filters);

  return (
    <ReportsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10">
            <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reportes Garatech</h1>
            <p className="text-sm text-muted-foreground">Reparaciones, accidentes, costes y rendimiento por taller</p>
          </div>
        </div>

        <ReportFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          showAreaFilter={false}
          showTagFilter={false}
          showAssigneeFilter={false}
          showStatusFilter={false}
          showTypeFilter={false}
        />

        {/* KPIs — single row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total reparaciones" value={report?.kpis.totalRepairs || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Activas" value={report?.kpis.activeRepairs || 0} icon="timer" isLoading={isLoading} />
          <KPICard title="Completadas" value={report?.kpis.completedRepairs || 0} icon="completed" variant="success" isLoading={isLoading} />
          <KPICard title="Accidentes" value={report?.kpis.totalAccidents || 0} icon="blocked" variant={report?.kpis.totalAccidents ? 'warning' : 'default'} isLoading={isLoading} />
          <KPICard title="Coste estimado" value={formatCurrency(report?.kpis.totalCostEstimate || 0)} icon="tasks" isLoading={isLoading} />
          <KPICard title="Coste final" value={formatCurrency(report?.kpis.totalCostFinal || 0)} icon="trend" isLoading={isLoading} />
          <KPICard
            title="Tiempo medio"
            value={report?.kpis.avgDaysInWorkshop !== null && report?.kpis.avgDaysInWorkshop !== undefined ? `${Math.round(report.kpis.avgDaysInWorkshop)}d` : 'N/D'}
            icon="timer"
            isLoading={isLoading}
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-5">
          <RepairsByStatusChart data={report?.byStatus || []} isLoading={isLoading} />
          <MonthlyCostsChart data={report?.monthlyCosts || []} isLoading={isLoading} />
        </div>

        <GaratechReportsTable workshops={report?.workshopStats || []} isLoading={isLoading} />
      </div>
    </ReportsLayout>
  );
}
