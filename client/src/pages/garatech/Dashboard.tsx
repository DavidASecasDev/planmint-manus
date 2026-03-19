import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Wrench } from 'lucide-react';
import { useGaratechStats } from '@/hooks/useGaratechStats';
import { StatusOverviewBar } from '@/components/garatech/dashboard/StatusOverviewBar';
import { GaratechKPICards } from '@/components/garatech/dashboard/GaratechKPICards';
import { BalanceKPICards } from '@/components/garatech/dashboard/BalanceKPICards';
import { QuickActionsGrid } from '@/components/garatech/dashboard/QuickActionsGrid';
import { UrgentRepairsList } from '@/components/garatech/dashboard/UrgentRepairsList';
import { MonthlyExpensesChart } from '@/components/garatech/dashboard/MonthlyExpensesChart';
import { BalanceChart } from '@/components/garatech/dashboard/BalanceChart';
import { ActivityFeed } from '@/components/garatech/dashboard/ActivityFeed';
import { RepairFormDialog } from '@/components/garatech/RepairFormDialog';

export default function GaratechDashboard() {
  const { stats, recentActivity, isLoading } = useGaratechStats();
  const [newRepairOpen, setNewRepairOpen] = useState(false);

  return (
    <AppLayout title="Garatech">
      <div className="space-y-6">
        <PageHeader
          title="Garatech"
          description="Panel de control de taller y mantenimiento de flota"
          icon={Wrench}
        />

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        ) : (
          <>
            {/* Status Overview Bar */}
            <StatusOverviewBar repairsByStatus={stats.repairsByStatus} />

            {/* Balance KPI Cards - NEW */}
            <BalanceKPICards
              incomeThisMonth={stats.incomeThisMonth}
              expensesThisMonth={stats.expensesThisMonth}
              balanceThisMonth={stats.balanceThisMonth}
            />

            {/* Operations KPI Cards */}
            <GaratechKPICards
              activeRepairs={stats.activeRepairs}
              totalCostThisMonth={stats.totalCostThisMonth}
              averageRepairDays={stats.averageRepairDays}
              accidentsThisMonth={stats.accidentsThisMonth}
            />

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                <QuickActionsGrid onNewRepair={() => setNewRepairOpen(true)} />
                <BalanceChart data={stats.monthlyBalance} />
                <ActivityFeed activities={recentActivity} />
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <UrgentRepairsList repairs={stats.urgentRepairs} />
                <MonthlyExpensesChart data={stats.monthlyExpenses} />
              </div>
            </div>
          </>
        )}
      </div>

      <RepairFormDialog open={newRepairOpen} onOpenChange={setNewRepairOpen} />
    </AppLayout>
  );
}
