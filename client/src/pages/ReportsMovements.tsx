import { useState } from 'react';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { KPICard } from '@/components/reports/KPICard';
import { MovementReportsTable } from '@/components/reports/MovementReportsTable';
import { MovementsByTypeChart, MovementsTrendChart } from '@/components/reports/MovementReportsCharts';
import { useMovementReports } from '@/hooks/useMovementReports';
import { ReportFilters } from '@/types/reports';
import { ArrowUpDown } from 'lucide-react';

export default function ReportsMovements() {
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });
  const { data: report, isLoading } = useMovementReports(filters);

  return (
    <ReportsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10">
            <ArrowUpDown className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reportes de Movimientos</h1>
            <p className="text-sm text-muted-foreground">Entregas, recogidas, escobas y limpiezas</p>
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
          <KPICard title="Total" value={report?.kpis.total || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Completados" value={report?.kpis.completed || 0} icon="completed" variant="success" isLoading={isLoading} />
          <KPICard title="En curso" value={report?.kpis.inProgress || 0} icon="timer" isLoading={isLoading} />
          <KPICard title="Prom/usuario" value={(report?.kpis.avgPerUser || 0).toFixed(1)} icon="trend" isLoading={isLoading} />
          <KPICard title="Entregas" value={report?.kpis.entregas || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Recogidas" value={report?.kpis.recogidas || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Escobas" value={report?.kpis.escobas || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Limpiezas" value={report?.kpis.limpiezas || 0} icon="tasks" isLoading={isLoading} />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-5">
          <MovementsByTypeChart data={report?.byType || []} isLoading={isLoading} />
          <MovementsTrendChart data={report?.dailyTrend || []} isLoading={isLoading} />
        </div>

        <MovementReportsTable users={report?.userStats || []} isLoading={isLoading} />
      </div>
    </ReportsLayout>
  );
}
