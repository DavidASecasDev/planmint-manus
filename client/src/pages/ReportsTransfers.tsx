import { useState } from 'react';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { KPICard } from '@/components/reports/KPICard';
import { TransfersByStatusChart, TransfersTrendChart, PricingModeDistributionChart } from '@/components/reports/TransferReportsCharts';
import { TransferReportsTable } from '@/components/reports/TransferReportsTable';
import { BrokerRankingTable } from '@/components/reports/BrokerRankingTable';
import { useTransferReports } from '@/hooks/useTransferReports';
import { useTransferBrokers } from '@/hooks/useTransferBrokers';
import { ReportFilters } from '@/types/reports';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Repeat2, Users, X } from 'lucide-react';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export default function ReportsTransfers() {
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });
  const { data: report, isLoading } = useTransferReports(filters);
  const { allBrokers, isLoading: isLoadingBrokers } = useTransferBrokers();

  const selectedBroker = allBrokers.find(b => b.id === filters.brokerId);

  const handleBrokerChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      brokerId: value === 'all' ? undefined : value,
    }));
  };

  const clearBrokerFilter = () => {
    setFilters(prev => ({ ...prev, brokerId: undefined }));
  };

  return (
    <ReportsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10">
            <Repeat2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reportes de Transfers</h1>
            <p className="text-sm text-muted-foreground">Solicitudes, ingresos, costes y rendimiento por broker</p>
          </div>
        </div>

        {/* Filters row */}
        <div className="space-y-3">
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
          </div>

          {/* Broker filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Broker:</span>
            </div>
            <Select
              value={filters.brokerId || 'all'}
              onValueChange={handleBrokerChange}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos los brokers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los brokers</SelectItem>
                {allBrokers.map((broker) => (
                  <SelectItem key={broker.id} value={broker.id}>
                    {broker.name}
                    {broker.company && (
                      <span className="text-muted-foreground ml-1">({broker.company})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBroker && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearBrokerFilter}
                className="gap-1 text-muted-foreground h-8"
              >
                <X className="h-3.5 w-3.5" />
                <span className="text-xs">Quitar filtro</span>
              </Button>
            )}
          </div>

          {/* Active broker filter indicator */}
          {selectedBroker && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <Users className="h-3.5 w-3.5" />
                Filtrando por: {selectedBroker.name}
                {selectedBroker.company && ` (${selectedBroker.company})`}
              </Badge>
            </div>
          )}
        </div>

        {/* KPIs — Row 1: Counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total solicitudes" value={report?.kpis.total || 0} icon="tasks" isLoading={isLoading} />
          <KPICard title="Completadas" value={report?.kpis.completed || 0} icon="completed" variant="success" isLoading={isLoading} />
          <KPICard title="Pendientes" value={report?.kpis.pending || 0} icon="timer" isLoading={isLoading} />
          <KPICard title="Canceladas" value={report?.kpis.cancelled || 0} icon="blocked" variant={report?.kpis.cancelled ? 'danger' : 'default'} isLoading={isLoading} />
        </div>

        {/* KPIs — Row 2: Financials */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Ingresos" value={formatCurrency(report?.kpis.totalRevenue || 0)} icon="trend" variant="success" isLoading={isLoading} />
          <KPICard title="Costes" value={formatCurrency(report?.kpis.totalCost || 0)} icon="tasks" isLoading={isLoading} />
          <KPICard
            title="Margen bruto"
            value={formatCurrency(report?.kpis.totalMargin || 0)}
            icon="trend"
            variant={(report?.kpis.totalMargin || 0) >= 0 ? 'success' : 'danger'}
            isLoading={isLoading}
          />
          <KPICard
            title="% Margen"
            value={`${(report?.kpis.marginPercent || 0).toFixed(1)}%`}
            icon="goal"
            variant={(report?.kpis.marginPercent || 0) >= 20 ? 'success' : (report?.kpis.marginPercent || 0) >= 10 ? 'warning' : 'danger'}
            isLoading={isLoading}
          />
        </div>

        {/* Charts — Row 1: Status + Trend */}
        <div className="grid lg:grid-cols-2 gap-5">
          <TransfersByStatusChart data={report?.byStatus || []} isLoading={isLoading} />
          <TransfersTrendChart data={report?.dailyTrend || []} isLoading={isLoading} />
        </div>

        {/* Chart — Pricing Mode Distribution */}
        <PricingModeDistributionChart data={report?.byPricingMode || []} isLoading={isLoading} />

        {/* Broker Ranking */}
        <BrokerRankingTable brokers={report?.brokerStats || []} isLoading={isLoading} />

        {/* Broker Detail Table */}
        <TransferReportsTable brokers={report?.brokerStats || []} isLoading={isLoading} />
      </div>
    </ReportsLayout>
  );
}
