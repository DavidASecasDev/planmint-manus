import { useState } from 'react';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { KPICard } from '@/components/reports/KPICard';
import { VehicleCleaningTable } from '@/components/reports/VehicleCleaningTable';
import { VehicleCleaningChart, CleaningTrendChart, CleaningTimeDistributionChart } from '@/components/reports/VehicleCleaningCharts';
import { useVehicleCleaningReports } from '@/hooks/useVehicleReports';
import { useVehicleLocations } from '@/hooks/useVehicleLocations';
import { ReportFilters } from '@/types/reports';
import { Car, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return 'N/D';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export default function ReportsVehicles() {
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });
  const [locationId, setLocationId] = useState<string>('all');
  const { locations } = useVehicleLocations();
  const { data: report, isLoading } = useVehicleCleaningReports(filters, locationId);

  return (
    <ReportsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10">
            <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reportes de Flota</h1>
            <p className="text-sm text-muted-foreground">Métricas de limpieza de la flota</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <ReportFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            showAreaFilter={false}
            showTagFilter={false}
            showAssigneeFilter={false}
            showStatusFilter={false}
            showTypeFilter={false}
          />
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[200px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ubicación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              <SelectItem value="none">Sin ubicación</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Primary KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Vehículos limpiados" value={report?.metrics.totalVehiclesCleaned || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Tareas completadas" value={report?.metrics.totalTasksCompleted || 0} icon="completed" variant="success" isLoading={isLoading} />
          <KPICard title="Promedio/persona" value={(report?.metrics.avgTasksPerUser || 0).toFixed(1)} icon="tasks" isLoading={isLoading} />
          <KPICard title="Tareas/vehículo" value={(report?.metrics.avgTasksPerVehicle || 0).toFixed(1)} icon="completed" isLoading={isLoading} />
          <KPICard title="Tiempo promedio" value={formatDuration(report?.metrics.avgCleaningTimeMinutes ?? null)} subtitle="Por vehículo" icon="timer" isLoading={isLoading} />
          <KPICard title="Más rápido" value={formatDuration(report?.metrics.minCleaningTimeMinutes ?? null)} icon="trend" variant="success" isLoading={isLoading} />
          <KPICard title="Más lento" value={formatDuration(report?.metrics.maxCleaningTimeMinutes ?? null)} icon="overdue" variant="warning" isLoading={isLoading} />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-5">
          <VehicleCleaningChart data={report?.metrics.tasksByType || []} isLoading={isLoading} />
          <CleaningTrendChart data={report?.metrics.cleaningTrend || []} isLoading={isLoading} />
        </div>

        <CleaningTimeDistributionChart data={report?.metrics.cleaningTimeDistribution || []} isLoading={isLoading} />

        <VehicleCleaningTable users={report?.userStats || []} isLoading={isLoading} />
      </div>
    </ReportsLayout>
  );
}
